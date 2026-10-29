// Cuidar de mim (Meu cantinho, parte 2): água (o hábito "Beber água"), remédios e vitaminas com
// horário, consultas e exames (com "levar" e os de rotina que repetem), o ciclo (só neste
// aparelho) e a rotina de pele. O estado fica em config "cuidar"; o ciclo em localStorage.

import { somarDias } from './dados-tarefas.js';

export const CUIDAR_PADRAO = { remedios: [], consultas: [], exames: [], pele: [] };

export const cuidarDe = (config) => {
  const v = (config || []).find((c) => c.chave === 'cuidar' && !c.excluido_em)?.valor || {};
  return { remedios: v.remedios || [], consultas: v.consultas || [], exames: v.exames || [], pele: v.pele || [] };
};

export const NOMES_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaDaSemana = (iso) => new Date(`${iso}T12:00:00`).getDay();
export const novoId = () => (globalThis.crypto?.randomUUID?.() || String(Math.random())).slice(0, 8);

// Vale hoje? (dias vazio = todos os dias)
export const valeNoDia = (dias, iso) => !Array.isArray(dias) || dias.length === 0 || dias.includes(diaDaSemana(iso));

export function textoDias(dias) {
  if (!Array.isArray(dias) || dias.length === 0 || dias.length === 7) return 'todo dia';
  const s = [...dias].sort();
  if (s.join() === '1,2,3,4,5') return 'dias de semana';
  if (s.join() === '0,6') return 'fim de semana';
  return s.map((d) => NOMES_DIA_CURTO[d]).join(', ');
}

export const horasDe = (texto) => String(texto || '').split(/[,\s;]+/).map((h) => h.trim()).filter((h) => /^\d{1,2}:\d{2}$/.test(h))
  .map((h) => h.padStart(5, '0')).filter((h) => Number(h.slice(0, 2)) < 24 && Number(h.slice(3)) < 60).sort();

// ---------------------------------------------------------------------------
// Remédios e vitaminas
// ---------------------------------------------------------------------------

export function novoRemedio({ nome, horas, dias = [], dose = '' }) {
  return { id: novoId(), nome: String(nome || '').trim().slice(0, 60), horas: horasDe(horas), dias, dose: String(dose || '').trim().slice(0, 40), tomados: {} };
}

// As doses de hoje, na ordem das horas: [{ remedio, hora, tomado }]
export function remediosDeHoje(cuidar, hoje) {
  const doses = [];
  for (const r of cuidar.remedios || []) {
    if (!valeNoDia(r.dias, hoje)) continue;
    const tomadas = r.tomados?.[hoje] || [];
    for (const hora of (r.horas?.length ? r.horas : ['--:--'])) doses.push({ remedio: r, hora, tomado: tomadas.includes(hora) });
  }
  return doses.sort((a, b) => a.hora.localeCompare(b.hora));
}

export function marcarDose(remedio, hoje, hora, tomado) {
  const tomados = { ...(remedio.tomados || {}) };
  const lista = new Set(tomados[hoje] || []);
  if (tomado) lista.add(hora); else lista.delete(hora);
  tomados[hoje] = [...lista];
  // Guarda só os últimos 60 dias.
  const limite = somarDias(hoje, -60);
  for (const k of Object.keys(tomados)) if (k < limite) delete tomados[k];
  return { ...remedio, tomados };
}

// ---------------------------------------------------------------------------
// Consultas e exames
// ---------------------------------------------------------------------------

export function novaConsulta({ nome, data, hora = '', local = '', levar = '' }) {
  return { id: novoId(), nome: String(nome || '').trim().slice(0, 80), data, hora: /^\d{2}:\d{2}$/.test(hora) ? hora : '', local: String(local || '').trim().slice(0, 80), levar: String(levar || '').trim().slice(0, 120), feita: false, evento_id: null };
}

export const consultasProximas = (cuidar, hoje) => (cuidar.consultas || []).filter((c) => !c.feita && c.data >= hoje).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
export const consultasPassadas = (cuidar, hoje) => (cuidar.consultas || []).filter((c) => !c.feita && c.data < hoje);

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
export function textoQuando(data, hoje) {
  if (data === hoje) return 'hoje';
  if (data === somarDias(hoje, 1)) return 'amanhã';
  const d = new Date(`${data}T12:00:00`);
  const dias = Math.round((d - new Date(`${hoje}T12:00:00`)) / 86400000);
  if (dias > 1 && dias < 7) return fmtDia.format(d).replace('.', '');
  return fmtData.format(d).replace('.', '');
}

export function novoExame({ nome, meses, ultima = null }) {
  return { id: novoId(), nome: String(nome || '').trim().slice(0, 60), meses: Math.max(1, Math.min(60, Number(meses) || 12)), ultima: /^\d{4}-\d{2}-\d{2}$/.test(ultima || '') ? ultima : null };
}

export function proximaDoExame(exame) {
  if (!exame.ultima) return null;
  const d = new Date(`${exame.ultima}T12:00:00`);
  d.setMonth(d.getMonth() + exame.meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Está na hora de marcar? (nunca fez, ou a próxima já chegou ou chega em 30 dias)
export function exameVencendo(exame, hoje) {
  const proxima = proximaDoExame(exame);
  if (!proxima) return { marcar: true, proxima: null, texto: 'nunca marcado' };
  const dias = Math.round((new Date(`${proxima}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000);
  if (dias <= 0) return { marcar: true, proxima, texto: 'passou da hora: marcar?' };
  if (dias <= 30) return { marcar: true, proxima, texto: `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}: marcar?` };
  const meses = Math.round(dias / 30);
  return { marcar: false, proxima, texto: `próximo em ~${meses} ${meses === 1 ? 'mês' : 'meses'}` };
}

// ---------------------------------------------------------------------------
// Rotina de pele
// ---------------------------------------------------------------------------

export const PERIODOS_PELE = [{ id: 'manha', nome: 'Manhã', emoji: '🌅' }, { id: 'noite', nome: 'Noite', emoji: '🌙' }];

export function novoPassoPele({ nome, periodo = 'manha', dias = [] }) {
  return { id: novoId(), nome: String(nome || '').trim().slice(0, 60), periodo: periodo === 'noite' ? 'noite' : 'manha', dias, feitos: {} };
}

export const peleDeHoje = (cuidar, hoje) => (cuidar.pele || []).filter((p) => valeNoDia(p.dias, hoje)).map((p) => ({ passo: p, feito: Boolean(p.feitos?.[hoje]) }));

export function marcarPele(passo, hoje, feito) {
  const feitos = { ...(passo.feitos || {}) };
  if (feito) feitos[hoje] = true; else delete feitos[hoje];
  const limite = somarDias(hoje, -60);
  for (const k of Object.keys(feitos)) if (k < limite) delete feitos[k];
  return { ...passo, feitos };
}

// ---------------------------------------------------------------------------
// Resumo do dia ("hoje: 2 de 5")
// ---------------------------------------------------------------------------

export function resumoCuidar(cuidar, hoje, agua = null) {
  const doses = remediosDeHoje(cuidar, hoje);
  const pele = peleDeHoje(cuidar, hoje);
  let total = doses.length + pele.length;
  let feitos = doses.filter((d) => d.tomado).length + pele.filter((p) => p.feito).length;
  if (agua) { total += 1; if (agua.valor >= agua.meta) feitos += 1; }
  return { total, feitos, doses, pele, agua, consultas: consultasProximas(cuidar, hoje) };
}

// ---------------------------------------------------------------------------
// Ciclo (opcional; fica só neste aparelho, em localStorage)
// ---------------------------------------------------------------------------

export const CHAVE_CICLO = 'hub.ciclo';

export function lerCiclo() {
  try { return JSON.parse(localStorage.getItem(CHAVE_CICLO) || 'null'); } catch { return null; }
}

export function gravarCiclo(ciclo) {
  try {
    if (ciclo) localStorage.setItem(CHAVE_CICLO, JSON.stringify(ciclo)); else localStorage.removeItem(CHAVE_CICLO);
  } catch { /* sem localStorage: segue sem o ciclo */ }
}

// ciclo: { inicio: 'AAAA-MM-DD' (primeiro dia do último), duracao: dias }
export function infoCiclo(ciclo, hoje) {
  if (!ciclo?.inicio) return null;
  const duracao = Math.max(20, Math.min(45, Number(ciclo.duracao) || 28));
  const passados = Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${ciclo.inicio}T12:00:00`)) / 86400000);
  if (passados < 0) return null;
  const dia = (passados % duracao) + 1;
  const faltam = duracao - dia + 1;
  const proximo = somarDias(hoje, faltam);
  const tpmEm = Math.max(0, faltam - 5);
  const fase = dia <= 5 ? 'menstruação' : dia <= 13 ? 'fase folicular' : dia <= 16 ? 'ovulação' : 'fase lútea';
  const atrasado = passados >= duracao && passados < duracao + 10 && dia <= 10;
  return { dia, duracao, faltam, proximo, tpmEm, fase, atrasado };
}
