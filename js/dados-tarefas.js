// Tarefas e projetos sem tela: leitura rápida ("pagar luz sexta 18h #casa !"), repetição e as
// visões (hoje, próximos dias, algum dia, feitas). Sem DOM, para dar para testar sozinho.

export const AREAS_TAREFA = [
  { id: 'pessoal', nome: 'Pessoal' },
  { id: 'casa', nome: 'Casa' },
  { id: 'consultoria', nome: 'Consultoria' },
  { id: 'criacao', nome: 'Criação' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'financas', nome: 'Finanças' },
];
export const PRIORIDADES = [
  { valor: 0, nome: 'Normal' },
  { valor: 1, nome: 'Importante' },
  { valor: 2, nome: 'Urgente' },
];
export const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// --- Datas no formato AAAA-MM-DD (sempre no fuso do aparelho) ---------------------------
export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const deIso = (s) => new Date(`${s}T12:00:00`);
export function somarDias(s, n) {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Próximo dia da semana a partir de hoje (hoje conta).
function proximoDiaDaSemana(hoje, dia) {
  const d = deIso(hoje).getDay();
  return somarDias(hoje, (dia - d + 7) % 7);
}

function diaDoMes(hoje, dia, apartirDeAmanha = false) {
  const d = deIso(hoje);
  for (let i = apartirDeAmanha ? 1 : 0; i < 400; i += 1) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    const ultimo = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    if (x.getDate() === Math.min(dia, ultimo)) return iso(x);
  }
  return hoje;
}

// --- Repetição -----------------------------------------------------------------------------
// { tipo: 'diaria' } | { tipo: 'uteis' } | { tipo: 'semanal', dias: [0..6] } | { tipo: 'mensal', dia: 1..31 }
export function proximaData(rec, depoisDe) {
  if (!rec?.tipo) return null;
  if (rec.tipo === 'diaria') return somarDias(depoisDe, 1);
  if (rec.tipo === 'mensal') return diaDoMes(depoisDe, rec.dia || deIso(depoisDe).getDate(), true);
  const dias = rec.tipo === 'uteis' ? [1, 2, 3, 4, 5] : (rec.dias?.length ? rec.dias : [deIso(depoisDe).getDay()]);
  for (let i = 1; i <= 7; i += 1) {
    const s = somarDias(depoisDe, i);
    if (dias.includes(deIso(s).getDay())) return s;
  }
  return somarDias(depoisDe, 7);
}

export function textoRepeticao(rec) {
  if (!rec?.tipo) return '';
  if (rec.tipo === 'diaria') return 'Todo dia';
  if (rec.tipo === 'uteis') return 'Dias úteis';
  if (rec.tipo === 'mensal') return `Todo dia ${rec.dia} do mês`;
  const dias = rec.dias || [];
  if (dias.length === 7) return 'Todo dia';
  return `Toda ${dias.map((d) => DIAS_CURTOS[d]).join(', ')}`.replace('Toda sáb', 'Todo sáb').replace('Toda dom', 'Todo dom');
}

// --- Leitura rápida ------------------------------------------------------------------------
const PADRAO_DIA = {
  domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6,
};
const RE_DIA = '(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)(?:-feira)?';

// Devolve { titulo, data, hora, prioridade, area, recorrencia } a partir de uma linha digitada.
export function lerTarefaRapida(texto, hoje) {
  let resto = ` ${String(texto || '').trim()} `;
  const plano = () => semAcento(resto);
  const tirar = (re) => {
    const m = plano().match(re);
    if (!m) return null;
    resto = resto.slice(0, m.index) + ' ' + resto.slice(m.index + m[0].length);
    return m;
  };
  const r = { titulo: '', data: null, hora: null, prioridade: 0, area: null, recorrencia: null };

  let m = tirar(/\s!!(?=\s)/) || null;
  if (m) r.prioridade = 2;
  else if (tirar(/\s!(?=\s)/)) r.prioridade = 1;

  m = tirar(/\s#([a-z]+)(?=\s)/);
  if (m) {
    const a = AREAS_TAREFA.find((x) => semAcento(x.id) === m[1] || semAcento(x.nome) === m[1]);
    if (a) r.area = a.id;
    else resto = `${resto} #${m[1]} `;
  }

  // Repetição
  if ((m = tirar(/\stodo dia (\d{1,2})(?=\s)/))) r.recorrencia = { tipo: 'mensal', dia: Math.min(31, Math.max(1, Number(m[1]))) };
  else if ((m = tirar(/\s(?:dias uteis|todo dia util)(?=\s)/))) r.recorrencia = { tipo: 'uteis' };
  else if ((m = tirar(/\s(?:todo dia|todos os dias|diariamente)(?=\s)/))) r.recorrencia = { tipo: 'diaria' };
  else if ((m = tirar(/\s(?:todo mes|mensal)(?=\s)/))) r.recorrencia = { tipo: 'mensal', dia: deIso(hoje).getDate() };
  else if ((m = tirar(new RegExp(`\\s(?:toda|todo|todas as|todos os)\\s${RE_DIA}s?(?=\\s)`)))) r.recorrencia = { tipo: 'semanal', dias: [PADRAO_DIA[m[1]]] };
  else if ((m = tirar(/\s(?:toda semana|semanal)(?=\s)/))) r.recorrencia = { tipo: 'semanal', dias: [deIso(hoje).getDay()] };

  // Hora: 18h, 18h30, 18:30, às 9
  if ((m = tirar(/\s(?:as\s)?([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?=\s)/)) || (m = tirar(/\sas\s([01]?\d|2[0-3])(?=\s)/))) {
    r.hora = `${m[1].padStart(2, '0')}:${m[2] || m[3] || '00'}`;
  }

  // Data
  if (tirar(/\sdepois de amanha(?=\s)/)) r.data = somarDias(hoje, 2);
  else if (tirar(/\samanha(?=\s)/)) r.data = somarDias(hoje, 1);
  else if (tirar(/\shoje(?=\s)/)) r.data = hoje;
  else if ((m = tirar(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/))) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : deIso(hoje).getFullYear();
    let s = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!m[3] && s < hoje) s = `${ano + 1}${s.slice(4)}`;
    if (!Number.isNaN(Date.parse(`${s}T12:00:00`))) r.data = s;
  } else if ((m = tirar(/\sdia (\d{1,2})(?=\s)/))) r.data = diaDoMes(hoje, Math.min(31, Number(m[1])));
  else if ((m = tirar(new RegExp(`\\s(?:na |no |nesta |neste |proxima |proximo )?${RE_DIA}(?=\\s)`)))) r.data = proximoDiaDaSemana(hoje, PADRAO_DIA[m[1]]);
  else if (tirar(/\s(?:semana que vem|proxima semana)(?=\s)/)) r.data = proximoDiaDaSemana(somarDias(hoje, 1), 1);

  if (r.recorrencia && !r.data) {
    const hojeServe = r.recorrencia.tipo === 'diaria'
      || (r.recorrencia.tipo === 'uteis' && deIso(hoje).getDay() % 6 !== 0)
      || (r.recorrencia.tipo === 'semanal' && r.recorrencia.dias.includes(deIso(hoje).getDay()))
      || (r.recorrencia.tipo === 'mensal' && deIso(hoje).getDate() === r.recorrencia.dia);
    r.data = hojeServe ? hoje : proximaData(r.recorrencia, hoje);
  }
  if (r.hora && !r.data) r.data = hoje;
  r.titulo = resto.replace(/\s+/g, ' ').trim();
  return r;
}

// --- Visões --------------------------------------------------------------------------------
const vivas = (tarefas) => (tarefas || []).filter((t) => !t.excluido_em);
const abertas = (tarefas) => vivas(tarefas).filter((t) => !t.feita_em);

export function ordenar(a, b) {
  return (a.data || '9999').localeCompare(b.data || '9999')
    || (a.hora || '99').localeCompare(b.hora || '99')
    || (b.prioridade || 0) - (a.prioridade || 0)
    || (a.ordem || 0) - (b.ordem || 0)
    || String(a.criado_em).localeCompare(String(b.criado_em));
}

// Feita hoje: as normais pelo feita_em, as que repetem pelo histórico.
export function feitaNoDia(t, dia) {
  if (t.recorrencia?.tipo) return (t.dados?.feitas || []).includes(dia);
  return Boolean(t.feita_em) && iso(new Date(t.feita_em)) === dia;
}

export function tarefasDeHoje(tarefas, hoje) {
  const lista = abertas(tarefas).filter((t) => t.data && t.data <= hoje).sort(ordenar);
  return {
    atrasadas: lista.filter((t) => t.data < hoje),
    hoje: lista.filter((t) => t.data === hoje),
    feitas: vivas(tarefas).filter((t) => feitaNoDia(t, hoje)),
  };
}

export function proximosDias(tarefas, hoje, dias = 7) {
  const fim = somarDias(hoje, dias);
  const lista = abertas(tarefas).filter((t) => t.data && t.data > hoje && t.data <= fim).sort(ordenar);
  const grupos = [];
  for (const t of lista) {
    const g = grupos.at(-1);
    if (g?.data === t.data) g.itens.push(t);
    else grupos.push({ data: t.data, itens: [t] });
  }
  return grupos;
}

export const algumDia = (tarefas) => abertas(tarefas).filter((t) => !t.data).sort(ordenar);
export const depois = (tarefas, hoje, dias = 7) => abertas(tarefas).filter((t) => t.data && t.data > somarDias(hoje, dias)).sort(ordenar);

export function feitas(tarefas, limite = 50) {
  return vivas(tarefas).filter((t) => t.feita_em && !t.recorrencia?.tipo)
    .sort((a, b) => String(b.feita_em).localeCompare(String(a.feita_em))).slice(0, limite);
}

export function progressoDoProjeto(projeto, tarefas) {
  const doProjeto = vivas(tarefas).filter((t) => t.projeto_id === projeto.id && !t.recorrencia?.tipo);
  const total = doProjeto.length;
  const prontas = doProjeto.filter((t) => t.feita_em).length;
  return { total, prontas, fracao: total ? prontas / total : 0 };
}

// O que muda ao marcar como feita: a normal ganha feita_em; a que repete pula para a próxima data
// e guarda o dia no histórico (assim dá para desfazer).
export function aoConcluir(t, agoraIso, hoje) {
  if (!t.recorrencia?.tipo) return { feita_em: agoraIso };
  const base = t.data && t.data > hoje ? t.data : hoje;
  const feitasAntes = t.dados?.feitas || [];
  return {
    data: proximaData(t.recorrencia, t.data && t.data < hoje ? hoje : base),
    dados: { ...(t.dados || {}), feitas: [...feitasAntes.filter((d) => d !== (t.data || hoje)), t.data && t.data < hoje ? hoje : (t.data || hoje)].slice(-120), dataAnterior: t.data },
  };
}

export function aoDesfazer(t) {
  if (!t.recorrencia?.tipo) return { feita_em: null };
  const feitasAntes = [...(t.dados?.feitas || [])];
  feitasAntes.pop();
  return { data: t.dados?.dataAnterior ?? t.data, dados: { ...(t.dados || {}), feitas: feitasAntes, dataAnterior: null } };
}
