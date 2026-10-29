// Cliques, formulários e as partes vivas do Meu cantinho: relógio, pausa com tempo, respiração,
// sons, mesinha (relógio de cabeceira que escurece sozinho) e o lembrete de parar.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { somAmbiente, destravarAudio, sino, telaAcesa, entrarEmTelaCheia, sairDaTelaCheia } from './foco-palco.js';
import { cantinhoDe, registrarPausa, PAUSAS, ALONGAR_PASSOS, faseDaRespiracao, amanha, paraMin, paraHora } from './dados-cantinho.js';
import { htmlPausaAberta, relogioAgora, nomeDoSom } from './views-cantinho.js';
import { dataLocal } from './views-dia.js';
import { perguntarTexto, confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }
let relogio = null; // intervalo do relógio da entrada e da mesinha
let pausa = null; // { tipo, fim, intervalo, noite, somAntes }
let mesinha = null; // { escurecer, ultimoToque }
let lembreteParar = null; // intervalo do "levanta um pouco"
let somTocando = '';
const ABRIU_EM = Date.now();

export function ligarCantinho(funcoes) {
  app = funcoes;
  atualizarEstado({ abriuEm: ABRIU_EM });
}

async function mudarCantinho(fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'cantinho');
  const valor = cantinhoDe(atual?.excluido_em ? [] : [atual].filter(Boolean));
  fn(valor);
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'cantinho', valor });
  atualizarEstado({ config: await listar('config') });
}

// ---------------------------------------------------------------------------
// Montar e desmontar (relógio, mesinha, lembrete)
// ---------------------------------------------------------------------------

export function montarCantinho(parametro) {
  desmontarRelogio();
  const tic = () => { document.querySelectorAll('[data-ct-relogio]').forEach((el) => { el.textContent = relogioAgora(); }); };
  relogio = setInterval(tic, 1000);
  if (parametro === 'mesinha') ligarMesinha();
  ligarLembreteDeParar();
}

export function desmontarCantinho() {
  desmontarRelogio();
  desligarMesinha();
  if (lembreteParar) { clearInterval(lembreteParar); lembreteParar = null; }
  // A pausa continua se já estava correndo (ela fica por cima do app inteiro).
}

function desmontarRelogio() {
  if (relogio) { clearInterval(relogio); relogio = null; }
}

// ---------------------------------------------------------------------------
// Mesinha
// ---------------------------------------------------------------------------

function ligarMesinha() {
  const el = document.querySelector('[data-ct-mesinha]');
  if (!el) return;
  document.body.classList.add('modo-mesinha');
  telaAcesa(true);
  if (document.body.dataset.aparelho === 'tablet') entrarEmTelaCheia();
  const acordar = () => {
    el.classList.remove('escurecida');
    clearTimeout(mesinha.escurecer);
    mesinha.escurecer = setTimeout(() => el.classList.add('escurecida'), 60000);
  };
  mesinha = { escurecer: null, ultimoToque: 0 };
  acordar();
  const toque = (e) => {
    if (e.target.closest('button, a, input')) return;
    const agora = Date.now();
    if (agora - mesinha.ultimoToque < 400) { sairDaMesinha(); return; }
    mesinha.ultimoToque = agora;
    acordar();
  };
  el.addEventListener('pointerdown', toque);
  mesinha.el = el;
  mesinha.toque = toque;
  const c = cantinhoDe(obterEstado().config);
  if (c.som && !somTocando) tocarSom(c.som, { temporizado: true });
}

function desligarMesinha() {
  if (!mesinha) return;
  clearTimeout(mesinha.escurecer);
  mesinha.el?.removeEventListener('pointerdown', mesinha.toque);
  mesinha = null;
  document.body.classList.remove('modo-mesinha');
  telaAcesa(false);
  sairDaTelaCheia();
}

function sairDaMesinha() {
  desligarMesinha();
  location.hash = '#cantinho';
}

// ---------------------------------------------------------------------------
// Sons (os do Foco, gerados no aparelho; somem sozinhos em 30 min)
// ---------------------------------------------------------------------------

let somTimer = null;
function tocarSom(tipo, { temporizado = false } = {}) {
  clearTimeout(somTimer);
  if (!tipo) { somAmbiente(''); somTocando = ''; return; }
  destravarAudio();
  somAmbiente(tipo, 0.5);
  somTocando = tipo;
  if (temporizado) somTimer = setTimeout(() => { somAmbiente(''); somTocando = ''; }, 30 * 60000);
}

// ---------------------------------------------------------------------------
// Pausas com tempo
// ---------------------------------------------------------------------------

function iniciarPausa(tipo, { noite = false } = {}) {
  const p = PAUSAS.find((x) => x.id === tipo);
  if (!p || pausa) return;
  const fim = Date.now() + p.minutos * 60000;
  document.body.insertAdjacentHTML('beforeend', htmlPausaAberta(p, { noite }));
  document.body.classList.add('modo-pausa');
  telaAcesa(true);
  pausa = { tipo, fim, noite, inicio: Date.now(), somAntes: somTocando };
  if (tipo === 'cochilo' || noite) { if (!somTocando) tocarSom(cantinhoDe(obterEstado().config).som || 'chuva'); }
  const el = document.querySelector('[data-ct-pausa]');
  const restante = el.querySelector('[data-ct-restante]');
  const passo = el.querySelector('[data-ct-passo]');
  const fase = el.querySelector('[data-ct-fase]');
  const respira = el.querySelector('[data-ct-respira]');
  const tic = () => {
    const agora = Date.now();
    const faltam = Math.max(0, Math.round((pausa.fim - agora) / 1000));
    restante.textContent = `${Math.floor(faltam / 60)}:${String(faltam % 60).padStart(2, '0')}`;
    const decorridos = (agora - pausa.inicio) / 1000;
    if (tipo === 'respirar') {
      const f = faseDaRespiracao(decorridos);
      if (fase.textContent !== f.nome) fase.textContent = f.nome;
      respira.style.setProperty('--fracao', f.nome === 'inspira' ? f.fracao : f.nome === 'solta' ? 1 - f.fracao : 1);
      respira.dataset.fase = f.nome;
    } else if (tipo === 'alongar') {
      const i = Math.min(ALONGAR_PASSOS.length - 1, Math.floor(decorridos / 60));
      const texto = `${ALONGAR_PASSOS[i].nome}: ${ALONGAR_PASSOS[i].texto}`;
      if (passo.textContent !== texto) { passo.textContent = texto; if (i > 0) sino(); }
    }
    if (faltam <= 0) terminarPausa({ completa: true });
  };
  pausa.intervalo = setInterval(tic, 250);
  tic();
}

async function terminarPausa({ completa }) {
  if (!pausa) return;
  const p = pausa;
  pausa = null;
  clearInterval(p.intervalo);
  document.querySelector('[data-ct-pausa]')?.remove();
  document.body.classList.remove('modo-pausa');
  if (!mesinha) telaAcesa(false);
  const minutos = Math.max(1, Math.round((Date.now() - p.inicio) / 60000));
  if (completa) sino();
  if ((p.tipo === 'cochilo' || p.noite) && !p.somAntes) tocarSom('');
  if (completa || minutos >= 1) {
    await mudarCantinho((v) => Object.assign(v, registrarPausa(v, { tipo: p.tipo, minutos })));
    app.renderizar();
    app.avisoCurto(completa ? `${PAUSAS.find((x) => x.id === p.tipo)?.nome || 'Pausa'} feita. Bem-vinda de volta.` : `Pausa de ${minutos} min registrada.`);
  }
}

// ---------------------------------------------------------------------------
// Lembrete de parar (a cada 90 min com o app aberto, só na tela e sem silêncio)
// ---------------------------------------------------------------------------

function ligarLembreteDeParar() {
  if (lembreteParar) return;
  lembreteParar = setInterval(() => {
    const c = cantinhoDe(obterEstado().config);
    if (!c.lembreteParar || pausa || mesinha || document.hidden) return;
    const ultima = c.ultimaPausa ? Date.parse(c.ultimaPausa) : ABRIU_EM;
    const h = new Date().getHours();
    if (Date.now() - ultima >= 90 * 60000 && h >= 7 && h < 22) {
      app.avisoCurto('Faz 1h30 que você não para: levanta, água, janela.', { rotulo: 'Pausa de 2 min', fn: () => iniciarPausa('respirar') });
      mudarCantinho((v) => { v.ultimaPausa = new Date().toISOString(); });
    }
  }, 60000);
}

// ---------------------------------------------------------------------------
// Cliques e formulários
// ---------------------------------------------------------------------------

export function cliqueCantinho(alvo) {
  const { acao } = alvo.dataset;
  if (!acao?.startsWith('ct-')) return false;
  switch (acao) {
    case 'ct-acordar-chip':
      mudarCantinho((v) => { v.acordar = alvo.dataset.valor; v.deitar = null; }).then(() => app.renderizar());
      return true;
    case 'ct-acordar-passo': {
      const delta = Number(alvo.dataset.delta) || 0;
      mudarCantinho((v) => { v.acordar = paraHora((paraMin(v.acordar) ?? 390) + delta); v.deitar = null; }).then(() => app.renderizar());
      return true;
    }
    case 'ct-deitar': {
      const hora = alvo.dataset.valor;
      mudarCantinho((v) => { v.deitar = v.deitar === hora ? null : hora; }).then(() => {
        app.renderizar();
        const c = cantinhoDe(obterEstado().config);
        if (c.deitar) app.avisoCurto(`Deitar às ${c.deitar}.${c.lembrete ? ' Aviso 30 min antes.' : ''}`);
      });
      return true;
    }
    case 'ct-pausa':
      iniciarPausa(alvo.dataset.tipo, { noite: alvo.dataset.noite === '1' });
      return true;
    case 'ct-pausa-parar':
      terminarPausa({ completa: false });
      return true;
    case 'ct-pausa-pronta':
      terminarPausa({ completa: true });
      return true;
    case 'ct-esvaziar':
      perguntarTexto('O que está rodando na cabeça?', { titulo: 'Esvaziar a cabeça', maximo: 200 }).then(async (texto) => {
        if (!texto?.trim()) return;
        const hoje = dataLocal();
        await gravar('tarefas', 'tarefas', { titulo: texto.trim().slice(0, 200), data: amanha(hoje), area: 'pessoal', prioridade: 0, dados: { origem: 'cantinho' } });
        app.avisoCurto('Guardado para amanhã. Pode soltar.');
      });
      return true;
    case 'ct-som': {
      const tipo = alvo.dataset.tipo || '';
      tocarSom(tipo, { temporizado: true });
      mudarCantinho((v) => { if (tipo) v.som = tipo; }).then(() => {
        document.querySelectorAll('[data-acao="ct-som"]').forEach((b) => { b.classList.toggle('on', (b.dataset.tipo || '') === tipo); b.setAttribute('aria-pressed', String((b.dataset.tipo || '') === tipo)); });
        app.avisoCurto(tipo ? `${nomeDoSom(tipo)} por 30 min.` : 'Silêncio.');
      });
      return true;
    }
    case 'ct-mesinha':
      location.hash = '#cantinho/mesinha';
      return true;
    case 'ct-mesinha-sair':
      sairDaMesinha();
      return true;
    default:
      return false;
  }
}

export function mudancaCantinho(alvo) {
  const m = alvo.dataset.acaoMudar;
  if (m === 'ct-acordar') {
    const h = alvo.value;
    if (paraMin(h) === null) return true;
    mudarCantinho((v) => { v.acordar = h; v.deitar = null; }).then(() => app.renderizar());
    return true;
  }
  if (m === 'ct-lembrete') { mudarCantinho((v) => { v.lembrete = alvo.checked; }); return true; }
  if (m === 'ct-lembrete-parar') { mudarCantinho((v) => { v.lembreteParar = alvo.checked; }); return true; }
  return false;
}

export function enviarCantinho(form) {
  if (form.dataset.form !== 'ct-acordar') return false;
  mudancaCantinho(form.elements.acordar);
  return true;
}

export const pausaAberta = () => Boolean(pausa);
export { confirmar as _confirmarCantinho };
