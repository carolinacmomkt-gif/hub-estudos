// Sessão de foco (tipo Pomodoro): foco → pausa curta → foco… e pausa longa a cada N ciclos.
// O relógio é calculado pelos horários guardados no aparelho, então continua certo ao trocar
// de tela, recarregar ou fechar e abrir o app. Cada foco terminado vira uma linha em sessoes_foco
// (para o resumo da semana). Uma barrinha mostra o tempo em todas as telas.
//
// Continuar em outro aparelho: a sessão também vai para a nuvem (config "foco_ativo", com uma
// versão que só cresce). Os outros aparelhos veem "Em andamento no computador" e podem continuar
// ali ("Continuar aqui" passa o comando) ou só acompanhar. Pausar, retomar e encerrar valem em
// todos. Sino, vibração e som ambiente só no aparelho que está com a sessão ("dono"); o registro
// de cada foco tem um código fixo (sessão + ciclo), então dois aparelhos nunca contam em dobro.

import { obterEstado } from './estado.js';
import { listar, salvar, puxarTabela, agendarSincronizacao } from './persistencia.js';
import { esc } from './utilidades.js';
import { idDoAparelho, tipoDoAparelho, noAparelho } from './aparelho.js';
import {
  atualizarFlip, entrarEmTelaCheia, sairDaTelaCheia, emTelaCheia, telaAcesa, controlesSomem, somAmbiente,
  sino, comemorar, ligarPalco, AMBIENTES,
} from './foco-palco.js';

export const FOCO_PADRAO = { foco: 25, pausa: 5, longa: 15, ciclos: 4, som: true, seguir: true, telaCheia: true, fundo: 'tema', ambiente: '', volume: 0.5 };
export const OPCOES_FOCO = [15, 25, 50, 90];
const CHAVE = 'hub.foco';
const NOME_FASE = { foco: 'Foco', pausa: 'Pausa', longa: 'Pausa longa', aguardando: 'Pronta para o próximo foco' };
const CHAVE_VERSAO = 'hub.foco.versao';
const CHAVE_ACOMPANHAR = 'hub.foco.acompanhar';
const CHAVE_NUVEM = 'foco_ativo';
const MIN = 60 * 1000;

// { id, dono, donoTipo, fase, inicio, duracao, pausadoEm, titulo, disciplina_id, area_id, ciclo, focoMin }
let sessao = lerGuardada();
let versao = Number(lerLocal(CHAVE_VERSAO)) || 0;
let automatico = false; // fim de fase sozinho (não é um toque da Carol)
let relogio = null;
let app; // { renderizar, avisoCurto }

function lerLocal(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarLocal(chave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // vale só nesta aba
  }
}

function lerGuardada() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    // Sessão de antes do "continuar em outro aparelho": é deste aparelho.
    if (s && !s.id) Object.assign(s, { id: crypto.randomUUID(), dono: idDoAparelho(), donoTipo: tipoDoAparelho() });
    return s;
  } catch {
    return null;
  }
}

const souDono = (s = sessao) => Boolean(s) && s.dono === idDoAparelho();

// Guarda no aparelho e manda para a nuvem. O fim de fase automático só sai do aparelho dono:
// os outros calculam o mesmo sozinhos, sem disputar a versão.
function guardar() {
  gravarLocal(CHAVE, sessao ? JSON.stringify(sessao) : null);
  if (!automatico) publicar();
  // Fim de fase sozinho: antes confere a nuvem. Um aparelho que dormiu não pode tomar de volta a
  // sessão que já continuou em outro.
  else if (souDono()) puxarSessao().then(() => { if (souDono()) publicar(); });
}

let publicando = Promise.resolve();
function publicar() {
  versao = Math.max(Date.now(), versao + 1);
  gravarLocal(CHAVE_VERSAO, String(versao));
  const valor = { sessao: sessao ? { ...sessao } : null, versao, por: idDoAparelho(), porTipo: tipoDoAparelho() };
  // Em fila: duas mudanças seguidas (pausar e retomar) nunca criam duas linhas da mesma chave.
  publicando = publicando.then(async () => {
    try {
      const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === CHAVE_NUVEM);
      await salvar('config', { ...(atual || {}), excluido_em: null, chave: CHAVE_NUVEM, valor });
      agendarSincronizacao(300); // o outro aparelho vê logo
    } catch (erro) {
      console.warn('Sessão de foco não enviada:', erro);
    }
  });
  return publicando;
}

// Chegou da nuvem uma versão mais nova da sessão (de outro aparelho): adota.
let recebendo = Promise.resolve();
function receberDaNuvem() {
  recebendo = recebendo.then(adotarDaNuvem, adotarDaNuvem);
  return recebendo;
}

async function adotarDaNuvem() {
  let linha;
  try {
    linha = (await listar('config')).find((c) => c.chave === CHAVE_NUVEM);
  } catch {
    return;
  }
  const v = linha?.valor;
  if (!v || !(Number(v.versao) > versao)) return;
  versao = Number(v.versao);
  gravarLocal(CHAVE_VERSAO, String(versao));
  const antes = sessao;
  const eraDono = souDono(antes);
  sessao = v.sessao || null;
  gravarLocal(CHAVE, sessao ? JSON.stringify(sessao) : null);
  const onde = noAparelho(v.porTipo);
  if (!sessao) {
    desligarRelogio();
    sairDaTelaCheia();
    if (antes) app?.avisoCurto(`A sessão de foco foi encerrada ${onde}.`);
  } else {
    ligarRelogio();
    if (eraDono && !souDono()) {
      // Passou para outro aparelho: aqui o sino e o som param, e a tela sai do modo imersivo.
      gravarLocal(CHAVE_ACOMPANHAR, sessao.id);
      sairDaTelaCheia();
      app?.avisoCurto(`A sessão continuou ${noAparelho(sessao.donoTipo)}. Aqui você só acompanha.`);
    } else if (antes?.id === sessao.id && antes.pausadoEm !== sessao.pausadoEm && v.por !== idDoAparelho()) {
      app?.avisoCurto(sessao.pausadoEm ? `Foco pausado ${onde}.` : `Foco retomado ${onde}.`);
    }
  }
  atualizarTela();
}

// Puxa a sessão da nuvem: a cada 20 s com sessão aberta (1 min sem) e ao voltar para o app.
async function puxarSessao() {
  await puxarTabela('config');
  await receberDaNuvem();
}

// "Continuar aqui": este aparelho passa a ser o dono (sino, som e registro automático).
export function continuarAqui() {
  if (!sessao) return;
  sessao = { ...sessao, dono: idDoAparelho(), donoTipo: tipoDoAparelho() };
  gravarLocal(CHAVE_ACOMPANHAR, null);
  guardar();
  ligarRelogio();
  pedirPermissaoDeAviso();
  atualizarPalco.assinatura = null;
  atualizarTela();
}

export function soAcompanhar() {
  if (!sessao) return;
  gravarLocal(CHAVE_ACOMPANHAR, sessao.id);
  atualizarTela();
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
    telaCheia: v.telaCheia !== false,
    fundo: v.fundo === 'preto' ? 'preto' : 'tema',
    ambiente: AMBIENTES.some((a) => a.id === v.ambiente) ? v.ambiente : '',
    volume: Math.max(0, Math.min(1, Number(v.volume ?? FOCO_PADRAO.volume))),
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
    aqui: souDono(),
    ondeEsta: souDono() ? '' : noAparelho(sessao.donoTipo),
    acompanhando: !souDono() && lerLocal(CHAVE_ACOMPANHAR) === sessao.id,
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
    id: crypto.randomUUID(), dono: idDoAparelho(), donoTipo: tipoDoAparelho(),
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
  sairDaTelaCheia();
  atualizarTela();
}

async function registrarFoco(ms, concluida, fim = Date.now()) {
  const minutos = Math.round(ms / MIN);
  if (minutos < 1) return;
  try {
    await salvar('sessoes_foco', {
      id: idDoRegistro(),
      titulo: sessao.titulo, disciplina_id: sessao.disciplina_id || null, area_id: sessao.area_id || null,
      inicio: new Date(fim - ms).toISOString(), fim: new Date(fim).toISOString(), minutos, concluida,
    });
  } catch (erro) {
    console.warn('Sessão de foco não salva:', erro);
  }
}

// Código fixo por sessão e ciclo: se dois aparelhos registrarem o mesmo foco, fica uma linha só.
function idDoRegistro() {
  const ciclo = Math.max(1, Math.min(0xffff, Number(sessao.ciclo) || 1));
  return /^[0-9a-f-]{36}$/.test(sessao.id || '') ? `${sessao.id.slice(0, -4)}${ciclo.toString(16).padStart(4, '0')}` : crypto.randomUUID();
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
  if (!conferindo) {
    automatico = true;
    conferindo = conferirAgora().finally(() => { conferindo = null; automatico = false; });
  }
  return conferindo;
}

async function conferirAgora() {
  if (!sessao || sessao.pausadoEm || sessao.fase === 'aguardando') return;
  const agora = Date.now();
  const fim = sessao.inicio + sessao.duracao;
  if (agora < fim) return;
  // Terminou agora há pouco: toca o alarme (só no aparelho que está com a sessão).
  const recente = agora - fim < 2 * MIN && souDono();
  const p = prefsFoco();
  if (sessao.fase === 'foco') {
    await registrarFoco(sessao.duracao, true, fim);
    const longa = (sessao.ciclo || 1) % p.ciclos === 0;
    if (recente) comemorar(`${Math.round(sessao.duracao / MIN)} min de ${sessao.titulo}`, `Foco ${sessao.ciclo || 1} de ${p.ciclos} feito. ${longa ? 'Agora, uma pausa longa.' : 'Respira um pouco.'}`);
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

function alarme(titulo, texto) {
  if (prefsFoco().som) sino();
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
  const fase = `<span class="foco-barra-fase fase-${esc(s.fase)}">${esc(s.nomeFase)}</span>`;
  const tempo = aguardando ? '' : `<strong class="foco-barra-tempo" data-foco-relogio>${relogioTexto(s.restante)}</strong>`;
  // Sessão aberta em outro aparelho e a Carol ainda não escolheu: oferece continuar aqui.
  if (!s.aqui && !s.acompanhando) {
    return `
      ${fase}${tempo}
      <span class="foco-barra-titulo"><span class="foco-barra-onde">Em andamento ${esc(s.ondeEsta)}</span> ${esc(s.titulo)}</span>
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="foco-continuar-aqui">Continuar aqui</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="foco-acompanhar">Só acompanhar</button>`;
  }
  return `
    ${fase}${tempo}
    <span class="foco-barra-titulo">${s.aqui ? '' : `<span class="foco-barra-onde">${esc(s.ondeEsta.replace(/^no /, 'No ').replace(/^no outro/, 'No outro'))}</span> `}${esc(s.titulo)}</span>
    ${aguardando
      ? '<button class="botao botao-primario botao-pequeno" type="button" data-acao="foco-proximo">Começar foco</button>'
      : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="${s.pausado ? 'foco-retomar' : 'foco-pausar'}">${s.pausado ? 'Retomar' : 'Pausar'}</button>`}
    ${s.aqui ? '' : '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="foco-continuar-aqui">Continuar aqui</button>'}
    <a class="botao botao-secundario botao-pequeno foco-barra-abrir" href="#foco">Abrir</a>`;
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
    const assinatura = `${s.fase}|${s.pausado}|${s.titulo}|${sessao?.inicio}|${s.aqui}|${s.acompanhando}`;
    if (mostrar && (!soRelogio || barra.dataset.assinatura !== assinatura)) {
      barra.innerHTML = barraDoFoco();
      barra.dataset.assinatura = assinatura;
    }
  }
  document.querySelectorAll('[data-foco-relogio]').forEach((el) => { el.textContent = relogioTexto(s.restante || 0); });
  atualizarPalco(s, naTelaDoFoco);
  document.querySelectorAll('[data-foco-progresso]').forEach((el) => {
    el.style.width = `${s.total ? Math.round(((s.total - s.restante) / s.total) * 100) : 0}%`;
  });
  // Mudou de fase (ou pausou): a tela do foco e o Início se redesenham; no resto, só o relógio.
  const faseAgora = sessao ? `${sessao.fase}|${Boolean(sessao.pausadoEm)}|${souDono()}|${s.acompanhando}|${sessao.id}` : 'nenhuma';
  if (!soRelogio || faseAgora !== atualizarTela.fase) {
    atualizarTela.fase = faseAgora;
    const rota = obterEstado().rota;
    if (app && (rota === 'foco' || rota === 'inicio')) app.renderizar();
  }
}

// Palco (tela imersiva): tela cheia só no #foco, tela acesa e controles que somem enquanto o
// tempo corre, e o som ambiente que some na pausa.
function atualizarPalco(s, naTelaDoFoco) {
  const p = prefsFoco();
  const correndo = s.ativa && !s.pausado && s.fase !== 'aguardando';
  document.body.classList.toggle('foco-imersivo', s.ativa && naTelaDoFoco);
  if (s.ativa && naTelaDoFoco && s.fase !== 'aguardando') atualizarFlip(relogioTexto(s.restante || 0));
  const assinatura = `${s.ativa}|${s.fase}|${s.pausado}|${naTelaDoFoco}|${p.ambiente}|${p.volume}|${s.aqui}`;
  if (assinatura === atualizarPalco.assinatura) return;
  atualizarPalco.assinatura = assinatura;
  telaAcesa(naTelaDoFoco && correndo && s.aqui);
  controlesSomem(naTelaDoFoco && correndo && s.aqui);
  somAmbiente(s.ativa && s.aqui ? p.ambiente : '', p.volume, { baixo: !correndo || s.fase !== 'foco' });
  if (!naTelaDoFoco && emTelaCheia()) sairDaTelaCheia();
}

export function ligarFoco(funcoes) {
  app = funcoes;
  ligarPalco();
  const barra = document.createElement('div');
  barra.id = 'foco-barra';
  barra.className = 'foco-barra';
  barra.setAttribute('role', 'status');
  barra.setAttribute('aria-label', 'Sessão de foco');
  barra.hidden = true;
  document.body.append(barra);
  atualizarTela.fase = sessao ? `${sessao.fase}|${Boolean(sessao.pausadoEm)}|${souDono()}|${lerLocal(CHAVE_ACOMPANHAR) === sessao.id}|${sessao.id}` : 'nenhuma';
  if (sessao) ligarRelogio();
  // Antes de conferir as fases, vê se a sessão não continuou em outro aparelho.
  puxarSessao().finally(() => { if (sessao) conferir(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) puxarSessao().finally(() => conferir().then(() => atualizarTela()));
  });
  window.addEventListener('hub:dados', (e) => {
    if (e.detail?.tabela === 'config' && e.detail.daNuvem) receberDaNuvem();
  });
  let ultimaPuxada = Date.now();
  setInterval(() => {
    if (document.hidden || Date.now() - ultimaPuxada < (sessao ? 20e3 : 60e3) - 500) return;
    ultimaPuxada = Date.now();
    puxarSessao();
  }, 5000);
}

// Sessões (para o Início, a tela do foco e o resumo).
export function sessoesDoPeriodo(estado, inicio, fim) {
  return (estado.sessoesFoco || []).filter((s) => !s.excluido_em && Date.parse(s.inicio) >= inicio && Date.parse(s.inicio) < fim)
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
}

export function cliqueFoco(alvo) {
  switch (alvo.dataset.acao) {
    case 'foco-iniciar':
      if (prefsFoco().telaCheia) entrarEmTelaCheia();
      iniciarFoco({ titulo: alvo.dataset.titulo || '', disciplina_id: alvo.dataset.disciplina || null, area_id: alvo.dataset.area || null, minutos: Number(alvo.dataset.minutos) || null });
      if (obterEstado().rota !== 'foco') location.hash = '#foco';
      return true;
    case 'foco-continuar-aqui':
      continuarAqui();
      if (obterEstado().rota !== 'foco') location.hash = '#foco';
      else if (prefsFoco().telaCheia) entrarEmTelaCheia();
      return true;
    case 'foco-acompanhar': soAcompanhar(); return true;
    case 'foco-pausar': pausarFoco(); return true;
    case 'foco-retomar': retomarFoco(); return true;
    case 'foco-proximo':
      if (prefsFoco().telaCheia && obterEstado().rota === 'foco') entrarEmTelaCheia();
      proximoFoco();
      return true;
    case 'foco-tela-cheia':
      if (emTelaCheia()) sairDaTelaCheia();
      else entrarEmTelaCheia();
      return true;
    case 'foco-fundo':
      salvarPrefsFoco({ fundo: prefsFoco().fundo === 'preto' ? 'tema' : 'preto' });
      return true;
    case 'foco-som': {
      const i = AMBIENTES.findIndex((a) => a.id === prefsFoco().ambiente);
      const proximo = AMBIENTES[(i + 1) % AMBIENTES.length];
      salvarPrefsFoco({ ambiente: proximo.id }).then(() => app?.avisoCurto(proximo.id ? `Som: ${proximo.nome}.` : 'Som desligado.'));
      return true;
    }
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
    if (prefsFoco().telaCheia) entrarEmTelaCheia();
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
  if (alvo.dataset?.acaoMudar === 'foco-volume') {
    const volume = Number(alvo.value) / 100;
    somAmbiente(prefsFoco().ambiente, volume);
    if (tipo === 'change') salvarPrefsFoco({ volume });
    return true;
  }
  const form = alvo.closest?.('[data-form="foco-prefs"]');
  if (!form) return false;
  if (tipo !== 'change') return true;
  const el = form.elements;
  salvarPrefsFoco({ pausa: Number(el.pausa.value), longa: Number(el.longa.value), ciclos: Number(el.ciclos.value), som: el.som.checked, seguir: el.seguir.checked, telaCheia: el.telaCheia.checked })
    .then(() => app?.avisoCurto('Ajustes do foco salvos.'));
  return true;
}
