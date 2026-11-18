// Ações da R7 (etapa 1, Carol 16/11/2026): criar e salvar a ficha, guardar e mostrar os acessos
// (pela função r7-acessos; a senha nunca fica no aparelho), memória, leitura da voz com a IA
// (r7-voz-background + linha em importacoes) e o checador de voz ao vivo.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar, excluir } from './persistencia.js';
import { rodarAutomaticoR7, completarFichas } from './r7-automatico.js';
import { montarArtes, montarPrevia } from './eventos-cronograma.js';
import { chamar, dispararSegundoPlano } from './funcoes.js';
import { rest, idDaUsuaria } from './nuvem.js';
import { confirmar } from './confirmar.js';
import { idPeloNome } from './especialidades.js';
import {
  conferirFichaR7, fichaEmTexto, nichoDaFicha, chaveDoNome, conferirVoz, diferencaDaVoz, fontesDaVoz, checarVoz, CAMPOS_VOZ, LISTAS_VOZ, fichaR7Vazia,
} from './dados-r7.js';
import { clientesR7, fichaDe, resultadoVoz } from './views-r7.js';

let app; // { renderizar, avisoCurto }
let esconderEm = null;
const lendoAcessos = new Set(); // uma leitura por vez para cada cliente (o redesenho não pede de novo)

export function ligarR7(funcoes) {
  app = funcoes;
  try { atualizarEstado({ r7Aba: localStorage.getItem('hub.r7.aba') || 'identificacao' }); } catch { /* fica em Identificação */ }
}

const cliente = (chave) => clientesR7(obterEstado()).find((c) => c.chave === chave) || null;

// Ao abrir a ficha na aba Acessos, lê a lista (só os nomes) uma vez.
export function montarR7(parametro) {
  rodarAutomaticoR7(app);
  montarArtes();
  montarPrevia();
  const p = parametro || '';
  if (!p.startsWith('cliente:')) return;
  const chave = p.slice(8);
  if (obterEstado().r7Aba === 'acessos' && !obterEstado().r7Acessos?.[chave]) lerAcessos(chave);
}

async function gravarCliente(c, mudar) {
  const dados = { ...(c.dados || {}) };
  mudar(dados);
  if (dados.r7) {
    dados.r7 = conferirFichaR7(dados.r7);
    dados.ficha = fichaEmTexto(c.nome, dados.r7);
    const nicho = nichoDaFicha(dados.r7);
    if (nicho) dados.nicho = nicho;
  }
  await salvar('clientes_trabalho', { ...c, casa: 'r7', dados });
  atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho') });
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const val = (form, nome) => form.elements[nome]?.value ?? '';
const marcados = (form, nome) => [...form.querySelectorAll(`[name="${nome}"]:checked`)].map((x) => x.value);

function secaoDoForm(form, secao, atual) {
  if (secao === 'identificacao') {
    return { ...atual, identificacao: {
      assinatura: val(form, 'assinatura'), especialidade: idPeloNome(val(form, 'especialidade')), instagram: val(form, 'instagram'),
      cidade: val(form, 'cidade'), perfil: val(form, 'perfil'),
    } };
  }
  if (secao === 'briefing') {
    const b = {};
    for (const k of ['publico', 'tom', 'pode', 'naoPode', 'diferenciais', 'procedimentos', 'cta', 'agendamento', 'inspiracoes', 'idVisual', 'observacoes']) b[k] = val(form, k);
    return { ...atual, briefing: b };
  }
  if (secao === 'rotina') {
    const dias = marcados(form, 'feed-dia').map(Number);
    const storiesDias = {};
    for (let d = 1; d <= 6; d += 1) { const m = val(form, `story-${d}`); if (m) storiesDias[d] = m; }
    return { ...atual, rotina: {
      feed: dias.map((d) => ({ dia: d, formato: val(form, `feed-formato-${d}`), qtd: Number(val(form, `feed-qtd-${d}`)) || 1 })),
      stories: { tem: form.elements['stories-tem']?.checked, dias: storiesDias },
      formatosPreferidos: marcados(form, 'formatosPreferidos'), naoGosta: val(form, 'naoGosta'),
      videos: { tipos: marcados(form, 'videos-tipos'), preferidos: marcados(form, 'videos-preferidos'), porSemana: Number(val(form, 'videos-porSemana')) },
      estilo: { visual: marcados(form, 'estilo-visual'), conteudo: marcados(form, 'estilo-conteudo'), corDestaque: val(form, 'estilo-cor') === '#888888' ? '' : val(form, 'estilo-cor') },
      grupo: val(form, 'grupo'), aprovacao: val(form, 'aprovacao'),
    } };
  }
  if (secao === 'equipe') {
    return { ...atual, equipe: { quadro: val(form, 'quadro'), designer: val(form, 'designer'), lista: val(form, 'lista') }, contato: { grupo: val(form, 'grupo'), aprova: val(form, 'aprova') } };
  }
  if (secao === 'links') return { ...atual, links: { drive: val(form, 'drive'), videos: val(form, 'videos'), ultimoCronograma: val(form, 'ultimoCronograma') } };
  return atual;
}

async function salvarSecao(form) {
  const c = cliente(form.dataset.cliente);
  if (!c) return;
  const secao = form.dataset.secao;
  const novoNome = secao === 'identificacao' ? val(form, 'nome').replace(/\s+/g, ' ').trim() : '';
  if (secao === 'identificacao' && !novoNome) { app.avisoCurto('O cliente precisa de um nome.'); return; }
  if (secao === 'identificacao' && val(form, 'especialidade').trim() && !idPeloNome(val(form, 'especialidade'))) {
    app.avisoCurto(`Não achei "${val(form, 'especialidade').trim()}" na lista de especialidades. Digite parte do nome e escolha uma sugestão.`);
    return;
  }
  const base = novoNome ? { ...c, nome: novoNome } : c;
  await gravarCliente(base, (d) => { d.r7 = secaoDoForm(form, secao, fichaDe(c)); });
  app.avisoCurto('Ficha salva.');
}

async function criarCliente(form) {
  const nome = val(form, 'nome').replace(/\s+/g, ' ').trim();
  const erro = form.querySelector('[data-erro]');
  if (nome.length < 2) { erro.textContent = 'Escreva o nome do cliente.'; erro.hidden = false; return; }
  const espTexto = val(form, 'especialidade').trim();
  const esp = idPeloNome(espTexto);
  if (espTexto && !esp) { erro.textContent = `Não achei "${espTexto}" na lista. Digite parte do nome e escolha uma sugestão.`; erro.hidden = false; return; }
  const usadas = new Set((obterEstado().clientesTrabalho || []).map((c) => c.chave));
  let chave = `r7-${chaveDoNome(nome)}`;
  for (let i = 2; usadas.has(chave); i += 1) chave = `r7-${chaveDoNome(nome)}-${i}`;
  const r7 = fichaR7Vazia();
  r7.identificacao.especialidade = esp;
  const novo = { chave, nome, casa: 'r7', dados: {} };
  await gravarCliente(novo, (d) => { d.r7 = r7; d.memoria = []; });
  // Completa sozinha o que der com o briefing e o Portfolio dos Clientes no Trello (só campos vazios).
  const completou = await completarFichas({ so: chave }).catch(() => 0);
  location.hash = `#r7/cliente:${chave}`;
  if (completou) app.avisoCurto('Ficha completada com o briefing e o Trello da R7. Confira.');
}

async function salvarConfig(form) {
  const linhas = await listar('config', { incluirExcluidos: true });
  const atual = linhas.find((l) => l.chave === 'r7');
  const valor = {
    ...(atual?.excluido_em ? {} : atual?.valor || {}),
    limite: Math.max(1, Number(val(form, 'limite')) || 10),
    quadros: val(form, 'quadros').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12),
    grupoGestao: val(form, 'grupoGestao').trim().slice(0, 120),
  };
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'r7', valor });
  atualizarEstado({ config: await listar('config') });
  app.avisoCurto('Ajustes da R7 salvos.');
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Acessos (pela função; nada fica guardado no aparelho)
// ---------------------------------------------------------------------------

function mudarAcessos(chave, campos) {
  atualizarEstado({ r7Acessos: { ...(obterEstado().r7Acessos || {}), [chave]: campos } });
  app.renderizar();
}

async function lerAcessos(chave) {
  if (!chave || lendoAcessos.has(chave)) return;
  lendoAcessos.add(chave);
  try {
    const r = await chamar('r7-acessos', { acao: 'listar', cliente: chave });
    mudarAcessos(chave, r.ok ? { lista: r.acessos || [] } : { lista: [], erro: r.erro || 'Não consegui ler os acessos agora.' });
  } finally {
    lendoAcessos.delete(chave);
  }
}

async function guardarAcesso(form) {
  const chave = form.dataset.cliente;
  const corpo = { acao: 'gravar', cliente: chave, rotulo: val(form, 'rotulo').trim(), usuario: val(form, 'usuario'), senha: val(form, 'senha'), observacao: val(form, 'observacao') };
  if (!corpo.rotulo) { app.avisoCurto('Dê um nome ao acesso (ex.: Instagram).'); return; }
  const r = await chamar('r7-acessos', corpo);
  if (!r.ok) { app.avisoCurto(r.erro || 'Não consegui guardar agora.'); return; }
  form.reset();
  app.avisoCurto('Acesso guardado com segurança.');
  await lerAcessos(chave);
}

function esconder() {
  clearTimeout(esconderEm);
  esconderEm = null;
  if (obterEstado().r7AcessoVisivel) { atualizarEstado({ r7AcessoVisivel: null }); app.renderizar(); }
}

async function mostrarAcesso(id) {
  const r = await chamar('r7-acessos', { acao: 'mostrar', id });
  if (!r.ok) { app.avisoCurto(r.erro || 'Não consegui abrir agora.'); return; }
  atualizarEstado({ r7AcessoVisivel: r.acesso });
  app.renderizar();
  clearTimeout(esconderEm);
  esconderEm = setTimeout(esconder, 30 * 1000);
}

async function apagarAcesso(id) {
  const chave = obterEstado().parametro?.slice(8);
  if (!(await confirmar('Excluir este acesso? Ele sai do servidor e não dá para recuperar.', { botao: 'Excluir', perigo: true }))) return;
  const r = await chamar('r7-acessos', { acao: 'apagar', id });
  if (!r.ok) { app.avisoCurto(r.erro || 'Não consegui excluir agora.'); return; }
  if (obterEstado().r7AcessoVisivel?.id === id) esconder();
  if (chave) await lerAcessos(chave);
}

// ---------------------------------------------------------------------------
// Memória e textos colados para a voz
// ---------------------------------------------------------------------------

async function guardarMemoria(form) {
  const c = cliente(form.dataset.cliente);
  const textoNovo = val(form, 'texto').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!c || !textoNovo) return;
  await gravarCliente(c, (d) => { d.memoria = [...(d.memoria || []), { id: crypto.randomUUID(), texto: textoNovo, em: new Date().toISOString(), origem: 'r7' }].slice(-50); });
  app.avisoCurto('Guardado na memória do cliente.');
}

async function colarTextoDaVoz(form) {
  const c = cliente(form.dataset.cliente);
  const t = val(form, 'texto').trim().slice(0, 4000);
  if (!c || !t) return;
  const fonte = val(form, 'fonte').trim().slice(0, 80) || 'Texto colado';
  await gravarCliente(c, (d) => { d.vozFontes = [{ id: `colado:${crypto.randomUUID()}`, fonte, texto: t, em: new Date().toISOString() }, ...(d.vozFontes || [])].slice(0, 40); });
}

// ---------------------------------------------------------------------------
// Leitura da voz com a IA (em segundo plano)
// ---------------------------------------------------------------------------

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function mudarVoz(chave, campos) {
  const atual = obterEstado().r7Voz;
  atualizarEstado({ r7Voz: { ...(atual?.chave === chave ? atual : {}), chave, ...campos } });
  if (obterEstado().rota === 'r7') app.renderizar();
}

async function lerVoz(chave) {
  const c = cliente(chave);
  if (!c) return;
  const estado = obterEstado();
  const todas = fontesDaVoz({ rascunhos: (estado.rascunhos || []).filter((r) => !r.excluido_em && r.cliente === chave), memoria: c.dados?.memoria || [], coladas: c.dados?.vozFontes || [] });
  const escolhidas = estado.r7VozFontes?.[chave];
  const textos = todas.filter((x) => !escolhidas || escolhidas.includes(x.id)).map(({ id, fonte, texto }) => ({ id, fonte, texto }));
  if (!textos.length) { app.avisoCurto('Escolha pelo menos um texto para ler a voz.'); return; }
  const usuaria = idDaUsuaria();
  if (!usuaria) { app.avisoCurto('Entre no app de novo para continuar.'); return; }
  if (!navigator.onLine) { app.avisoCurto('Sem internet agora. Ler a voz precisa de conexão.'); return; }
  const id = crypto.randomUUID();
  mudarVoz(chave, { id, status: 'enviando', erro: null, perfil: null, mudou: null, fontes: textos.map((x) => x.id) });
  try {
    await rest('importacoes', { metodo: 'POST', corpo: { id, user_id: usuaria, tipo: 'voz', status: 'lendo', texto: JSON.stringify({ nome: c.nome, textos }) }, prefer: 'return=minimal' });
    const r = await dispararSegundoPlano('r7-voz-background', { id });
    if (!r.ok) throw new Error(r.erro);
  } catch (erro) {
    const semMigracao = erro?.codigo === '23514' || /check constraint|importacoes_tipo_check/i.test(erro?.message || '');
    mudarVoz(chave, { status: 'erro', erro: semMigracao ? 'Falta rodar a migração 016-r7.sql no SQL Editor do Supabase. Depois tente de novo.' : (erro?.message || 'Não deu certo agora.') });
    return;
  }
  mudarVoz(chave, { status: 'lendo' });
  const limite = Date.now() + 4 * 60 * 1000;
  while (Date.now() < limite) {
    await espera(3000);
    let linha;
    try { [linha] = await rest(`importacoes?id=eq.${encodeURIComponent(id)}&select=status,resultado,erro`); } catch { continue; }
    if (!linha) { mudarVoz(chave, { status: 'erro', erro: 'A leitura sumiu. Tente de novo.' }); return; }
    if (linha.status === 'lendo') continue;
    rest(`importacoes?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    if (linha.status === 'erro') { mudarVoz(chave, { status: 'erro', erro: linha.erro }); return; }
    const perfil = conferirVoz(linha.resultado || {});
    const antes = cliente(chave)?.dados?.voz;
    mudarVoz(chave, { status: 'pronto', perfil, mudou: antes ? diferencaDaVoz(antes, perfil) : null });
    return;
  }
  mudarVoz(chave, { status: 'erro', erro: 'A leitura demorou demais. Tente de novo com menos textos.' });
}

async function salvarPerfil(form) {
  const c = cliente(form.dataset.cliente);
  if (!c) return;
  const anterior = obterEstado().r7Voz?.chave === c.chave && obterEstado().r7Voz?.perfil ? obterEstado().r7Voz.perfil : (c.dados?.voz || {});
  const p = {};
  for (const cv of CAMPOS_VOZ) p[cv.id] = { valor: val(form, cv.id), fonte: val(form, `${cv.id}-fonte`) || (val(form, cv.id) ? 'editado' : '') };
  for (const l of LISTAS_VOZ) {
    const antes = new Map((anterior[l.id] || []).map((x) => [x.valor, x.fonte]));
    p[l.id] = val(form, l.id).split('\n').map((x) => x.trim()).filter(Boolean).map((v) => ({ valor: v, fonte: antes.get(v) || 'editado' }));
  }
  p.usaEmoji = form.elements.usaEmoji?.checked ?? null;
  p.usaHashtag = form.elements.usaHashtag?.checked ?? null;
  p.palavrasPorFrase = Number(val(form, 'palavrasPorFrase')) || 0;
  const leitura = obterEstado().r7Voz?.chave === c.chave ? obterEstado().r7Voz : null;
  const voz = { ...conferirVoz(p), atualizado_em: new Date().toISOString(), fontes: leitura?.fontes || c.dados?.voz?.fontes || [] };
  await gravarCliente(c, (d) => { d.voz = voz; });
  atualizarEstado({ r7Voz: null });
  app.avisoCurto('Perfil de voz salvo.');
  app.renderizar();
}

// ---------------------------------------------------------------------------
// Ligações
// ---------------------------------------------------------------------------

export function cliqueR7(alvo) {
  switch (alvo.dataset.acao) {
    case 'r7-aba':
      esconder();
      atualizarEstado({ r7Aba: alvo.dataset.valor });
      try { localStorage.setItem('hub.r7.aba', alvo.dataset.valor); } catch { /* só nesta visita */ }
      if (alvo.dataset.valor === 'acessos' && !obterEstado().r7Acessos?.[obterEstado().parametro?.slice(8)]) lerAcessos(obterEstado().parametro?.slice(8) || '');
      app.renderizar();
      return true;
    case 'r7-mostrar': mostrarAcesso(alvo.dataset.id); return true;
    case 'r7-completar': {
      completarFichas({ so: alvo.dataset.cliente }).then((n) => { app.renderizar(); app.avisoCurto(n ? 'Ficha completada com o que achei no briefing e no Trello.' : 'Não achei nada novo para completar. Confira se o nome do cliente está igual ao do Trello.'); });
      return true;
    }
    case 'r7-conferi': {
      const c = cliente(alvo.dataset.cliente);
      if (c) gravarCliente(c, (d) => { d.r7_auto = { ...(d.r7_auto || {}), confira: false }; });
      return true;
    }
    case 'r7-nao-e': {
      const c = cliente(alvo.dataset.cliente);
      if (!c) return true;
      confirmar(`Tirar ${c.nome} da R7? O robô não cadastra de novo.`, { botao: 'Tirar', perigo: true }).then(async (ok) => {
        if (!ok) return;
        await excluir('clientes_trabalho', c.id);
        atualizarEstado({ clientesTrabalho: await listar('clientes_trabalho') });
        location.hash = '#r7';
        app.renderizar();
      });
      return true;
    }
    case 'r7-esconder': esconder(); return true;
    case 'r7-copiar': {
      const v = obterEstado().r7AcessoVisivel?.[alvo.dataset.valor];
      if (v) navigator.clipboard?.writeText(v).then(() => app.avisoCurto('Copiado.'), () => app.avisoCurto('Não consegui copiar.'));
      return true;
    }
    case 'r7-apagar-acesso': apagarAcesso(alvo.dataset.id); return true;
    case 'r7-tirar-memoria': {
      const c = cliente(alvo.dataset.cliente);
      if (c) gravarCliente(c, (d) => { d.memoria = (d.memoria || []).filter((m) => m.id !== alvo.dataset.id); });
      return true;
    }
    case 'r7-tirar-fonte': {
      const c = cliente(alvo.dataset.cliente);
      if (c) gravarCliente(c, (d) => { d.vozFontes = (d.vozFontes || []).filter((x) => x.id !== alvo.dataset.id); });
      return true;
    }
    case 'r7-ler-voz': lerVoz(alvo.dataset.cliente); return true;
    default: return false;
  }
}

export function enviarR7(form) {
  switch (form.dataset.form) {
    case 'r7-secao': salvarSecao(form); return true;
    case 'r7-novo': criarCliente(form); return true;
    case 'r7-config': salvarConfig(form); return true;
    case 'r7-acesso': guardarAcesso(form); return true;
    case 'r7-memoria': guardarMemoria(form); return true;
    case 'r7-colar-voz': colarTextoDaVoz(form); return true;
    case 'r7-perfil': salvarPerfil(form); return true;
    default: return false;
  }
}

// Fontes marcadas (para a leitura) e o checador de voz ao digitar (sem redesenhar a tela inteira).
export function mudancaR7(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'r7-fonte' && tipo === 'change') {
    const chave = alvo.dataset.cliente;
    const lista = [...document.querySelectorAll(`[data-acao-mudar="r7-fonte"][data-cliente="${CSS.escape(chave)}"]:checked`)].map((x) => x.value);
    atualizarEstado({ r7VozFontes: { ...(obterEstado().r7VozFontes || {}), [chave]: lista } });
    return true;
  }
  if (acao === 'r7-testar-voz') {
    const chave = alvo.dataset.cliente;
    atualizarEstado({ r7VozTeste: { ...(obterEstado().r7VozTeste || {}), [chave]: alvo.value } });
    const c = cliente(chave);
    const caixa = document.querySelector('[data-r7-resultado]');
    if (c && caixa) caixa.innerHTML = resultadoVoz(alvo.value ? checarVoz(alvo.value, c.dados?.voz || {}, fichaDe(c)) : null, Boolean(c.dados?.voz));
    return true;
  }
  return false;
}
