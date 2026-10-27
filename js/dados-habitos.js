// Hábitos e rotinas sem tela: em que dias cada hábito vale, quanto foi feito, sequência sem
// culpa, mapa do mês e o passo a passo das rotinas. Sem DOM, para dar para testar sozinho.

// Linhas de "habitos": nome, icone (emoji), periodo ('manha' | 'tarde' | 'noite' | 'qualquer'),
//   frequencia { tipo: 'diario' } | { tipo: 'dias', dias: [0..6] } | { tipo: 'vezes', vezes: n por semana },
//   meta (quanto por dia; 1 = só marcar), unidade, ativo, dados.passos (se for uma rotina).
// Linhas de "habito_registros": habito_id, data (AAAA-MM-DD), valor.

export const PERIODOS = [
  { id: 'manha', nome: 'Manhã', icone: '🌅' },
  { id: 'tarde', nome: 'Tarde', icone: '☀️' },
  { id: 'noite', nome: 'Noite', icone: '🌙' },
  { id: 'qualquer', nome: 'Qualquer hora', icone: '✨' },
];

export const SUGESTOES = [
  { icone: '💧', nome: 'Beber água', meta: 8, unidade: 'copos', periodo: 'qualquer' },
  { icone: '📖', nome: 'Ler', meta: 20, unidade: 'páginas', periodo: 'noite' },
  { icone: '🏃‍♀️', nome: 'Exercício', meta: 1, periodo: 'manha', frequencia: { tipo: 'vezes', vezes: 3 } },
  { icone: '🧘‍♀️', nome: 'Meditar', meta: 10, unidade: 'min', periodo: 'manha' },
  { icone: '📵', nome: 'Sem celular antes de dormir', meta: 1, periodo: 'noite' },
  { icone: '🌅', nome: 'Rotina da manhã', meta: 1, periodo: 'manha', passos: ['Beber um copo de água', 'Arrumar a cama', 'Alongar 5 minutos', 'Olhar as tarefas de hoje'] },
  { icone: '🌙', nome: 'Antes de dormir', meta: 1, periodo: 'noite', passos: ['Separar a roupa de amanhã', 'Escrever uma linha no diário', 'Deixar o celular longe da cama'] },
];

const NOMES_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deIso = (s) => new Date(`${s}T12:00:00`);
export const somarDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); };
const diaDaSemana = (s) => deIso(s).getDay();
// Semana de segunda a domingo
export const segundaDe = (s) => somarDias(s, -((diaDaSemana(s) + 6) % 7));

export const ehRotina = (h) => Array.isArray(h.dados?.passos) && h.dados.passos.length > 0;
export const ativos = (habitos) => (habitos || []).filter((h) => !h.excluido_em && h.ativo !== false)
  .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.criado_em).localeCompare(String(b.criado_em)));
const metaDe = (h) => Math.max(1, Number(h.meta) || 1);

export function textoFrequencia(f) {
  if (!f || f.tipo === 'diario') return 'Todo dia';
  if (f.tipo === 'vezes') return `${f.vezes || 1}× por semana`;
  const dias = [...(f.dias || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d))) return 'Dias úteis';
  return dias.map((d) => NOMES_CURTOS[d]).join(', ') || 'Nenhum dia';
}

// Vale para esse dia? ("vezes por semana" vale todo dia, até bater a meta da semana)
export function valeNoDia(h, dia) {
  const f = h.frequencia || { tipo: 'diario' };
  if (f.tipo === 'dias') return (f.dias || []).includes(diaDaSemana(dia));
  return true;
}

export function registroDoDia(registros, habitoId, dia) {
  return (registros || []).find((r) => !r.excluido_em && r.habito_id === habitoId && r.data === dia) || null;
}
export const valorNoDia = (registros, h, dia) => Number(registroDoDia(registros, h.id, dia)?.valor) || 0;
export const feitoNoDia = (registros, h, dia) => valorNoDia(registros, h, dia) >= metaDe(h);

export function semanaDoHabito(registros, h, dia) {
  const seg = segundaDe(dia);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(seg, i));
  const feitos = dias.filter((d) => feitoNoDia(registros, h, d)).length;
  const alvo = h.frequencia?.tipo === 'vezes' ? Math.max(1, Number(h.frequencia.vezes) || 1)
    : dias.filter((d) => valeNoDia(h, d)).length;
  return { dias, feitos, alvo };
}

// Sequência sem culpa: dias previstos seguidos feitos; um dia perdido a cada 7 não quebra.
// Para "vezes por semana", conta semanas seguidas em que a meta foi batida.
export function sequenciaDoHabito(registros, h, hoje) {
  if (h.frequencia?.tipo === 'vezes') {
    let semanas = 0;
    let seg = segundaDe(hoje);
    const atual = semanaDoHabito(registros, h, hoje);
    if (atual.feitos >= atual.alvo) semanas += 1;
    for (let i = 0; i < 104; i += 1) {
      seg = somarDias(seg, -7);
      const s = semanaDoHabito(registros, h, seg);
      if (s.feitos >= s.alvo) semanas += 1;
      else break;
    }
    return { valor: semanas, unidade: semanas === 1 ? 'semana' : 'semanas' };
  }
  let dia = feitoNoDia(registros, h, hoje) ? hoje : somarDias(hoje, -1);
  let total = 0;
  let ultimaFolga = null;
  const criadoEm = h.criado_em ? iso(new Date(h.criado_em)) : '0000-00-00';
  for (let i = 0; i < 500 && dia >= criadoEm; i += 1) {
    if (!valeNoDia(h, dia)) { dia = somarDias(dia, -1); continue; }
    if (feitoNoDia(registros, h, dia)) total += 1;
    else {
      const podeFolgar = total > 0 && (!ultimaFolga || (deIso(ultimaFolga) - deIso(dia)) / 864e5 >= 7);
      if (!podeFolgar) break;
      ultimaFolga = dia;
    }
    dia = somarDias(dia, -1);
  }
  return { valor: total, unidade: total === 1 ? 'dia' : 'dias' };
}

// Mapa dos últimos N dias: 'feito' | 'parcial' | 'perdido' | 'livre' (não previsto) | 'antes' (antes de criar) | 'futuro'
export function mapaDoHabito(registros, h, hoje, dias = 35) {
  const criadoEm = h.criado_em ? iso(new Date(h.criado_em)) : '0000-00-00';
  return Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(hoje, i - dias + 1);
    const v = valorNoDia(registros, h, dia);
    let estado = 'livre';
    if (dia < criadoEm) estado = 'antes';
    else if (v >= metaDe(h)) estado = 'feito';
    else if (v > 0) estado = 'parcial';
    else if (valeNoDia(h, dia) && dia < hoje && h.frequencia?.tipo !== 'vezes') estado = 'perdido';
    return { dia, estado, valor: v };
  });
}

export function taxa(registros, h, hoje, dias = 30) {
  const mapa = mapaDoHabito(registros, h, hoje, dias).filter((m) => m.estado !== 'antes' && (valeNoDia(h, m.dia) || m.estado === 'feito'));
  if (!mapa.length) return null;
  if (h.frequencia?.tipo === 'vezes') {
    const semanas = Math.max(1, Math.round(mapa.length / 7));
    return Math.min(1, mapa.filter((m) => m.estado === 'feito').length / (semanas * (h.frequencia.vezes || 1)));
  }
  return mapa.filter((m) => m.estado === 'feito').length / mapa.length;
}

// Hábitos de um dia, separados por período, com o que falta.
export function habitosDoDia(habitos, registros, dia) {
  const lista = ativos(habitos).filter((h) => {
    if (!valeNoDia(h, dia)) return false;
    if (h.frequencia?.tipo === 'vezes') {
      const s = semanaDoHabito(registros, h, dia);
      return s.feitos < s.alvo || feitoNoDia(registros, h, dia);
    }
    return true;
  });
  const feitos = lista.filter((h) => feitoNoDia(registros, h, dia)).length;
  const porPeriodo = PERIODOS.map((p) => ({ ...p, itens: lista.filter((h) => (h.periodo || 'qualquer') === p.id) })).filter((p) => p.itens.length);
  return { lista, feitos, total: lista.length, porPeriodo };
}
