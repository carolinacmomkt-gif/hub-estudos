// Resumo da semana (segunda a domingo, no fuso da Carol). Funções puras: usadas pela tela
// #resumo e pela função de avisos (netlify/functions/avisos-agendado.mjs), que manda o resumo
// no domingo à noite. Não importa nada do navegador.

export const RESUMO_PADRAO = { ativo: true, dia: 0, hora: '20:00' }; // dia: 0 = domingo, 1 = segunda

// Data e minutos do dia no fuso dado.
export function noFuso(instante, fuso) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute), diaSemana: dias[partes.weekday] };
}

const somarDias = (data, n) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Instante (ms) da meia-noite de uma data no fuso (acha o deslocamento do fuso naquele dia).
function meiaNoite(data, fuso) {
  const base = Date.parse(`${data}T00:00:00Z`);
  const { minutos, data: d } = noFuso(base, fuso);
  const deslocamento = (d === data ? minutos : minutos - 24 * 60) * 60000;
  return base - deslocamento;
}

// Semana de segunda a domingo que contém "agora", deslocada "semanas" para trás ou para frente.
export function semanaDe(agora, fuso, semanas = 0) {
  const hoje = noFuso(agora, fuso);
  const segunda = somarDias(hoje.data, -((hoje.diaSemana + 6) % 7) + semanas * 7);
  const domingo = somarDias(segunda, 6);
  return { segunda, domingo, inicio: meiaNoite(segunda, fuso), fim: meiaNoite(somarDias(segunda, 7), fuso), chave: segunda };
}

const tempo = (iso) => (iso ? Date.parse(iso) : NaN);
const dentro = (iso, { inicio, fim }) => {
  const t = tempo(iso);
  return t >= inicio && t < fim;
};

export function textoMinutos(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}

// dados: { sessoes, respostas, artigos, pautas, videos, eventos, disciplinas, areas, cadernos }
export function resumoDaSemana(dados, semana) {
  const ativos = (lista) => (lista || []).filter((x) => !x.excluido_em);
  const nomeDisciplina = new Map(ativos(dados.disciplinas).map((d) => [d.id, d.nome]));
  const nomeArea = new Map(ativos(dados.areas).map((a) => [a.id, a.nome]));
  const nomeDe = (x) => nomeDisciplina.get(x.disciplina_id) || nomeArea.get(x.area_id) || 'Outros';

  const sessoes = ativos(dados.sessoes).filter((s) => dentro(s.inicio, semana));
  const minutosFoco = sessoes.reduce((t, s) => t + (Number(s.minutos) || 0), 0);
  const porAssunto = new Map();
  for (const s of sessoes) porAssunto.set(nomeDe(s), (porAssunto.get(nomeDe(s)) || 0) + (Number(s.minutos) || 0));
  // Minutos de foco por dia (segunda a domingo).
  const porDia = Array.from({ length: 7 }, () => 0);
  for (const s of sessoes) {
    const i = Math.floor((tempo(s.inicio) - semana.inicio) / 86400000);
    if (i >= 0 && i < 7) porDia[i] += Number(s.minutos) || 0;
  }

  const respostas = ativos(dados.respostas).filter((r) => dentro(r.respondida_em || r.criado_em, semana));
  const acertos = respostas.filter((r) => r.correta).length;
  const revisoesFeitas = respostas.filter((r) => r.modo === 'revisao').length;
  const leituras = ativos(dados.artigos).filter((a) => (a.status === 'lido' || a.status === 'fichado') && dentro(a.lido_em, semana));
  const publicados = [
    ...ativos(dados.pautas).filter((p) => p.etapa === 'publicado' && dentro(p.publicado_em, semana)).map((p) => ({ tipo: 'Substack', titulo: p.titulo })),
    ...ativos(dados.videos).filter((v) => v.etapa === 'publicado' && dentro(v.data_publicacao, semana)).map((v) => ({ tipo: 'YouTube', titulo: v.titulo })),
  ];
  const entregues = ativos(dados.eventos).filter((e) => (e.tipo === 'trabalho' || e.tipo === 'atividade') && e.status === 'entregue' && dentro(e.inicio, semana)).length;
  const cadernos = ativos(dados.cadernos).filter((c) => dentro(c.atualizado_em, semana)).length;
  const proxima = { inicio: semana.fim, fim: semana.fim + 7 * 86400000 };
  const proximos = ativos(dados.eventos)
    .filter((e) => ['prova', 'trabalho', 'atividade'].includes(e.tipo) && e.status !== 'entregue' && dentro(e.inicio, proxima))
    .sort((a, b) => tempo(a.inicio) - tempo(b.inicio))
    .map((e) => ({ titulo: e.titulo, tipo: e.tipo, inicio: e.inicio, disciplina: nomeDisciplina.get(e.disciplina_id) || '' }));

  return {
    semana,
    minutosFoco,
    sessoes: sessoes.length,
    porAssunto: [...porAssunto].map(([nome, minutos]) => ({ nome, minutos })).sort((a, b) => b.minutos - a.minutos),
    porDia,
    questoes: { respondidas: respostas.length, acertos, taxa: respostas.length ? acertos / respostas.length : null },
    revisoesFeitas,
    leituras: leituras.map((a) => a.titulo),
    publicados,
    entregues,
    cadernos,
    proximos,
    vazia: !sessoes.length && !respostas.length && !leituras.length && !publicados.length && !entregues && !cadernos,
  };
}

// Texto curto para a notificação do domingo.
export function textoDaNotificacao(r) {
  if (r.vazia) return { titulo: 'Sua semana de estudos', texto: 'Semana mais calma por aqui. Que tal planejar a próxima? Toque para ver os prazos.' };
  const partes = [];
  if (r.minutosFoco) partes.push(`${textoMinutos(r.minutosFoco)} de foco`);
  if (r.questoes.respondidas) partes.push(`${r.questoes.respondidas} questões (${Math.round(r.questoes.taxa * 100)}% de acerto)`);
  if (r.leituras.length) partes.push(`${r.leituras.length} ${r.leituras.length === 1 ? 'leitura' : 'leituras'}`);
  if (r.publicados.length) partes.push(`${r.publicados.length} ${r.publicados.length === 1 ? 'publicação' : 'publicações'}`);
  if (r.entregues) partes.push(`${r.entregues} ${r.entregues === 1 ? 'entrega' : 'entregas'}`);
  const prox = r.proximos.length ? ` Na próxima semana: ${r.proximos.length} ${r.proximos.length === 1 ? 'prazo' : 'prazos'}.` : '';
  return { titulo: 'Sua semana de estudos', texto: `${partes.join(' · ') || 'Você mexeu nos cadernos esta semana.'}.${prox}` };
}

// O resumo deve sair agora? (no dia e horário escolhidos, uma vez por semana)
export function resumoDevido({ config, agora, fuso, ultimaSemana }) {
  const cfg = { ...RESUMO_PADRAO, ...(config || {}) };
  if (!cfg.ativo) return null;
  const local = noFuso(agora, fuso);
  const [h, m] = String(cfg.hora).split(':').map(Number);
  if (local.diaSemana !== Number(cfg.dia) || local.minutos < h * 60 + m) return null;
  // Domingo: resume a semana que está terminando; segunda: a que acabou de terminar.
  const semana = semanaDe(agora, fuso, Number(cfg.dia) === 1 ? -1 : 0);
  return semana.chave === ultimaSemana ? null : semana;
}
