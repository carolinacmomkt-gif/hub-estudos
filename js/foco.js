// Sessão de foco (tipo Pomodoro): foco → pausa curta → foco… e pausa longa a cada N ciclos.
// O relógio é calculado pelos horários guardados no aparelho, então continua certo ao trocar
// de tela, recarregar ou fechar e abrir o app. Cada foco terminado vira uma linha em sessoes_foco
// (para o resumo da semana). Uma barrinha mostra o tempo em todas as telas.

import { obterEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { esc } from './utilidades.js';

export const FOCO_PADRAO = { foco: 25, pausa: 5, longa: 15, ciclos: 4, som: true, seguir: true };
export const OPCOES_FOCO = [15, 25, 50, 90];
const CHAVE = 'hub.foco';
const NOME_FASE = { foco: 'Foco', pausa: 'Pausa', longa: 'Pausa longa', aguardando: 'Pronta para o próximo foco' };
const MIN = 60 * 1000;

let sessao = lerGuardada(); // { fase, inicio, duracao, pausadoEm, titulo, disciplina_id, area_id, ciclo, focoMin }
let relogio = null;
let app; // { renderizar, avisoCurto }

function lerGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}

function guardar() {
  try {
    if (sessao) localStorage.setItem(CHAVE, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE);
  } catch {
    // vale só nesta aba
  }
}

export function prefsFoco(estado = obterEstado()) {
  const v = (estado.config || []).find((c) => c.chave === 'foco' && !c.excluido_em)?.valor || {};
  const num = (x, padrao, min, max) => Math.max(min, Math.min(max, Number(x) || padrao));
  return {
    foco: num(v.foco, FOCO_PADRAO.foco, 5, 180),
    pausa: num(v.pausa, FOCO_PADRAO.pausa, 1, 60),
    longa: num(v.longa, FOCO_PADRAO.longa, 1, 90),
    ciclos: num(v.ciclos, FOCO_PADRAO.ciclos, 2, 12),
    som: v.som !== false,
    seguir: v.seguir !== false,
  };
}

export async function salvarPrefsFoco(campos) {
  const atual = (await listar('config')).find((c) => c.chave === 'foco');
  await salvar('config', { ...(atual || {}), chave: 'foco', valor: { ...(atual?.valor || {}), ...campos } });
}

// Situação agora: { ativa, fase, restante (ms), total (ms), pausado, titulo, ciclo, ciclos }
export function situacaoFoco(agora = Date.now()) {
  if (!sessao) return { ativa: false };
  const decorrido = (sessao.pausadoEm || agora) - sessao.inicio;
  return {
    ativa: true,
    fase: sessao.fase,
    nomeFase: NOME_FASE[sessao.fase],
    restante: sessao.fase === 'aguardando' ? 0 : Math.max(0, sessao.duracao - decorrido),
    total: sessao.duracao,
    pausado: Boolean(sessao.pausadoEm),
    titulo: sessao.titulo,
    disciplina_id: sessao.disciplina_id,
    area_id: sessao.area_id,
    ciclo: sessao.ciclo,
    ciclos: prefsFoco().ciclos,
  };
}

export function relogioTexto(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

function comecarFase(fase, inicio = Date.now()) {
  const p = prefsFoco();
  const minutos = fase === 'foco' ? (sessao.focoMin || p.foco) : fase === 'longa' ? p.longa : p.pausa;
  sessao = { ...sessao, fase, inicio, duracao: minutos * MIN, pausadoEm: null };
  guardar();
}

export function iniciarFoco({ titulo = '', disciplina_id = null, area_id = null, minutos = null } = {}) {
  const p = prefsFoco();
  sessao = {
    fase: 'foco', inicio: Date.now(), duracao: (minutos || p.foco) * MIN, pausadoEm: null,
    titulo: String(titulo).trim().slice(0, 140) || 'Estudo', disciplina_id, area_id, ciclo: 1, focoMin: minutos || p.foco,
  };
  guardar();
  pedirPermissaoDeAviso();
  ligarRelogio();
  atualizarTela();
}

export function proximoFoco() {
  if (!sessao) return;
  sessao.ciclo = sessao.fase === 'aguardando' && sessao.depoisDaLonga ? 1 : (sessao.ciclo || 1);
  delete sessao.depoisDaLonga;
  comecarFase('foco');
  ligarRelogio();
  atualizarTela();
}

export function pausarFoco() {
  if (!sessao || sessao.pausadoEm || sessao.fase === 'aguardando') return;
  sessao.pausadoEm = Date.now();
  guardar();
  atualizarTela();
}

export function retomarFoco() {
  if (!sessao?.pausadoEm) return;
  sessao.inicio += Date.now() - sessao.pausadoEm;
  sessao.pausadoEm = null;
  guardar();
  ligarRelogio();
  atualizarTela();
}

// Pular: termina a fase agora (o foco conta só o tempo que de fato passou).
export async function pularFase() {
  if (!sessao) return;
  if (sessao.fase === 'foco') {
    const feito = Math.min(sessao.duracao, (sessao.pausadoEm || Date.now()) - sessao.inicio);
    await registrarFoco(feito, feito >= sessao.duracao - MIN);
    avancarDepoisDoFoco(Date.now());
  } else {
    sessao.fase = 'aguardando';
    sessao.pausadoEm = null;
    guardar();
  }
  atualizarTela();
}

export async function encerrarFoco() {
  if (!sessao) return;
  if (sessao.fase === 'foco') {
    const feito = Math.min(sessao.duracao, (sessao.pausadoEm || Date.now()) - sessao.inicio);
    if (feito >= MIN) await registrarFoco(feito, false);
  }
  sessao = null;
  guardar();
  desligarRelogio();
  atualizarTela();
}

async function registrarFoco(ms, concluida, fim = Date.now()) {
  const minutos = Math.round(ms / MIN);
  if (minutos < 1) return;
  try {
    await salvar('sessoes_foco', {
      titulo: sessao.titulo, disciplina_id: sessao.disciplina_id || null, area_id: sessao.area_id || null,
      inicio: new Date(fim - ms).toISOString(), fim: new Date(fim).toISOString(), minutos, concluida,
    });
  } catch (erro) {
    console.warn('Sessão de foco não salva:', erro);
  }
}

function avancarDepoisDoFoco(quando) {
  const p = prefsFoco();
  const longa = (sessao.ciclo || 1) % p.ciclos === 0;
  sessao.ciclo = (sessao.ciclo || 1) + 1;
  if (longa) sessao.depoisDaLonga = true;
  comecarFase(longa ? 'longa' : 'pausa', quando);
}

// Chamado a cada segundo: termina as fases que acabaram (mesmo as que acabaram com o app fechado).
// Uma conferência por vez: senão o fim do foco seria registrado duas vezes.
let conferindo = null;
function conferir() {
  if (!conferindo) conferindo = conferirAgora().finally(() => { conferindo = null; });
  return conferindo;
}

async function conferirAgora() {
  if (!sessao || sessao.pausadoEm || sessao.fase === 'aguardando') return;
  const agora = Date.now();
  const fim = sessao.inicio + sessao.duracao;
  if (agora < fim) return;
  const recente = agora - fim < 2 * MIN; // terminou agora há pouco: toca o alarme
  const p = prefsFoco();
  if (sessao.fase === 'foco') {
    await registrarFoco(sessao.duracao, true, fim);
    const longa = (sessao.ciclo || 1) % p.ciclos === 0;
    avancarDepoisDoFoco(fim);
    if (recente) alarme('Fim do foco!', `${longa ? 'Pausa longa' : 'Pausa'} de ${longa ? p.longa : p.pausa} min. Levante, beba água.`);
    if (!p.seguir) {
      sessao.fase = 'aguardando';
      guardar();
    }
  } else {
    sessao.fase = 'aguardando';
    sessao.pausadoEm = null;
    guardar();
    if (recente) alarme('A pausa acabou', 'Bora para o próximo foco?');
  }
  atualizarTela();
  // Com o app fechado por muito tempo, várias fases podem ter acabado: resolve todas.
  if (sessao && !sessao.pausadoEm && sessao.fase !== 'aguardando' && Date.now() >= sessao.inicio + sessao.duracao) await conferirAgora();
}

// ---------------------------------------------------------------------------
// Alarme: som curto, vibração e notificação (se o app estiver em segundo plano)
// ---------------------------------------------------------------------------

function pedirPermissaoDeAviso() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch {
    // sem notificações
  }
}

function tocar() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = 880;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // sem som
  }
}

function alarme(titulo, texto) {
  if (prefsFoco().som) tocar();
  try {
    navigator.vibrate?.([200, 120, 200]);
  } catch {
    // sem vibração
  }
  app?.avisoCurto(`${titulo} ${texto}`);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then((r) => r.showNotification(titulo, { body: texto, tag: 'foco', data: { url: '/#foco' } })).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Barrinha e relógio na tela
// ---------------------------------------------------------------------------

function ligarRelogio() {
  if (relogio) return;
  relogio = setInterval(() => {
    conferir();
    atualizarTela({ soRelogio: true });
  }, 1000);
}

function desligarRelogio() {
  clearInterval(relogio);
  relogio = null;
}

export function barraDoFoco() {
  const s = situacaoFoco();
  if (!s.ativa) return '';
  const aguardando = s.fase === 'aguardando';
  return `
    <span class="foco-barra-fase fase-${esc(s.fase)}">${esc(s.nomeFase)}</span>
    ${aguardando ? '' : `<strong class="foco-barra-tempo" data-foco-relogio>${relogioTexto(s.restante)}</strong>`}
    <span class="foco-barra-titulo">${esc(s.titulo)}</span>
    ${aguardando
      ? '<button class="botao botao-primario botao-pequeno" type="button" data-acao="foco-proximo">Começar foco</button>'
      : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="${s.pausado ? 'foco-retomar' : 'foco-pausar'}">${s.pausado ? 'Retomar' : 'Pausar'}</button>`}
    <a class="botao botao-secundario botao-pequeno" href="#foco">Abrir</a>`;
}

export function atualizarTela({ soRelogio = false } = {}) {
  const s = situacaoFoco();
  const barra = document.getElementById('foco-barra');
  const naTelaDoFoco = obterEstado().rota === 'foco';
  if (barra) {
    const mostrar = s.ativa && !naTelaDoFoco;
    barra.hidden = !mostrar;
    document.body.classList.toggle('com-foco', mostrar);
    // Redesenha a barrinha quando muda a fase, a pausa ou a sessão; no resto, só o relógio.
    const assinatura = `${s.fase}|${s.pausado}|${s.titulo}|${sessao?.inicio}`;
    if (mostrar && (!soRelogio || barra.dataset.assinatura !== assinatura)) {
      barra.innerHTML = barraDoFoco();
      barra.dataset.assinatura = assinatura;
    }
  }
  document.querySelectorAll('[data-foco-relogio]').forEach((el) => { el.textContent = relogioTexto(s.restante || 0); });
  document.querySelectorAll('[data-foco-progresso]').forEach((el) => {
    el.style.width = `${s.total ? Math.round(((s.total - s.restante) / s.total) * 100) : 0}%`;
  });
  // Mudou de fase (ou pausou): a tela do foco e o Início se redesenham; no resto, só o relógio.
  const faseAgora = sessao ? `${sessao.fase}|${Boolean(sessao.pausadoEm)}` : 'nenhuma';
  if (!soRelogio || faseAgora !== atualizarTela.fase) {
    atualizarTela.fase = faseAgora;
    const rota = obterEstado().rota;
    if (app && (rota === 'foco' || rota === 'inicio')) app.renderizar();
  }
}

export function ligarFoco(funcoes) {
  app = funcoes;
  const barra = document.createElement('div');
  barra.id = 'foco-barra';
  barra.className = 'foco-barra';
  barra.setAttribute('role', 'status');
  barra.setAttribute('aria-label', 'Sessão de foco');
  barra.hidden = true;
  document.body.append(barra);
  atualizarTela.fase = sessao ? `${sessao.fase}|${Boolean(sessao.pausadoEm)}` : 'nenhuma';
  if (sessao) {
    ligarRelogio();
    conferir();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) conferir().then(() => atualizarTela());
  });
}

// Sessões (para o Início, a tela do foco e o resumo).
export function sessoesDoPeriodo(estado, inicio, fim) {
  return (estado.sessoesFoco || []).filter((s) => !s.excluido_em && Date.parse(s.inicio) >= inicio && Date.parse(s.inicio) < fim)
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
}

export function cliqueFoco(alvo) {
  switch (alvo.dataset.acao) {
    case 'foco-iniciar':
      iniciarFoco({ titulo: alvo.dataset.titulo || '', disciplina_id: alvo.dataset.disciplina || null, area_id: alvo.dataset.area || null, minutos: Number(alvo.dataset.minutos) || null });
      if (obterEstado().rota !== 'foco') location.hash = '#foco';
      return true;
    case 'foco-pausar': pausarFoco(); return true;
    case 'foco-retomar': retomarFoco(); return true;
    case 'foco-proximo': proximoFoco(); return true;
    case 'foco-pular': pularFase(); return true;
    case 'foco-encerrar':
      if (window.confirm('Encerrar a sessão de foco? O tempo que já passou fica registrado.')) encerrarFoco();
      return true;
    default:
      return false;
  }
}

export function enviarFoco(form) {
  if (form.dataset.form === 'foco-iniciar') {
    const el = form.elements;
    iniciarFoco({
      titulo: el.titulo.value, disciplina_id: el.disciplina?.value || null, area_id: el.area?.value || null,
      minutos: Number(form.querySelector('[name="minutos"]:checked')?.value) || null,
    });
    return true;
  }
  return form.dataset.form === 'foco-prefs';
}

// Ajustes do foco salvam sozinhos a cada mudança.
export function mudancaFoco(alvo, tipo) {
  const form = alvo.closest?.('[data-form="foco-prefs"]');
  if (!form) return false;
  if (tipo !== 'change') return true;
  const el = form.elements;
  salvarPrefsFoco({ pausa: Number(el.pausa.value), longa: Number(el.longa.value), ciclos: Number(el.ciclos.value), som: el.som.checked, seguir: el.seguir.checked })
    .then(() => app?.avisoCurto('Ajustes do foco salvos.'));
  return true;
}
