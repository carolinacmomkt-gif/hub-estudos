// Grupo Trabalho: cliques, formulários, arrastar no Aprovar e a sincronização em partes.
// O que muda no Notion ou no Trello passa pela função "trabalho" (com a trava); o caminho da arte
// (mandei, agendei), a memória e os rascunhos são gravados aqui e sincronizam como o resto.

import { obterEstado, atualizarEstado } from './estado.js';
import { sincronizar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { chamar } from './funcoes.js';
import { iniciarFoco } from './foco.js';
import { dataLocal } from './views-dia.js';
import { pecasAtivas, clientePelaChave, segundaDe, somarDias, MODELOS, FORMATOS, revisar, clienteDeSaude, statusInicial, ETAPAS } from './dados-trabalho.js';
import { listaAlertas } from './views-trabalho.js';
import { confirmar } from './confirmar.js';

let app;
const pedir = (corpo) => chamar('trabalho', corpo);
const peca = (id) => pecasAtivas(obterEstado()).find((p) => p.id === id);
const avisar = (t, extra) => app.avisoCurto(t, extra);

export function ligarTrabalho(funcoes) {
  app = funcoes;
  document.addEventListener('pointerdown', aoApertar);
  document.addEventListener('pointermove', aoMover, { passive: false });
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', aoCancelar);
}

function mostrarErro(form, texto) {
  const caixa = form?.querySelector('[data-erro]');
  if (!caixa) return;
  caixa.textContent = texto || '';
  caixa.hidden = !texto;
}

async function copiar(texto, aviso = 'Copiado.') {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(aviso);
  } catch {
    avisar('Não consegui copiar. Segure o texto para copiar.');
  }
}

// ---------------------------------------------------------------------------
// Sincronizar (clientes, um calendário por vez, Trello)
// ---------------------------------------------------------------------------

let sincronizando = false;
export async function sincronizarTrabalho({ silencioso = false } = {}) {
  if (sincronizando) return;
  sincronizando = true;
  const erros = [];
  try {
    const r = await pedir({ acao: 'partes' });
    if (!r.ok) { if (!silencioso) avisar(r.erro || 'Não deu para sincronizar agora.'); return; }
    const sit = await pedir({ acao: 'situacao' });
    if (sit.ok) atualizarEstado({ trabSituacao: sit, trabCalendarios: sit.calendarios });
    for (const [i, parte] of r.partes.entries()) {
      atualizarEstado({ trabSync: `${i + 1} de ${r.partes.length}` });
      if (!silencioso) app.renderizar();
      const x = await pedir({ acao: 'sincronizar', parte, ultima: i === r.partes.length - 1 });
      if (!x.ok) erros.push(x.erro);
      else if (x.erros?.length) erros.push(...x.erros);
    }
    await sincronizar();
    try { localStorage.setItem('hub.trabalho.ultima', String(Date.now())); } catch { /* sem armazenamento: sincroniza de novo na próxima */ }
    if (!silencioso) avisar(erros.length ? `Sincronizado, com ${erros.length} ${erros.length === 1 ? 'aviso' : 'avisos'}: ${erros[0]}` : 'Trabalho sincronizado.');
  } finally {
    sincronizando = false;
    atualizarEstado({ trabSync: null });
    app.renderizar();
  }
}

// Ao abrir uma tela do Trabalho: sincroniza sozinho se faz mais de 1h (sem travar a tela).
export function montarTrabalho() {
  const estado = obterEstado();
  const c = (estado.conexoes || []).find((x) => x.servico === 'notion_trabalho');
  if (c?.status !== 'conectado' || !navigator.onLine) return;
  if (!estado.trabCalendarios) pedir({ acao: 'situacao' }).then((s) => { if (s.ok) { atualizarEstado({ trabSituacao: s, trabCalendarios: s.calendarios }); if (obterEstado().rota === 'criar') app.renderizar(); } });
  let local = 0;
  try { local = Number(localStorage.getItem('hub.trabalho.ultima')) || 0; } catch { /* sem armazenamento */ }
  const ultima = Math.max(c.ultima_sincronizacao ? Date.parse(c.ultima_sincronizacao) : 0, local);
  if (Date.now() - ultima > 60 * 60 * 1000) sincronizarTrabalho({ silencioso: true });
}

// ---------------------------------------------------------------------------
// O caminho da arte
// ---------------------------------------------------------------------------

async function mudarFluxo(p, campos) {
  await gravar('conteudos', 'conteudos', { ...p, dados: { ...(p.dados || {}), fluxo: { ...(p.dados?.fluxo || {}), ...campos } } });
}

async function guardarNaMemoria(chave, texto, origem) {
  const c = clientePelaChave(obterEstado(), chave);
  if (!c || !texto.trim()) return;
  const item = { id: crypto.randomUUID().slice(0, 8), texto: texto.trim().slice(0, 300), em: new Date().toISOString(), origem };
  await gravar('clientes_trabalho', 'clientesTrabalho', { ...c, dados: { ...(c.dados || {}), memoria: [...(c.dados?.memoria || []), item].slice(-60) } });
}

async function moverParaEtapa(p, etapa) {
  if (etapa === 'mandei' || etapa === 'cliente') {
    await mudarFluxo(p, { enviadoEm: new Date().toISOString() });
    avisar('Com o cliente. Quando ele responder, toque em Aprovou ou Ajuste.');
  } else if (etapa === 'voltar') {
    await mudarFluxo(p, { enviadoEm: null });
    avisar('Voltou para você.');
  } else if (etapa === 'agendei') {
    await mudarFluxo(p, { agendadoEm: new Date().toISOString() });
    avisar('Agendada. Saiu do Aprovar.');
  } else if (etapa === 'aprovou' || etapa === 'agendar') {
    const r = await pedir({ acao: 'mudar', id: p.id, etapa: 'aprovou' });
    if (!r.ok) return avisar(r.erro);
    await mudarFluxo({ ...(peca(p.id) || p), ...(r.campos || {}) }, { aprovadoEm: new Date().toISOString(), rodadas: (p.dados?.fluxo?.rodadas || 0) + 1 });
    await sincronizar();
    avisar('Aprovada. Falta agendar no quadro do cliente.');
  } else if (etapa === 'ajuste' || etapa === 'design') {
    const pedido = await perguntarAjuste(p);
    if (pedido === null) return;
    const r = await pedir({ acao: 'mudar', id: p.id, etapa: 'ajuste' });
    if (!r.ok) return avisar(r.erro);
    if (pedido) {
      await pedir({ acao: 'comentar', id: p.id, texto: `Ajuste pedido pelo cliente: ${pedido}` });
      await guardarNaMemoria(p.cliente, pedido, `ajuste em ${p.titulo}`);
    }
    await mudarFluxo({ ...(peca(p.id) || p), ...(r.campos || {}) }, { enviadoEm: null, rodadas: (p.dados?.fluxo?.rodadas || 0) + 1 });
    await sincronizar();
    avisar('Voltou para a designer com o pedido de ajuste.');
  }
  app.renderizar();
}

async function perguntarAjuste(p) {
  const { perguntarTexto } = await import('./confirmar.js');
  const t = await perguntarTexto(`O que ${p.cliente_nome || 'o cliente'} pediu para ajustar?`, { maximo: 300 });
  return t === null || t === undefined ? null : String(t);
}

// ---------------------------------------------------------------------------
// Arrastar no Aprovar
// ---------------------------------------------------------------------------

let arraste = null;
function aoApertar(e) {
  const alca = e.target.closest?.('[data-tb-arrastar]');
  if (!alca || e.button > 0) return;
  const cartao = alca.closest('.tb-arte');
  e.preventDefault();
  try { alca.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
  arraste = { id: alca.dataset.tbArrastar, cartao, ponteiro: e.pointerId, x0: e.clientX, y0: e.clientY, moveu: false, coluna: null, de: cartao.closest('.tb-coluna')?.dataset.etapa };
  cartao.classList.add('arrastando');
}
function aoMover(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  e.preventDefault();
  const dx = e.clientX - arraste.x0;
  const dy = e.clientY - arraste.y0;
  if (Math.abs(dx) + Math.abs(dy) > 4) arraste.moveu = true;
  arraste.cartao.style.transform = `translate(${dx}px, ${dy}px)`;
  arraste.cartao.style.pointerEvents = 'none';
  const coluna = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tb-coluna');
  arraste.cartao.style.pointerEvents = '';
  document.querySelectorAll('.tb-coluna.alvo').forEach((c) => c !== coluna && c.classList.remove('alvo'));
  if (coluna) coluna.classList.add('alvo');
  arraste.coluna = coluna?.dataset.etapa || null;
}
function terminar() {
  const a = arraste;
  arraste = null;
  if (!a) return null;
  a.cartao.classList.remove('arrastando');
  a.cartao.style.transform = '';
  document.querySelectorAll('.tb-coluna.alvo').forEach((c) => c.classList.remove('alvo'));
  return a;
}
function aoSoltar(e) {
  if (!arraste || e.pointerId !== arraste.ponteiro) return;
  const a = terminar();
  if (!a.moveu || !a.coluna || a.coluna === a.de) return;
  const p = peca(a.id);
  if (!p) return;
  const ordem = ETAPAS.map((x) => x.id);
  // Só anda pelo caminho: design → você (só a designer move) · você → cliente · cliente → agendar ou volta ao design.
  if (a.de === 'voce' && a.coluna === 'cliente') moverParaEtapa(p, 'mandei');
  else if (a.de === 'cliente' && a.coluna === 'agendar') moverParaEtapa(p, 'aprovou');
  else if (a.de === 'cliente' && a.coluna === 'design') moverParaEtapa(p, 'ajuste');
  else if (a.coluna === 'agendar' && a.de === 'voce') avisar('Primeiro mande ao cliente e espere o ok.');
  else if (ordem.indexOf(a.coluna) < ordem.indexOf(a.de) && a.coluna !== 'design') moverParaEtapa(p, a.coluna === 'voce' ? 'voltar' : a.coluna);
  else avisar('Essa passagem é da designer, no quadro dela.');
}
function aoCancelar(e) {
  if (arraste && e.pointerId === arraste.ponteiro) terminar();
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

function lerCriar(form) {
  const f = form || document.querySelector('[data-form="tb-criar"]');
  if (!f) return obterEstado().criar || {};
  const c = f.elements;
  return { ...(obterEstado().criar || {}), cliente: c.cliente.value, formato: c.formato.value, objetivo: c.objetivo.value, tema: c.tema.value, texto: c.texto.value, calendario: c.calendario?.value, data: c.data?.value, titulo: c.titulo?.value };
}

function atualizarRevisor(r) {
  const cli = clientePelaChave(obterEstado(), r.cliente);
  const alertas = revisar(r.texto || '', { saude: cli ? clienteDeSaude(cli.nome, cli.dados?.nicho) : false });
  const lista = document.querySelector('[data-tb-revisor]');
  if (lista) lista.innerHTML = listaAlertas(alertas);
  const total = document.querySelector('[data-tb-revisor-total]');
  if (total) total.textContent = `Revisor · ${alertas.length} ${alertas.length === 1 ? 'ponto' : 'pontos'}`;
}

let esperaRevisor = null;
export function mudancaTrabalho(alvo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'tb-criar-texto' || acao === 'tb-criar-campo') {
    const r = lerCriar(alvo.form);
    atualizarEstado({ criar: r });
    clearTimeout(esperaRevisor);
    esperaRevisor = setTimeout(() => atualizarRevisor(r), 250);
    if (acao === 'tb-criar-campo' && alvo.name === 'cliente') app.renderizar();
    return true;
  }
  return false;
}

async function guardarRascunho(r, { avisar: comAviso = true } = {}) {
  if (!r.texto?.trim() && !r.tema?.trim()) return null;
  const atual = r.rascunhoId ? (obterEstado().rascunhos || []).find((x) => x.id === r.rascunhoId) : null;
  const salvo = await gravar('rascunhos', 'rascunhos', { ...(atual || {}), cliente: r.cliente || null, formato: r.formato, objetivo: r.objetivo, tema: r.tema, texto: r.texto, dados: { calendario: r.calendario || null, data: r.data || null, titulo: r.titulo || null } });
  atualizarEstado({ criar: { ...r, rascunhoId: salvo.id } });
  if (comAviso) avisar('Rascunho guardado.');
  return salvo;
}

async function pedirIa(pedido) {
  const r = lerCriar();
  if (pedido === 'criar' && !r.tema?.trim()) return avisar('Escreva o tema primeiro.');
  if (pedido !== 'criar' && !r.texto?.trim()) return avisar('Escreva ou gere o texto primeiro.');
  atualizarEstado({ criar: r, criarStatus: 'A IA está escrevendo… (leva uns segundos)' });
  app.renderizar();
  const x = await pedir({ acao: 'ia', pedido, cliente: r.cliente, formato: r.formato, objetivo: r.objetivo, tema: r.tema, texto: r.texto });
  if (!x.ok) {
    atualizarEstado({ criarStatus: x.erro });
    return app.renderizar();
  }
  const novo = pedido === 'criar' ? x.texto : pedido === 'gancho' ? `${r.texto}\n\n## Opções de gancho (IA)\n${x.texto}` : `${r.texto}\n\n## Pedido da arte (IA)\n${x.texto}`;
  atualizarEstado({ criar: { ...r, texto: novo }, criarStatus: 'Pronto. Revise antes de mandar: a IA erra.' });
  app.renderizar();
  guardarRascunho({ ...r, texto: novo }, { avisar: false });
}

// ---------------------------------------------------------------------------
// Cliques
// ---------------------------------------------------------------------------

export function cliqueTrabalho(alvo) {
  const { acao, id, valor } = alvo.dataset;
  if (!acao?.startsWith('tb-')) return false;
  const estado = obterEstado();
  switch (acao) {
    case 'tb-sincronizar':
      sincronizarTrabalho();
      return true;
    case 'tb-visao':
      atualizarEstado({ trabVisao: valor });
      app.renderizar();
      return true;
    case 'tb-semana': {
      const passo = Number(alvo.dataset.passo);
      const hoje = segundaDe(dataLocal());
      atualizarEstado({ trabSemana: passo ? somarDias(estado.trabSemana || hoje, passo) : hoje });
      app.renderizar();
      return true;
    }
    case 'tb-casa':
      atualizarEstado({ trabCasa: valor || '', trabCliente: '' });
      app.renderizar();
      return true;
    case 'tb-cliente':
      atualizarEstado({ trabCliente: estado.trabCliente === valor ? '' : valor });
      app.renderizar();
      return true;
    case 'tb-aba':
      atualizarEstado({ aprovarAba: valor });
      app.renderizar();
      return true;
    case 'tb-copiar':
      copiar(alvo.dataset.texto, 'Mensagem copiada. Cole no WhatsApp.');
      return true;
    case 'tb-etapa': {
      const p = peca(id);
      if (p) moverParaEtapa(p, valor);
      return true;
    }
    case 'tb-mudou-visto': {
      const lista = id ? [peca(id)].filter(Boolean) : pecasAtivas(estado).filter((p) => p.dados?.mudanca && !p.dados.mudanca.visto);
      Promise.all(lista.map((p) => gravar('conteudos', 'conteudos', { ...p, dados: { ...p.dados, mudanca: { ...p.dados.mudanca, visto: true } } }))).then(() => app.renderizar());
      return true;
    }
    case 'tb-ler-texto':
      avisar('Lendo o texto no Notion…');
      pedir({ acao: 'texto', id }).then(async (r) => {
        if (!r.ok) return avisar(r.erro);
        await sincronizar();
        app.renderizar();
        return null;
      });
      return true;
    case 'tb-focar': {
      const p = peca(id);
      if (p) { iniciarFoco({ titulo: `${p.titulo} · ${p.cliente_nome || ''}`.slice(0, 140) }); location.hash = '#foco'; }
      return true;
    }
    case 'tb-criar-de': {
      const p = peca(id);
      if (!p) return true;
      atualizarEstado({ criar: { cliente: p.cliente, formato: FORMATOS.find((f) => (p.formato || '').toLowerCase().includes(f.split(' ')[0].toLowerCase())) || FORMATOS[0], objetivo: p.dados?.objetivo || 'Educação', tema: p.titulo, texto: p.texto || '', titulo: p.titulo, calendario: p.origem === 'notion' ? p.fonte : '', data: p.data || '' }, criarStatus: '' });
      location.hash = '#criar';
      return true;
    }
    case 'tb-criar-para':
      atualizarEstado({ criar: { ...(estado.criar || {}), cliente: valor, texto: estado.criar?.cliente === valor ? estado.criar?.texto || '' : '' }, criarStatus: '' });
      location.hash = '#criar';
      return true;
    case 'tb-modelo': {
      const r = lerCriar();
      const modelo = MODELOS[r.formato] || '';
      const aplicar = () => { atualizarEstado({ criar: { ...r, texto: modelo } }); app.renderizar(); };
      if (r.texto?.trim()) confirmar('Trocar o texto pelo modelo do formato? O texto atual sai (guarde um rascunho antes, se quiser).', { botao: 'Trocar' }).then((ok) => ok && aplicar());
      else aplicar();
      return true;
    }
    case 'tb-ia':
      pedirIa(valor);
      return true;
    case 'tb-rascunho-novo':
      atualizarEstado({ criar: {}, criarStatus: '' });
      app.renderizar();
      return true;
    case 'tb-rascunho-guardar':
      guardarRascunho(lerCriar());
      return true;
    case 'tb-rascunho-abrir': {
      const x = (estado.rascunhos || []).find((r) => r.id === id);
      if (x) { atualizarEstado({ criar: { rascunhoId: x.id, cliente: x.cliente || '', formato: x.formato, objetivo: x.objetivo, tema: x.tema, texto: x.texto, ...(x.dados || {}) }, criarStatus: '' }); app.renderizar(); }
      alvo.closest('details')?.removeAttribute('open');
      return true;
    }
    case 'tb-memoria-tirar': {
      const c = clientePelaChave(estado, alvo.dataset.cliente);
      if (c) gravar('clientes_trabalho', 'clientesTrabalho', { ...c, dados: { ...c.dados, memoria: (c.dados?.memoria || []).filter((m) => m.id !== id) } }).then(() => app.renderizar());
      return true;
    }
    case 'tb-desconectar':
      confirmar('Desconectar o Notion do trabalho? O segredo é apagado; as peças copiadas ficam até a próxima conexão.', { botao: 'Desconectar', perigo: true }).then(async (ok) => {
        if (!ok) return;
        const r = await pedir({ acao: 'desconectar' });
        await sincronizar();
        avisar(r.ok ? 'Notion do trabalho desconectado.' : r.erro);
        app.renderizar();
      });
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

export function enviarTrabalho(form) {
  const tipo = form.dataset.form;
  if (!tipo?.startsWith('tb-')) return false;
  mostrarErro(form, '');
  const c = form.elements;
  switch (tipo) {
    case 'tb-conectar': {
      const token = c.token.value.trim();
      if (!token) { mostrarErro(form, 'Cole o segredo do Notion.'); return true; }
      form.querySelector('[type=submit]').disabled = true;
      pedir({ acao: 'conectar', token }).then(async (r) => {
        form.querySelector('[type=submit]').disabled = false;
        if (!r.ok) return mostrarErro(form, r.erro);
        c.token.value = '';
        await sincronizar();
        avisar('Notion do trabalho conectado. Copiando os calendários…');
        app.renderizar();
        sincronizarTrabalho();
        return null;
      });
      return true;
    }
    case 'tb-mudar': {
      const p = peca(form.dataset.id);
      if (!p) return true;
      const corpo = { acao: 'mudar', id: p.id };
      if (c.status && c.status.value !== p.status) corpo.status = c.status.value;
      if (c.data && (c.data.value || null) !== (p.data || null)) corpo.data = c.data.value || null;
      if (Object.keys(corpo).length === 2) { avisar('Nada mudou.'); return true; }
      form.querySelector('[type=submit]').disabled = true;
      pedir(corpo).then(async (r) => {
        form.querySelector('[type=submit]').disabled = false;
        if (!r.ok) return mostrarErro(form, r.erro);
        await sincronizar();
        avisar(`Salvo no ${p.origem === 'trello' ? 'Trello' : 'Notion'}.`);
        app.renderizar();
        return null;
      });
      return true;
    }
    case 'tb-comentar': {
      const p = peca(form.dataset.id);
      const texto = c.texto.value.trim();
      if (!p || !texto) { mostrarErro(form, 'Escreva o comentário.'); return true; }
      pedir({ acao: 'comentar', id: p.id, texto }).then(async (r) => {
        if (!r.ok) return mostrarErro(form, r.erro);
        if (c.memoria.checked) await guardarNaMemoria(p.cliente, texto, `comentário em ${p.titulo}`);
        c.texto.value = '';
        avisar(c.memoria.checked ? 'Comentado e guardado na memória.' : 'Comentado.');
        app.renderizar();
        return null;
      });
      return true;
    }
    case 'tb-memoria': {
      const texto = c.texto.value.trim();
      if (!texto) return true;
      guardarNaMemoria(form.dataset.cliente, texto, 'anotado por você').then(() => { avisar('Guardado. A IA segue nos próximos pedidos.'); app.renderizar(); });
      return true;
    }
    case 'tb-criar': {
      const r = lerCriar(form);
      atualizarEstado({ criar: r });
      if (!r.calendario) { mostrarErro(form, 'Escolha o calendário (sincronize o Trabalho, se a lista estiver vazia).'); return true; }
      if (!(r.titulo || r.tema)?.trim()) { mostrarErro(form, 'Dê um título à peça.'); return true; }
      form.querySelector('[type=submit]').disabled = true;
      pedir({ acao: 'criar', calendario: r.calendario, titulo: (r.titulo || r.tema).trim(), data: r.data || null, formato: r.formato, texto: r.texto || '', cliente: r.cliente || null, status: statusInicial(r.formato) }).then(async (x) => {
        form.querySelector('[type=submit]').disabled = false;
        if (!x.ok) return mostrarErro(form, x.erro);
        const rascunho = await guardarRascunho(r, { avisar: false });
        if (rascunho && x.id) await gravar('rascunhos', 'rascunhos', { ...rascunho, conteudo_id: x.id });
        await sincronizar();
        avisar('Peça criada no calendário do Notion.', x.id ? { rotulo: 'Abrir', fn: () => { location.hash = `#conteudo/${x.id}`; } } : undefined);
        app.renderizar();
        return null;
      });
      return true;
    }
    default:
      return false;
  }
}
