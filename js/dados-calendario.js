// Cálculos do Calendário: dias no horário local, grade do mês, semana e eventos por dia.
// Um dia é sempre a chave "AAAA-MM-DD" no fuso do aparelho.
// Evento de dia inteiro: "inicio" é a meia-noite do primeiro dia e "fim" (opcional) a
// meia-noite do último dia (inclusive). Evento com horário: "inicio" e "fim" são instantes.

const MAX_DIAS_EVENTO = 92;

const doisDigitos = (n) => String(n).padStart(2, '0');

export function chaveDia(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export function dataDaChave(chave) {
  const [a, m, d] = String(chave).split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(chave, n) {
  const d = dataDaChave(chave);
  d.setDate(d.getDate() + n);
  return chaveDia(d);
}

export function chaveValida(chave) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(chave || '')) && chaveDia(dataDaChave(chave)) === chave;
}

// Instante (ISO) de uma data + hora locais ("14:30"); sem hora, meia-noite.
export function instanteLocal(chave, hora = '') {
  const d = dataDaChave(chave);
  const [h, min] = /^\d{2}:\d{2}$/.test(hora) ? hora.split(':').map(Number) : [0, 0];
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

export function horaLocal(iso) {
  const d = new Date(iso);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

export function eventosDoCalendario(estado) {
  return (estado.eventos || []).filter((e) => !e.excluido_em && e.inicio && !Number.isNaN(new Date(e.inicio).getTime()));
}

// Dias (chaves) em que o evento aparece.
export function diasDoEvento(evento) {
  const primeiro = chaveDia(evento.inicio);
  const ultimo = evento.fim ? chaveDia(evento.fim) : primeiro;
  const dias = [primeiro];
  let atual = primeiro;
  while (atual < ultimo && dias.length < MAX_DIAS_EVENTO) {
    atual = somarDias(atual, 1);
    dias.push(atual);
  }
  return dias;
}

// Dia inteiro primeiro; depois por horário; empate pelo título.
function ordenarNoDia(a, b) {
  if (a.dia_inteiro !== b.dia_inteiro) return a.dia_inteiro ? -1 : 1;
  return new Date(a.inicio) - new Date(b.inicio) || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR');
}

// Map chave → eventos do dia, só entre "de" e "ate" (chaves, inclusive).
export function eventosPorDia(eventos, de, ate) {
  const mapa = new Map();
  for (const evento of eventos) {
    for (const dia of diasDoEvento(evento)) {
      if (dia < de || dia > ate) continue;
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia).push(evento);
    }
  }
  for (const lista of mapa.values()) lista.sort(ordenarNoDia);
  return mapa;
}

// Semanas (domingo a sábado) que cobrem o mês da data em foco.
export function gradeDoMes(foco) {
  const d = dataDaChave(foco);
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  let atual = chaveDia(new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay()));
  const fim = chaveDia(new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + (6 - ultimo.getDay())));
  const semanas = [];
  while (atual <= fim) {
    const semana = [];
    for (let i = 0; i < 7; i += 1) {
      semana.push(atual);
      atual = somarDias(atual, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

export function semanaDe(foco) {
  const inicio = somarDias(foco, -dataDaChave(foco).getDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

export function mesmoMes(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

// Avança ou volta a data em foco conforme a visão (mês, semana ou lista de 30 dias).
export function moverFoco(foco, visao, passo) {
  if (visao === 'semana') return somarDias(foco, 7 * passo);
  if (visao === 'lista') return somarDias(foco, 30 * passo);
  const d = dataDaChave(foco);
  return chaveDia(new Date(d.getFullYear(), d.getMonth() + passo, 1));
}

// Identificador estável de um evento do calendário acadêmico: reimportar o mesmo PDF
// atualiza os eventos em vez de duplicar.
export function origemIdAcademico(item) {
  const titulo = String(item.titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${item.inicio}|${titulo}`.slice(0, 160);
}
