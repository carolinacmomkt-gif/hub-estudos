// "Planejar meu dia": o que entra no planejamento (tarefas, compromissos, prazos, contas, hábitos
// e energia), o planejador simples (sem IA, também a reserva sem internet) e a conferência dos
// blocos (nada em cima de compromisso fixo, nada fora do horário do dia). Sem tela: roda também
// na função da Netlify.

export const PREFS_DIA_PADRAO = { inicio: '08:00', fim: '18:00', almoco: '12:00' };
export const TIPOS_BLOCO = ['foco', 'tarefa', 'estudo', 'pausa', 'refeicao', 'habito', 'compromisso'];
const MAX_BLOCOS = 14;

export const paraMin = (hora) => {
  const m = String(hora || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : null;
};
export const paraHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const arredonda = (min, passo = 15) => Math.ceil(min / passo) * passo;

export function prefsDoDia(valor) {
  const p = valor?.prefs || {};
  const ok = (h, padrao) => (paraMin(h) !== null ? h : padrao);
  const inicio = ok(p.inicio, PREFS_DIA_PADRAO.inicio);
  let fim = ok(p.fim, PREFS_DIA_PADRAO.fim);
  if (paraMin(fim) <= paraMin(inicio)) fim = paraHora(Math.min(23 * 60 + 45, paraMin(inicio) + 8 * 60));
  return { inicio, fim, almoco: ok(p.almoco, PREFS_DIA_PADRAO.almoco) };
}

// Plano guardado (config "meu_dia") só vale no dia dele.
export function planoDeHoje(valor, hoje) {
  const plano = valor?.plano;
  return plano && plano.data === hoje && Array.isArray(plano.blocos) ? plano : null;
}

// Tudo o que a IA (ou o planejador simples) precisa saber, já resumido.
// compromissos: eventos com hora no dia, em minutos do dia; tarefas: abertas de hoje e atrasadas.
export function entradaDoDia({ tarefas = [], eventos = [], contas = [], habitos = [], prazos = [], energia = null, humor = null, nota = '', hoje, minutoDoEvento }) {
  const compromissos = eventos.filter((e) => !e.dia_inteiro && e.inicio).map((e) => {
    const ini = minutoDoEvento(e.inicio);
    const fim = e.fim ? minutoDoEvento(e.fim) : ini + 60;
    return { inicio: ini, fim: Math.max(ini + 15, fim), titulo: e.titulo, tipo: e.tipo };
  }).filter((c) => c.inicio !== null).sort((a, b) => a.inicio - b.inicio);
  const diaTodo = eventos.filter((e) => e.dia_inteiro).map((e) => ({ titulo: e.titulo, tipo: e.tipo }));
  return {
    hoje,
    energia,
    humor,
    compromissos,
    diaTodo,
    // As mais importantes primeiro (a lista vai cortada em 25).
    tarefas: [...tarefas].sort((a, b) => (Number(b.prioridade) || 0) - (Number(a.prioridade) || 0)).slice(0, 25).map((t) => ({
      id: t.id, titulo: t.titulo, prioridade: Number(t.prioridade) || 0, atrasada: Boolean(t.data && t.data < hoje),
      hora: t.hora || null, area: t.area || null,
    })),
    contas: contas.slice(0, 6),
    habitos: habitos.slice(0, 10),
    prazos: prazos.slice(0, 6),
    nota: String(nota || '').slice(0, 300),
  };
}

// Encaixa os blocos no dia: ordena, corta no horário, tira o que bate num compromisso e põe os
// compromissos de volta como estão. Serve para o resultado da IA e para o planejador simples.
export function conferirBlocos(blocos, entrada, prefs, agoraMin = 0) {
  const ini = paraMin(prefs.inicio);
  const fim = paraMin(prefs.fim);
  const fixos = entrada.compromissos.map((c) => ({ inicio: c.inicio, fim: c.fim, titulo: c.titulo, tipo: 'compromisso', fixo: true }));
  const batem = (b) => fixos.some((c) => b.inicio < c.fim && b.fim > c.inicio);
  const tarefas = new Map(entrada.tarefas.map((t) => [t.id, t]));
  const livres = [];
  for (const b of blocos || []) {
    let i = paraMin(b.inicio);
    let f = paraMin(b.fim);
    if (i === null || f === null) continue;
    i = Math.max(i, ini);
    f = Math.min(f, fim);
    if (f - i < 10 || f <= agoraMin) continue;
    const tipo = TIPOS_BLOCO.includes(b.tipo) ? b.tipo : 'tarefa';
    if (tipo === 'compromisso') continue; // os compromissos vêm da agenda, não da IA
    const bloco = { inicio: i, fim: f, titulo: String(b.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Bloco', tipo };
    if (b.tarefa_id && tarefas.has(b.tarefa_id)) bloco.tarefa_id = b.tarefa_id;
    if (b.motivo) bloco.motivo = String(b.motivo).replace(/\s+/g, ' ').trim().slice(0, 120);
    if (batem(bloco)) continue;
    if (livres.some((x) => bloco.inicio < x.fim && bloco.fim > x.inicio)) continue; // o primeiro que chegou fica
    livres.push(bloco);
  }
  return [...fixos.filter((c) => c.fim > ini && c.inicio < fim), ...livres]
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, MAX_BLOCOS + fixos.length)
    .map((b, n) => ({ ...b, id: `b${n}`, inicio: paraHora(b.inicio), fim: paraHora(b.fim) }));
}

// Planejador simples (sem IA): o que é mais urgente cedo, blocos menores com pouca energia,
// pausa a cada hora e meia, almoço e os hábitos do começo e do fim do dia.
export function planoSimples(entrada, prefs, agoraMin = 0) {
  const ini = Math.max(paraMin(prefs.inicio), arredonda(agoraMin));
  const fim = paraMin(prefs.fim);
  const almoco = paraMin(prefs.almoco);
  const pouca = Number(entrada.energia) > 0 && Number(entrada.energia) <= 2;
  const foco = pouca ? 30 : 50;
  const ocupado = entrada.compromissos.map((c) => [c.inicio, c.fim]);
  if (almoco !== null && almoco >= ini && almoco + 60 <= fim) ocupado.push([almoco, almoco + 60]);
  const livre = (a, b) => !ocupado.some(([x, y]) => a < y && b > x);
  const blocos = [];
  if (almoco !== null && almoco >= ini && almoco + 60 <= fim) blocos.push({ inicio: almoco, fim: almoco + 60, titulo: 'Almoço', tipo: 'refeicao' });
  const fila = [...entrada.tarefas].sort((a, b) => (b.prioridade - a.prioridade) || (b.atrasada - a.atrasada));
  const manha = entrada.habitos.filter((h) => h.periodo === 'manha').map((h) => h.nome);
  if (manha.length && livre(ini, ini + 15)) {
    blocos.push({ inicio: ini, fim: ini + 15, titulo: manha.slice(0, 3).join(', '), tipo: 'habito' });
    ocupado.push([ini, ini + 15]);
  }
  let t = ini;
  let seguidos = 0;
  while (t + 25 <= fim && blocos.length < MAX_BLOCOS) {
    if (!livre(t, t + 15)) { t += 15; seguidos = 0; continue; }
    if (seguidos >= 90) {
      blocos.push({ inicio: t, fim: t + 15, titulo: 'Pausa: água e alongar', tipo: 'pausa' });
      ocupado.push([t, t + 15]);
      t += 15;
      seguidos = 0;
      continue;
    }
    const tarefa = fila.shift();
    if (!tarefa) break;
    let dur = tarefa.prioridade >= 2 ? foco + 10 : tarefa.prioridade === 1 ? foco : 30;
    while (dur > 15 && (!livre(t, t + dur) || t + dur > fim)) dur -= 15;
    if (dur < 15) { fila.unshift(tarefa); t += 15; continue; }
    blocos.push({ inicio: t, fim: t + dur, titulo: tarefa.titulo, tipo: tarefa.prioridade >= 1 ? 'foco' : 'tarefa', tarefa_id: tarefa.id });
    ocupado.push([t, t + dur]);
    t += dur;
    seguidos += dur;
  }
  const noite = entrada.habitos.filter((h) => h.periodo === 'noite' || h.periodo === 'tarde').map((h) => h.nome);
  if (noite.length && fim - 15 >= ini && livre(fim - 15, fim)) blocos.push({ inicio: fim - 15, fim, titulo: noite.slice(0, 3).join(', '), tipo: 'habito' });
  return conferirBlocos(blocos.map((b) => ({ ...b, inicio: paraHora(b.inicio), fim: paraHora(b.fim) })), entrada, prefs, agoraMin);
}

// Bloco que está acontecendo (ou o próximo), para o Hoje.
export function blocoAgora(blocos, agoraMin) {
  return blocos.find((b) => paraMin(b.inicio) <= agoraMin && paraMin(b.fim) > agoraMin)
    || blocos.find((b) => paraMin(b.inicio) > agoraMin) || null;
}
