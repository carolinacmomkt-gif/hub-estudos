// Blocos protegidos (decisão da Carol, 29/10/2026): horas sagradas da semana (almoço, academia,
// descanso, "noite sem trabalho") que nada invade: nem o organizador de demandas, nem o
// "Planejar meu dia", nem a IA. Ficam em config "protegidos" ({ lista: [...] }).
//
// Bloco: { id, nome, emoji, dias: [0..6] (0 = domingo), inicio: 'HH:MM', fim: 'HH:MM' }

export const SUGESTOES_PROTEGIDOS = [
  { nome: 'Academia', emoji: '🏋️', dias: [1, 2, 3, 4, 5], inicio: '07:00', fim: '08:00' },
  { nome: 'Descanso', emoji: '🌿', dias: [0, 1, 2, 3, 4, 5, 6], inicio: '14:00', fim: '14:30' },
  { nome: 'Noite sem trabalho', emoji: '🌙', dias: [0, 1, 2, 3, 4, 5, 6], inicio: '20:00', fim: '23:59' },
];

export const NOMES_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const protegidosDe = (config) => ((config || []).find((c) => c.chave === 'protegidos' && !c.excluido_em)?.valor?.lista || []).filter(ehValido);

export const paraMin = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
  return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : null;
};
export const paraHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function ehValido(b) {
  return Boolean(b && b.nome && Array.isArray(b.dias) && b.dias.length && paraMin(b.inicio) !== null && paraMin(b.fim) !== null && paraMin(b.fim) > paraMin(b.inicio));
}

export function novoProtegido({ nome, emoji = '', dias, inicio, fim }) {
  return { id: crypto.randomUUID().slice(0, 8), nome: String(nome || '').trim().slice(0, 40), emoji: String(emoji || '').slice(0, 4), dias: [...new Set(dias.map(Number))].filter((d) => d >= 0 && d <= 6).sort(), inicio, fim };
}

const diaDaSemana = (data) => new Date(`${data}T12:00:00`).getDay();

// Os blocos de uma data, em minutos do dia: [{ id, inicio, fim, titulo, protegido: true }]
export function protegidosDoDia(lista, data) {
  const dia = diaDaSemana(data);
  return lista.filter((b) => b.dias.includes(dia))
    .map((b) => ({ id: b.id, inicio: paraMin(b.inicio), fim: paraMin(b.fim), titulo: `${b.emoji ? `${b.emoji} ` : ''}${b.nome}`, protegido: true }))
    .sort((a, b) => a.inicio - b.inicio);
}

// Como eventos com hora (ISO), para entrar no "Planejar meu dia" e no organizador do mesmo jeito que a agenda.
export function protegidosComoEventos(lista, data) {
  return protegidosDoDia(lista, data).map((b) => ({
    id: `prot-${b.id}-${data}`, titulo: b.titulo, tipo: 'protegido', dia_inteiro: false,
    inicio: new Date(`${data}T${paraHora(b.inicio)}:00`).toISOString(),
    fim: new Date(`${data}T${paraHora(Math.min(b.fim, 24 * 60 - 1))}:00`).toISOString(),
  }));
}

// Que bloco protegido um horário invade? (null se nenhum)
export function invadido(lista, data, iniMin, fimMin) {
  return protegidosDoDia(lista, data).find((b) => iniMin < b.fim && fimMin > b.inicio) || null;
}

export function textoDias(dias) {
  const d = [...dias].sort();
  if (d.length === 7) return 'todo dia';
  if (d.join() === '1,2,3,4,5') return 'seg a sex';
  if (d.join() === '0,6') return 'fim de semana';
  return d.map((x) => NOMES_DIA_CURTO[x]).join(', ');
}
