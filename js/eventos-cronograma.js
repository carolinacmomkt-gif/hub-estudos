// Ações do cronograma da R7 (Carol, 17/11/2026): montar a grade, salvar cada campo, copiar o pedido para o
// Claude, encaixar a resposta colada, escrever as legendas que faltam com a IA (só com o toque dela, duas
// por vez), marcar as etapas e baixar PDF/PPTX. Tudo fica em config "cronograma-r7:<cliente>:<início>".

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { confirmar } from './confirmar.js';
import { prepararMedidas, medir, pptxDeSlides, pdfDeSlides } from './slides-arquivos.js';
import { baixar } from './exportar-caderno.js';
import { clientesR7, fichaDe } from './views-r7.js';
import { contextoDoCliente, cronogramaAberto } from './views-cronograma.js';
import {
  chaveDoCronograma, cronogramaVazio, normalizarCronograma, pecaVazia, pedidoParaClaude, lerRespostaDoClaude, oQueFalta,
  textoWhatsApp, textoParaTrello, entregaDoDesigner, textoDaEntrega, montarSlidesDoCronograma, nomeDoArquivoDoCronograma,
} from './dados-cronograma.js';

let app; // { renderizar, avisoCurto }

export function ligarCronograma(funcoes) { app = funcoes; }

const cliente = (chave) => clientesR7(obterEstado()).find((c) => c.chave === chave) || null;
const avisar = (t) => app.avisoCurto(t);

function copiar(texto, ok = 'Copiado.') {
  if (!navigator.clipboard) return avisar('Este navegador não deixa copiar. Selecione o texto e copie.');
  navigator.clipboard.writeText(texto).then(() => avisar(ok), () => avisar('Não consegui copiar.'));
}

async function gravar(chave, cron) {
  const linhas = await listar('config');
  const k = chaveDoCronograma(chave, cron.inicio);
  const atual = linhas.find((l) => l.chave === k && !l.excluido_em);
  await salvar('config', { ...(atual || {}), chave: k, valor: normalizarCronograma({ ...cron, atualizado_em: new Date().toISOString() }) });
  atualizarEstado({ config: await listar('config') });
}

// O cronograma da tela aberta (rota #r7/cronograma:<chave>[:<início>]).
function doAlvo(alvo) {
  const chave = alvo.dataset.cliente;
  const [, inicioRota] = String(obterEstado().parametro || '').slice(11).split(':');
  const cron = cronogramaAberto(obterEstado(), chave, alvo.dataset.inicio || inicioRota);
  return { chave, c: cliente(chave), cron };
}

async function mudarPeca(alvo, mudar) {
  const { chave, cron } = doAlvo(alvo);
  if (!cron) return;
  const pecas = cron.pecas.map((p) => (p.id === alvo.dataset.peca ? mudar({ ...p }) : p)).filter(Boolean);
  await gravar(chave, { ...cron, pecas });
  app.renderizar();
}

async function novo(form) {
  const chave = form.dataset.cliente;
  const c = cliente(chave);
  const inicio = form.elements.inicio.value;
  const fim = form.elements.fim.value;
  if (!c || !inicio || !fim || fim < inicio) return avisar('Confira as datas: o fim vem depois do começo.');
  const ja = cronogramaAberto(obterEstado(), chave, inicio);
  if (ja && !(await confirmar('Já existe um cronograma começando nesse dia. Abrir o que existe?', { botao: 'Abrir' }))) return;
  if (!ja) await gravar(chave, cronogramaVazio({ cliente: chave, nome: c.nome, inicio, fim, rotina: fichaDe(c).rotina }));
  location.hash = `#r7/cronograma:${chave}:${inicio}`;
}

async function colar(form) {
  const { chave, cron } = doAlvo(form);
  const texto = form.elements.resposta.value;
  if (!cron || !texto.trim()) return avisar('Cole a resposta do Claude primeiro.');
  const r = lerRespostaDoClaude(texto, cron.pecas);
  if (!r.lidas) return avisar('Não achei os blocos "### dd.mm · TIPO". Confira se colou a resposta inteira.');
  await gravar(chave, { ...cron, pecas: r.pecas });
  form.reset();
  app.renderizar();
  avisar(`${r.lidas} ${r.lidas === 1 ? 'peça preenchida' : 'peças preenchidas'}.${r.sobras.length ? ` Fora do cronograma: ${r.sobras.join(', ')}.` : ''}`);
}

async function novaPeca(form) {
  const { chave, cron } = doAlvo(form);
  if (!cron) return;
  const data = form.elements.data.value;
  const tipo = form.elements.tipo.value;
  if (!data) return;
  await gravar(chave, { ...cron, pecas: [...cron.pecas, pecaVazia(data, tipo)] });
  app.renderizar();
}

// Legendas que faltam com a IA: duas por vez (cada chamada é curta), só as vazias.
async function escreverComIa(alvo) {
  const { chave, c, cron } = doAlvo(alvo);
  if (!cron || !c) return;
  const f = fichaDe(c);
  const ctx = contextoDoCliente(c, f);
  const vazias = cron.pecas.filter((p) => (p.tipo === 'post' || p.tipo === 'reels') && oQueFalta(p, ctx).falta.includes('legenda'));
  if (!vazias.length) return;
  let feitas = 0;
  let erro = '';
  for (let i = 0; i < vazias.length; i += 2) {
    atualizarEstado({ cronOcupado: `Escrevendo ${Math.min(i + 2, vazias.length)} de ${vazias.length}…` });
    app.renderizar();
    const lote = vazias.slice(i, i + 2).map((p) => ({ id: p.id, data: p.data, tipo: p.tipo, formato: p.formato, tema: p.tema, slides: p.slides }));
    const r = await chamar('trabalho', { acao: 'r7-legendas', cliente: chave, pecas: lote }).catch((e) => ({ ok: false, erro: e.message }));
    if (!r?.ok) { erro = r?.erro || 'A IA não respondeu agora.'; break; }
    const porId = new Map((r.legendas || []).map((x) => [x.id, x.legenda]));
    const atual = cronogramaAberto(obterEstado(), chave, cron.inicio) || cron;
    const pecas = atual.pecas.map((p) => (porId.get(p.id) && !p.legenda.trim() ? { ...p, legenda: porId.get(p.id) } : p));
    feitas += porId.size;
    await gravar(chave, { ...atual, pecas });
  }
  atualizarEstado({ cronOcupado: '' });
  app.renderizar();
  avisar(erro ? `${feitas ? `${feitas} escritas. ` : ''}${erro}` : `${feitas} ${feitas === 1 ? 'legenda escrita' : 'legendas escritas'}. Confira antes de mandar.`);
}

async function baixarArquivo(alvo) {
  const { c, cron } = doAlvo(alvo);
  if (!cron || !c) return;
  const tipo = alvo.dataset.tipo === 'pptx' ? 'pptx' : 'pdf';
  const f = fichaDe(c);
  atualizarEstado({ cronOcupado: tipo === 'pptx' ? 'Montando o PPTX…' : 'Montando o PDF…' });
  app.renderizar();
  try {
    await prepararMedidas();
    const slides = montarSlidesDoCronograma(cron, { cor: f.rotina.estilo?.corDestaque, assinatura: f.identificacao.assinatura }, medir);
    const arquivo = tipo === 'pptx' ? await pptxDeSlides(slides, { titulo: `Cronograma · ${cron.nome}` }) : await pdfDeSlides(slides);
    baixar(arquivo, nomeDoArquivoDoCronograma(cron, tipo));
    avisar(`${tipo.toUpperCase()} baixado.`);
  } catch (e) {
    avisar(e?.message || 'Não deu para montar o arquivo agora.');
  } finally {
    atualizarEstado({ cronOcupado: '' });
    app.renderizar();
  }
}

export function cliqueCronograma(alvo) {
  switch (alvo.dataset.acao) {
    case 'cron-pedido': {
      const { c, cron } = doAlvo(alvo);
      if (!c || !cron) return true;
      const f = fichaDe(c);
      copiar(pedidoParaClaude(cron, { nome: c.nome, fichaTexto: c.dados?.ficha || '', voz: c.dados?.voz || {}, nicho: c.dados?.nicho || '', assinatura: f.identificacao.assinatura }, contextoDoCliente(c, f)),
        'Pedido copiado. Cole no Claude e traga a resposta aqui.');
      return true;
    }
    case 'cron-ia': escreverComIa(alvo); return true;
    case 'cron-baixar': baixarArquivo(alvo); return true;
    case 'cron-whatsapp': {
      const { cron } = doAlvo(alvo);
      if (cron) copiar(textoWhatsApp(cron), 'Texto do WhatsApp copiado.');
      return true;
    }
    case 'cron-drive': {
      const { cron } = doAlvo(alvo);
      if (cron) copiar(textoDaEntrega(cron), 'Nomes das pastas e dos arquivos copiados.');
      return true;
    }
    case 'cron-trello': {
      const { cron } = doAlvo(alvo);
      const p = cron?.pecas.find((x) => x.id === alvo.dataset.peca);
      if (p) {
        const [dia, hora] = entregaDoDesigner(new Date().toLocaleDateString('sv-SE')).split('T');
        copiar(textoParaTrello(p), `Copy copiada. No card: nome "${p.formato === 'estatico' ? 'estático' : 'carrossel'}", topo da lista, entrega ${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hora}.`);
      }
      return true;
    }
    case 'cron-tirar':
      confirmar('Tirar esta peça do cronograma?', { botao: 'Tirar', perigo: true }).then((ok) => { if (ok) mudarPeca(alvo, () => null); });
      return true;
    default:
      return false;
  }
}

export function enviarCronograma(form) {
  switch (form.dataset.form) {
    case 'cron-novo': novo(form); return true;
    case 'cron-colar': colar(form); return true;
    case 'cron-peca-nova': novaPeca(form); return true;
    default: return false;
  }
}

// Campos da peça salvam no "change" (ao sair do campo), sem redesenhar a cada letra.
export function mudancaCronograma(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'cron-campo') {
    if (tipo !== 'change') return true;
    const campo = alvo.dataset.campo;
    const valor = alvo.type === 'checkbox' ? alvo.checked : alvo.value;
    mudarPeca(alvo, (p) => ({ ...p, [campo]: valor }));
    return true;
  }
  if (acao === 'cron-check') {
    if (tipo !== 'change') return true;
    const { chave, cron } = doAlvo(alvo);
    if (cron) gravar(chave, { ...cron, checklist: { ...cron.checklist, [alvo.dataset.item]: alvo.checked } }).then(() => app.renderizar());
    return true;
  }
  if (acao === 'cron-marca') {
    if (tipo !== 'change') return true;
    const { chave, cron } = doAlvo(alvo);
    if (!cron) return true;
    const id = alvo.dataset.marca;
    if (id === 'enviado' && alvo.checked) {
      const agora = new Date();
      const liberado = agora.getDay() === 5 ? agora.getHours() >= 12 : agora.getDay() === 6 || agora.getDay() === 0 || agora > new Date(`${cron.fim}T12:00:00`);
      if (!liberado) { alvo.checked = false; avisar('O envio ao cliente libera na sexta, a partir das 12h.'); return true; }
    }
    gravar(chave, { ...cron, marcas: { ...cron.marcas, [id]: alvo.checked ? new Date().toISOString() : null } }).then(() => app.renderizar());
    return true;
  }
  return false;
}
