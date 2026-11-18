// Ações do cronograma da R7 (Carol, 17/11/2026): montar a grade, salvar cada campo, copiar o pedido para o
// Claude, encaixar a resposta colada, escrever as legendas que faltam com a IA (só com o toque dela, duas
// por vez), marcar as etapas e baixar PDF/PPTX. Tudo fica em config "cronograma-r7:<cliente>:<início>".

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, excluir, puxarTabela } from './persistencia.js';
import { chamar, dispararSegundoPlano } from './funcoes.js';
import { confirmar } from './confirmar.js';
import { prepararMedidas, medir, pptxDeSlides, pdfDeSlides, canvasDoSlide } from './slides-arquivos.js';
import { baixar } from './exportar-caderno.js';
import { clientesR7, fichaDe } from './views-r7.js';
import { conferirFichaR7, fichaEmTexto } from './dados-r7.js';
import { contextoDoCliente, cronogramaAberto } from './views-cronograma.js';
import {
  chaveDoCronograma, cronogramaVazio, normalizarCronograma, pecaVazia, pedidoParaClaude, lerRespostaDoClaude, oQueFalta,
  textoWhatsApp, textoParaTrello, entregaDoDesigner, pedidoDasArtesDosStories, textoDaEntrega, montarSlidesDoCronograma, nomeDoArquivoDoCronograma,
  lerDocumentoDaQuinzena, cronogramaDoDocumento, cronogramasDoCliente, FORMATO_DO_DOCUMENTO, lerCronogramaPronto, assinaturaDoCronograma,
} from './dados-cronograma.js';
import { textoDoArquivo, paginasDoPdf, imagensDosArquivos, guardarArte, apagarArte, artesDoCronograma, urlDaArte, carregarArte } from './cronograma-importar.js';

let app; // { renderizar, avisoCurto }

export function ligarCronograma(funcoes) {
  app = funcoes;
  // Lembra quais peças estão abertas (o redesenho depois de salvar um campo não fecha a peça).
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('cron-peca')) return;
    const abertas = new Set(obterEstado().cronAbertas || []);
    if (d.open) abertas.add(d.dataset.pecaId); else abertas.delete(d.dataset.pecaId);
    atualizarEstado({ cronAbertas: [...abertas] });
  }, true);
}

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
    const artes = await artesDoCronograma(cron);
    const slides = montarSlidesDoCronograma(cron, { cor: f.rotina.estilo?.corDestaque, assinatura: f.identificacao.assinatura, artes }, medir);
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

// O documento da quinzena: lido no aparelho; vira cronograma novo ou atualiza o do mesmo período.
const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

// Grava o cronograma lido (do documento ou do PDF pronto): novo, ou junta ao do mesmo período.
async function gravarDocumento(chave, doc) {
  const c = cliente(chave);
  const existentes = cronogramasDoCliente(obterEstado().config || [], chave);
  const alvo = existentes.find((x) => x.inicio <= doc.fim && x.fim >= doc.inicio) || null;
  const { cron, novas } = cronogramaDoDocumento(doc, alvo, { cliente: chave, nome: c?.nome });
  await gravar(chave, cron);
  // Ficha sem assinatura: vem a do cronograma (o resto da ficha não muda).
  const assinatura = assinaturaDoCronograma(cron);
  if (c && assinatura && !fichaDe(c).identificacao.assinatura) {
    const r7 = conferirFichaR7({ ...fichaDe(c), identificacao: { ...fichaDe(c).identificacao, assinatura } });
    await salvar('clientes_trabalho', { ...c, dados: { ...(c.dados || {}), r7, ficha: fichaEmTexto(c.nome, r7) } });
    atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho') });
  }
  if (alvo && alvo.inicio !== cron.inicio) {
    const velha = (await listar('config')).find((l) => l.chave === chaveDoCronograma(chave, alvo.inicio) && !l.excluido_em);
    if (velha) await excluir('config', velha.id);
    atualizarEstado({ config: await listar('config') });
  }
  atualizarEstado({ cronDocSemLeitura: null, cronDocTexto: '' });
  location.hash = `#r7/cronograma:${chave}:${cron.inicio}`;
  app.renderizar();
  const artes = doc.pecas.reduce((n, p) => n + (p.artes?.length || 0), 0);
  avisar(`${alvo ? 'Cronograma atualizado' : 'Cronograma montado'}: ${doc.lidas} ${doc.lidas === 1 ? 'peça' : 'peças'}${novas && alvo ? ` (${novas} ${novas === 1 ? 'nova' : 'novas'})` : ''}${artes ? `, ${artes} ${artes === 1 ? 'arte' : 'artes'}` : ''}. Confira o que falta.`);
}

function semLeitura(chave, textoDoc, nomeArquivo) {
  atualizarEstado({ cronDocSemLeitura: { cliente: chave, nome: nomeArquivo }, cronDocTexto: textoDoc, cronOcupado: '' });
  app.renderizar();
}

async function subirDocumento(input) {
  const arquivo = input.files?.[0];
  const chave = input.dataset.cliente;
  input.value = '';
  if (!arquivo) return;
  atualizarEstado({ cronOcupado: 'Lendo o documento…', cronDocSemLeitura: null });
  app.renderizar();
  try {
    const hoje = hojeIso();
    let textoDoc = '';
    if (/pdf$/i.test(arquivo.type) || /\.pdf$/i.test(arquivo.name)) {
      // 1) O cronograma pronto (o visual da R7), com as artes de cada página.
      const { paginas, imagens } = await paginasDoPdf(arquivo);
      const pronto = lerCronogramaPronto(paginas, { hoje });
      if (pronto.lidas) {
        atualizarEstado({ cronOcupado: 'Guardando as artes…' });
        app.renderizar();
        for (const p of pronto.pecas) {
          const blobs = (p.artesDaPagina || []).map((k) => imagens[p.paginaDoPdf]?.[k]).filter(Boolean);
          p.artes = [];
          for (const [i, b] of blobs.entries()) p.artes.push({ caminho: await guardarArte(b, { cliente: chave, inicio: pronto.inicio, peca: p.id, n: i + 1 }), origem: 'manual' });
        }
        atualizarEstado({ cronOcupado: '' });
        await gravarDocumento(chave, pronto);
        return;
      }
      textoDoc = paginas.map((pg) => [...pg.linhas].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => l.t).join('\n')).join('\n');
    } else {
      textoDoc = await textoDoArquivo(arquivo);
    }
    // 2) O documento no formato da Bússola ("23.11 · CARROSSEL").
    const doc = lerDocumentoDaQuinzena(textoDoc, { hoje });
    atualizarEstado({ cronOcupado: '' });
    if (doc.lidas) { await gravarDocumento(chave, doc); return; }
    // 3) Nenhum dos dois: oferece a IA (em segundo plano).
    semLeitura(chave, textoDoc, arquivo.name);
  } catch (e) {
    atualizarEstado({ cronOcupado: '' });
    app.renderizar();
    avisar(e?.message || 'Não deu para ler esse arquivo. Tente exportar de novo em PDF.');
  }
}

// A IA organiza o documento em segundo plano (pode levar alguns minutos); o app acompanha a config
// "r7-documento:<cliente>" e monta o cronograma quando ela chega.
async function organizarComIa(alvo) {
  const chave = alvo.dataset.cliente;
  const textoDoc = obterEstado().cronDocTexto || '';
  if (!textoDoc.trim()) return;
  const pedidoEm = new Date().toISOString();
  const r = await dispararSegundoPlano('r7-documento-background', { cliente: chave, texto: textoDoc.slice(0, 80000), hoje: hojeIso(), pedido_em: pedidoEm });
  if (!r.ok) { avisar(r.erro); return; }
  atualizarEstado({ cronOcupado: 'A IA está organizando o documento. Pode levar alguns minutos; pode sair desta tela.' });
  app.renderizar();
  const limite = Date.now() + 8 * 60 * 1000;
  const conferir = async () => {
    await puxarTabela('config').catch(() => {});
    const linha = (await listar('config')).find((l) => l.chave === `r7-documento:${chave}` && !l.excluido_em);
    const v = linha?.valor;
    if (v?.pedido_em === pedidoEm && v.status === 'pronto') {
      atualizarEstado({ config: await listar('config'), cronOcupado: '' });
      const doc = lerDocumentoDaQuinzena(v.documento, { hoje: hojeIso() });
      if (doc.lidas) await gravarDocumento(chave, doc);
      else { app.renderizar(); avisar('A IA devolveu o documento, mas não achei as peças. Confira o arquivo e tente de novo.'); }
      return;
    }
    if (v?.pedido_em === pedidoEm && v.status === 'erro') { atualizarEstado({ cronOcupado: '' }); app.renderizar(); avisar(v.erro); return; }
    if (Date.now() > limite) { atualizarEstado({ cronOcupado: '' }); app.renderizar(); avisar('A IA está demorando mais que o normal. Tente de novo daqui a pouco.'); return; }
    setTimeout(conferir, 5000);
  };
  setTimeout(conferir, 8000);
}

// Artes anexadas à mão (imagens ou PDF): trocam as da peça, na ordem do número no nome do arquivo.
async function anexarArtes(input) {
  const arquivos = [...(input.files || [])];
  input.value = '';
  if (!arquivos.length) return;
  const { chave, cron } = doAlvo(input);
  const p = cron?.pecas.find((x) => x.id === input.dataset.peca);
  if (!p) return;
  atualizarEstado({ cronOcupado: 'Guardando as artes…' });
  app.renderizar();
  try {
    const blobs = await imagensDosArquivos(arquivos);
    if (!blobs.length) throw new Error('Não achei imagens nesses arquivos.');
    const artes = [];
    for (const [i, b] of blobs.entries()) artes.push({ caminho: await guardarArte(b, { cliente: chave, inicio: cron.inicio, peca: p.id, n: i + 1 }), origem: 'manual' });
    const antigas = (p.artes || []).filter((a) => a.caminho);
    const atual = cronogramaAberto(obterEstado(), chave, cron.inicio) || cron;
    await gravar(chave, { ...atual, pecas: atual.pecas.map((x) => (x.id === p.id ? { ...x, artes } : x)) });
    antigas.forEach((a) => apagarArte(a.caminho));
    avisar(`${artes.length} ${artes.length === 1 ? 'arte guardada' : 'artes guardadas'}.`);
  } catch (e) {
    avisar(e?.message || 'Não deu para guardar as artes agora.');
  } finally {
    atualizarEstado({ cronOcupado: '' });
    app.renderizar();
  }
}

// Miniaturas: põe o endereço das artes que já estão em memória e busca as outras, sem redesenhar a tela.
export function montarArtes() {
  document.querySelectorAll('img[data-arte]:not([src])').forEach((img) => {
    const caminho = img.dataset.arte;
    const url = urlDaArte(caminho);
    if (url) { img.src = url; return; }
    carregarArte(caminho).then((u) => { if (u && img.isConnected) img.src = u; });
  });
}

// Prévia do cronograma montado (Carol, 18/11/2026: "precisa aparecer do lado, para eu ir acompanhando"):
// as páginas do PDF como imagens. Só remonta quando o cronograma muda (e espera meio segundo depois da
// última mudança); entre um redesenho e outro, as mesmas imagens voltam na hora.
const previa = { marca: '', urls: [], timer: null, montando: '' };

function pintarPrevia(box) {
  if (!previa.urls.length) return;
  box.innerHTML = previa.urls.map((u, i) => `<img src="${u}" alt="Página ${i + 1} do cronograma" width="600" height="338" loading="lazy">`).join('');
}

export function montarPrevia() {
  const box = document.querySelector('[data-previa]');
  if (!box) return;
  const [chave, inicio] = box.dataset.previa.split('|');
  const c = cliente(chave);
  const cron = cronogramaAberto(obterEstado(), chave, inicio);
  if (!c || !cron) return;
  const f = fichaDe(c);
  const opcoes = { cor: f.rotina.estilo?.corDestaque, assinatura: f.identificacao.assinatura };
  const marcaNova = JSON.stringify([cron.nome, cron.inicio, cron.fim, cron.pecas, opcoes]);
  if (marcaNova === previa.marca) { pintarPrevia(box); return; }
  pintarPrevia(box);
  if (previa.montando === marcaNova) return;
  clearTimeout(previa.timer);
  previa.timer = setTimeout(async () => {
    previa.montando = marcaNova;
    try {
      await prepararMedidas();
      const artes = await artesDoCronograma(cron);
      const slides = montarSlidesDoCronograma(cron, { ...opcoes, artes }, medir);
      const urls = [];
      for (const sl of slides) {
        const canvas = await canvasDoSlide(sl, 900);
        urls.push(await new Promise((r) => canvas.toBlob((b) => r(URL.createObjectURL(b)), 'image/jpeg', 0.86)));
      }
      if (previa.montando !== marcaNova) { urls.forEach((u) => URL.revokeObjectURL(u)); return; }
      previa.urls.forEach((u) => URL.revokeObjectURL(u));
      previa.urls = urls;
      previa.marca = marcaNova;
      const atual = document.querySelector('[data-previa]');
      if (atual) pintarPrevia(atual);
    } catch { /* sem as fontes agora: tenta no próximo redesenho */ } finally {
      if (previa.montando === marcaNova) previa.montando = '';
    }
  }, previa.urls.length ? 600 : 0);
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
    case 'cron-artes': {
      const { cron } = doAlvo(alvo);
      const p = cron?.pecas.find((x) => x.id === alvo.dataset.peca);
      if (p) copiar(pedidoDasArtesDosStories(cron, p), 'Pedido das artes copiado. Cole no projeto do cliente no Claude.');
      return true;
    }
    case 'cron-formato': copiar(FORMATO_DO_DOCUMENTO, 'Formato copiado. Cole no projeto do cliente no Claude.'); return true;
    case 'cron-doc-ia': organizarComIa(alvo); return true;
    case 'cron-doc-cancelar': atualizarEstado({ cronDocSemLeitura: null, cronDocTexto: '' }); app.renderizar(); return true;
    case 'cron-artes-tirar':
      confirmar('Tirar as artes desta peça?', { botao: 'Tirar', perigo: true }).then((ok) => {
        if (!ok) return;
        const { cron } = doAlvo(alvo);
        const p = cron?.pecas.find((x) => x.id === alvo.dataset.peca);
        (p?.artes || []).forEach((a) => apagarArte(a.caminho));
        mudarPeca(alvo, (x) => ({ ...x, artes: [] }));
      });
      return true;
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
  if (acao === 'cron-documento') { if (tipo === 'change') subirDocumento(alvo); return true; }
  if (acao === 'cron-artes') { if (tipo === 'change') anexarArtes(alvo); return true; }
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
