// Funções pequenas de texto, data e tempo usadas pelas telas.

export const MINUTO = 60 * 1000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Todo texto que vem de dados (AVA, Supabase, digitado) passa por aqui antes de virar HTML.
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function maiusculaInicial(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function saudacao(nome, agora = new Date()) {
  const hora = agora.getHours();
  const periodo = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return `${periodo}, ${nome}.`;
}

const formatoDataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoDiaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatoRelativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const formatoNota = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function dataLonga(data = new Date()) {
  return maiusculaInicial(formatoDataLonga.format(data));
}

export function diaEHora(momento) {
  return `${formatoDiaCurto.format(momento)} · ${formatoHora.format(momento)}`;
}

export function numeroNota(valor) {
  return formatoNota.format(valor);
}

export function haQuantoTempo(momento, agora = Date.now()) {
  const diff = momento - agora;
  const abs = Math.abs(diff);
  if (abs < HORA) return formatoRelativo.format(Math.round(diff / MINUTO), 'minute');
  if (abs < DIA) return formatoRelativo.format(Math.round(diff / HORA), 'hour');
  return formatoRelativo.format(Math.round(diff / DIA), 'day');
}

// Urgência de um prazo: atrasado, urgente (< 48h), semana (até 7 dias) ou futuro.
export function urgencia(prazo, agora = Date.now()) {
  const diff = prazo - agora;
  if (diff < 0) return 'atrasado';
  if (diff < 48 * HORA) return 'urgente';
  if (diff <= 7 * DIA) return 'semana';
  return 'futuro';
}

// "Faltam 20 h", "Falta 1 dia", "Atrasado há 5 h"
export function contagemRegressiva(prazo, agora = Date.now()) {
  const diff = prazo - agora;
  const abs = Math.abs(diff);
  let n;
  let unidade;
  if (abs < HORA) {
    n = Math.max(1, Math.round(abs / MINUTO));
    unidade = 'min';
  } else if (abs < 48 * HORA) {
    n = Math.round(abs / HORA);
    unidade = 'h';
  } else {
    n = Math.round(abs / DIA);
    unidade = n === 1 ? 'dia' : 'dias';
  }
  if (diff < 0) return `Atrasado há ${n} ${unidade}`;
  return `${n === 1 ? 'Falta' : 'Faltam'} ${n} ${unidade}`;
}

// Dias de calendário até a data (hoje = 0, amanhã = 1).
export function diasAte(momento, agora = Date.now()) {
  const inicio = new Date(agora);
  inicio.setHours(0, 0, 0, 0);
  const alvo = new Date(momento);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo - inicio) / DIA);
}
