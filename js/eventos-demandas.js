// Cliques e formulários da Caixa de demandas (card do Hoje, Configurações e o que chega pelo
// "Compartilhar" de outro app).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, obter, salvar, sincronizar } from './persistencia.js';
import { pedirDemandas, desconectar } from './funcoes.js';
import { chaveDoTrello } from './nuvem.js';
import { demandaDoTexto, sugestaoSimples, aplicarSugestao, tarefaDaDemanda } from './dados-demandas.js';
import { formDemanda, formColar, folhaCompartilhado, hojeLocal, linkDoTrello, opcoesListas, opcoesEtiquetas } from './views-demandas.js';
import { sugerirEtiqueta } from './dados-demandas.js';

let app; // { renderizar, avisoCurto }
const UMA_HORA = 60 * 60 * 1000;
const PEDIDO_TRELLO = 'bussola-trello-pedido';

export function ligarDemandas(funcoes) {
  app = funcoes;
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
  folha.querySelector('input:not([type="hidden"]), textarea')?.focus();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();

function resultado(html) {
  const saida = document.getElementById('resultado-demandas');
  if (saida) saida.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Ler o Trello e o Notion
// ---------------------------------------------------------------------------

let lendo = null;
export function lerDemandas({ silencioso = false } = {}) {
  if (lendo) return lendo;
  // Só redesenha onde o "Lendo…" aparece: nas outras telas nada pula durante a leitura. Enquanto a
  // Carol arruma o Hoje, também não (os botões pulariam).
  const redesenhar = () => { if (['inicio', 'configuracoes'].includes(obterEstado().rota) && !obterEstado().editandoInicio) app.renderizar(); };
  lendo = (async () => {
    atualizarEstado({ lendoDemandas: true });
    redesenhar();
    const r = await pedirDemandas({ acao: 'sincronizar' });
    await sincronizar();
    atualizarEstado({ lendoDemandas: false });
    redesenhar();
    if (!r.ok) {
      if (!silencioso) app.avisoCurto(r.erros?.[0] || r.erro || 'Não consegui ler agora.');
    } else if (r.novas || r.mudadas) {
      app.avisoCurto([r.novas && `${r.novas} ${r.novas === 1 ? 'demanda nova' : 'demandas novas'}`, r.mudadas && `${r.mudadas} ${r.mudadas === 1 ? 'mudou' : 'mudaram'}`].filter(Boolean).join(', ') + '.');
    } else if (!silencioso) {
      app.avisoCurto('Nada novo no Trello e no Notion.');
    }
    return r;
  })().finally(() => { lendo = null; });
  return lendo;
}

// Ao abrir o app: lê de novo se a última leitura tem mais de 1h (a função agendada lê a cada 2h).
export async function lerDemandasSeFaz() {
  if (!navigator.onLine) return;
  const conexoes = (await listar('conexoes')).filter((c) => ['trello', 'notion'].includes(c.servico) && c.status === 'conectado');
  if (conexoes.some((c) => !c.ultima_sincronizacao || Date.now() - Date.parse(c.ultima_sincronizacao) > UMA_HORA)) await lerDemandas({ silencioso: true });
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

export async function conectarComToken(servico, token) {
  resultado('<p class="ava-status">Conferindo o acesso…</p>');
  const r = await pedirDemandas({ acao: 'conectar', servico, token });
  if (!r.ok) {
    resultado(`<div class="ava-alerta" role="alert">${r.erro || 'Não deu certo.'}</div>`);
    app.avisoCurto(r.erro || 'Não deu certo.');
    return r;
  }
  await sincronizar();
  app.renderizar();
  app.avisoCurto(`${servico === 'trello' ? 'Trello' : 'Notion'} conectado. Lendo as demandas…`);
  lerDemandas({ silencioso: true });
  return r;
}

function conectarTrello() {
  const link = linkDoTrello(chaveDoTrello(), `${location.origin}${location.pathname}`);
  if (!link) {
    app.avisoCurto('Falta a variável TRELLO_API_KEY na Netlify.');
    return;
  }
  try { sessionStorage.setItem(PEDIDO_TRELLO, String(Date.now())); } catch { /* sem armazenamento: segue */ }
  location.href = link; // o Trello devolve para cá com "#token=..."
}

// O Trello devolveu o token no endereço (#token=...): tira do endereço na hora e conecta.
export function tokenDoTrelloNoEndereco() {
  const m = location.hash.match(/^#token=([A-Za-z0-9]+)/);
  if (!m) return null;
  history.replaceState(null, '', `${location.pathname}#configuracoes/demandas`);
  let pedido = null;
  try { pedido = sessionStorage.getItem(PEDIDO_TRELLO); sessionStorage.removeItem(PEDIDO_TRELLO); } catch { /* segue */ }
  // Pedido feito agora há pouco nesta janela: segue direto. Se o Trello voltou em outra janela
  // (acontece no app instalado), ou se o link veio de outro lugar, pergunta antes de conectar.
  if (pedido && Date.now() - Number(pedido) < 30 * 60 * 1000) return m[1];
  return window.confirm('O Trello devolveu um acesso para a Bússola. Conectar este Trello?') ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Aprovar, ajustar, descartar
// ---------------------------------------------------------------------------

async function aceitar(id, ajustes = {}) {
  const d = await obter('demandas', id);
  if (!d || d.status !== 'nova') return;
  const hoje = hojeLocal();
  const demanda = { ...d, ...ajustes, dados: { ...(d.dados || {}), ...(ajustes.dados || {}) } };
  const tarefa = await salvar('tarefas', tarefaDaDemanda(demanda, hoje));
  await salvar('demandas', { ...demanda, status: 'aceita', tarefa_id: tarefa.id, mudou: null });
  fecharFolha();
  app.avisoCurto(tarefa.data === hoje ? 'Virou tarefa de hoje.' : 'Virou tarefa.', {
    rotulo: 'Desfazer',
    fn: async () => {
      await salvar('tarefas', { ...tarefa, excluido_em: new Date().toISOString() });
      await salvar('demandas', { ...d });
    },
  });
}

// Aprovação, aprovado e "atualizar o Trello": ela já fez (sem virar tarefa).
async function feito(id) {
  const d = await obter('demandas', id);
  if (!d || d.status !== 'nova') return;
  await salvar('demandas', { ...d, status: 'aceita', dados: { ...(d.dados || {}), feito_em: new Date().toISOString() } });
  app.avisoCurto('Feito.', { rotulo: 'Desfazer', fn: () => salvar('demandas', { ...d }) });
}

async function descartar(id) {
  const d = await obter('demandas', id);
  if (!d) return;
  await salvar('demandas', { ...d, status: 'descartada' });
  app.avisoCurto('Demanda descartada.', { rotulo: 'Desfazer', fn: () => salvar('demandas', { ...d, status: 'nova' }) });
}

async function aplicarMudanca(id) {
  const d = await obter('demandas', id);
  if (!d?.mudou) return;
  const tarefa = d.tarefa_id ? await obter('tarefas', d.tarefa_id) : null;
  const novo = {};
  if (d.mudou.prazo) novo.prazo = d.mudou.prazo.para;
  if (d.mudou.titulo) novo.titulo = d.mudou.titulo.para;
  // Na tarefa, o dia de fazer acompanha o prazo novo.
  if (tarefa && !tarefa.excluido_em) await salvar('tarefas', { ...tarefa, ...novo, ...('prazo' in novo ? { data: novo.prazo } : {}) });
  await salvar('demandas', { ...d, ...novo, mudou: null });
  app.avisoCurto(tarefa && !tarefa.excluido_em ? 'Tarefa atualizada.' : 'A tarefa não existe mais; anotei a mudança.');
}

async function manterMudanca(id) {
  const d = await obter('demandas', id);
  if (d) await salvar('demandas', { ...d, mudou: null });
}

// ---------------------------------------------------------------------------
// Mensagem compartilhada ou colada
// ---------------------------------------------------------------------------

export async function demandaDeMensagem(texto, titulo = '') {
  const hoje = hojeLocal();
  const base = { origem: 'compartilhado', ...demandaDoTexto(texto, titulo), prazo: null, hora: null };
  const s = sugestaoSimples(base, hoje);
  const d = await salvar('demandas', {
    origem: 'compartilhado', origem_id: null, origem_url: null, titulo: s.titulo, detalhe: base.detalhe,
    quem: null, prazo: null, hora: null, minutos: s.minutos, prioridade: s.prioridade, status: 'nova',
    dados: { ia: false, area: s.area, motivo: '' },
  });
  fecharFolha();
  if (!navigator.onLine) {
    app.avisoCurto('Guardei nas demandas. Sem internet, a IA lê depois que você tocar em Ajustar.');
    return d;
  }
  app.avisoCurto('Lendo a mensagem…');
  const r = await pedirDemandas({ acao: 'ler', texto: base.detalhe });
  const atual = await obter('demandas', d.id);
  if (r.ok && atual?.status === 'nova') {
    const sug = aplicarSugestao(base, r.sugestao, hoje);
    await salvar('demandas', {
      ...atual, titulo: sug.titulo, prazo: sug.prazo, hora: sug.hora, minutos: sug.minutos, prioridade: sug.prioridade, quem: sug.quem,
      dados: { ...(atual.dados || {}), ia: true, area: sug.area, motivo: sug.motivo },
    });
    app.avisoCurto('Pronto: confira no card Demandas.');
  } else if (!r.ok) {
    app.avisoCurto('Guardei nas demandas. A IA não respondeu; ajuste à mão se precisar.');
  }
  return d;
}

// O que chegou pelo "Compartilhar": a Carol escolhe o destino (demanda, leitura ou caixa de entrada).
export function abrirCompartilhado(compartilhado) {
  atualizarEstado({ compartilhado });
  abrirFolha('Chegou para a Bússola', folhaCompartilhado(compartilhado));
}

async function destinoCompartilhado(destino) {
  const c = obterEstado().compartilhado;
  if (!c) return fecharFolha();
  atualizarEstado({ compartilhado: null });
  if (destino === 'demanda') {
    await demandaDeMensagem([c.texto, c.url].filter(Boolean).join('\n'), c.titulo);
  } else if (destino === 'leitura') {
    atualizarEstado({ bibPreenchido: { url: c.url, titulo: c.titulo || '', texto: c.url ? '' : c.texto }, bibFonte: c.url ? 'link' : 'texto' });
    fecharFolha();
    location.hash = '#biblioteca/novo';
  } else {
    await salvar('caixa_entrada', { texto: [c.titulo, c.texto, c.url].filter(Boolean).join('\n').slice(0, 2000) });
    fecharFolha();
    app.avisoCurto('Guardado na caixa de entrada.');
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cliques e formulários
// ---------------------------------------------------------------------------

export function cliqueDemandas(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('dem-')) return false;
  switch (acao) {
    case 'dem-ler': lerDemandas(); break;
    case 'dem-aceitar': aceitar(id); break;
    case 'dem-descartar': descartar(id); break;
    case 'dem-feito': feito(id); break;
    case 'dem-trello-quadros':
      pedirDemandas({ acao: 'trello-quadros' }).then(async (r) => {
        if (!r.ok) return app.avisoCurto(r.erro || 'Não consegui ler os quadros.');
        await sincronizar();
        app.renderizar();
        return app.avisoCurto(`${r.quadros} ${r.quadros === 1 ? 'quadro encontrado' : 'quadros encontrados'}.`);
      });
      break;
    case 'dem-ajustar':
      obter('demandas', id).then((d) => d && abrirFolha('Ajustar a demanda', formDemanda(d)));
      break;
    case 'dem-mudanca-aplicar': aplicarMudanca(id); break;
    case 'dem-mudanca-manter': manterMudanca(id); break;
    case 'dem-todas':
      atualizarEstado({ demandasTodas: !obterEstado().demandasTodas });
      app.renderizar();
      break;
    case 'dem-colar': abrirFolha('Colar mensagem', formColar()); break;
    case 'dem-comp-demanda': destinoCompartilhado('demanda'); break;
    case 'dem-comp-leitura': destinoCompartilhado('leitura'); break;
    case 'dem-comp-caixa': destinoCompartilhado('caixa'); break;
    case 'dem-trello-conectar': conectarTrello(); break;
    case 'dem-bases-atualizar':
      pedirDemandas({ acao: 'bases' }).then(async (r) => {
        if (!r.ok) return app.avisoCurto(r.erro || 'Não consegui ler as bases.');
        await sincronizar();
        app.renderizar();
        return app.avisoCurto(r.disponiveis.length ? `${r.disponiveis.length} ${r.disponiveis.length === 1 ? 'base liberada' : 'bases liberadas'}.` : 'Nenhuma base liberada ainda.');
      });
      break;
    case 'dem-desconectar': {
      const servico = alvo.dataset.servico;
      const nome = servico === 'trello' ? 'o Trello' : 'o Notion';
      if (!window.confirm(`Desconectar ${nome}? O acesso guardado é apagado. As demandas que já viraram tarefa continuam.`)) break;
      desconectar(servico).then(async (r) => {
        if (!r.ok) return app.avisoCurto(r.erro || 'Não foi possível desconectar agora.');
        await sincronizar();
        app.renderizar();
        return app.avisoCurto(`${servico === 'trello' ? 'Trello' : 'Notion'} desconectado.`);
      });
      break;
    }
    default:
      return false;
  }
  return true;
}

// Trocou o quadro dos designers: listas e etiquetas acompanham, sem perder o que já foi marcado.
export function mudancaDemandas(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'dem-designers') return false;
  if (tipo !== 'change') return true;
  const form = alvo.closest('form');
  const quadros = (obterEstado().conexoes || []).find((c) => c.servico === 'trello')?.detalhe?.quadros || [];
  const q = quadros.find((x) => x.id === alvo.value) || null;
  form.elements.aprovacao.innerHTML = opcoesListas(q, '', /^\s*aprova[cç][aã]o\s*$/i);
  form.elements.aprovado.innerHTML = opcoesListas(q, '', /^\s*aprovad[oa]s?\s*$/i);
  form.querySelectorAll('.dem-cliente').forEach((linha) => {
    const quadro = quadros.find((x) => x.id === linha.dataset.quadro);
    linha.hidden = linha.dataset.quadro === alvo.value; // o quadro dos designers não é de cliente
    linha.querySelector('select').innerHTML = opcoesEtiquetas(q, sugerirEtiqueta(q?.etiquetas, quadro?.nome));
  });
  return true;
}

export function enviarDemandas(form) {
  const tipo = form.dataset.form;
  if (!tipo?.startsWith('dem-')) return false;
  if (tipo === 'dem-token') {
    const token = form.elements.token.value.trim();
    form.elements.token.value = ''; // o segredo não fica na tela
    if (token) conectarComToken(form.dataset.servico, token);
    return true;
  }
  if (tipo === 'dem-trello-config') {
    const designers = form.elements.designers.value;
    const clientes = [...form.querySelectorAll('input[name="cliente"]:checked')]
      .filter((i) => i.value !== designers)
      .map((i) => ({ id: i.value, etiqueta: form.elements[`etiqueta-${i.value}`]?.value || '' }));
    pedirDemandas({ acao: 'trello-config', designers: { id: designers, aprovacao: form.elements.aprovacao.value, aprovado: form.elements.aprovado.value }, clientes }).then(async (r) => {
      if (!r.ok) return app.avisoCurto(r.erro || 'Não deu para salvar.');
      await sincronizar();
      app.renderizar();
      lerDemandas({ silencioso: true });
      return app.avisoCurto(`Salvo: ${r.config.clientes.length} ${r.config.clientes.length === 1 ? 'cliente' : 'clientes'}${r.config.designers ? ' e o quadro dos designers' : ''}. Lendo…`);
    });
    return true;
  }
  if (tipo === 'dem-bases') {
    const bases = [...form.querySelectorAll('input[name="base"]:checked')].map((i) => i.value);
    const termos = String(form.elements.termos?.value || '').split(',').map((t) => t.trim()).filter(Boolean);
    pedirDemandas({ acao: 'escolher', bases, termos }).then(async (r) => {
      if (!r.ok) return app.avisoCurto(r.erro || 'Não deu para salvar.');
      await sincronizar();
      app.renderizar();
      lerDemandas({ silencioso: true });
      return app.avisoCurto(`${r.bases.length} ${r.bases.length === 1 ? 'base escolhida' : 'bases escolhidas'}. Lendo…`);
    });
    return true;
  }
  if (tipo === 'dem-colar') {
    const texto = form.elements.texto.value.trim();
    if (!texto) form.elements.texto.focus();
    else demandaDeMensagem(texto);
    return true;
  }
  if (tipo === 'dem-ajustar') {
    const f = new FormData(form);
    const titulo = String(f.get('titulo') || '').trim();
    if (!titulo) {
      form.elements.titulo.focus();
      return true;
    }
    aceitar(form.dataset.id, {
      titulo,
      prazo: f.get('prazo') || null,
      hora: f.get('hora') || null,
      minutos: Number(f.get('minutos')) || null,
      prioridade: Number(f.get('prioridade')) || 0,
      dados: { area: f.get('area') },
    });
    return true;
  }
  return false;
}
