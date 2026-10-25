// Plano de estudo para provas: sugere sessões de revisão nos dias anteriores e cria
// os eventos (tipo "revisao") quando a Carol aceita. As preferências e o registro dos
// planos ficam em config (chave "plano_estudo").

import { listar, salvar } from './persistencia.js';
import { chaveDia, somarDias, instanteLocal, eventosDoCalendario } from './dados-calendario.js';

export const PLANO_PADRAO = { dias: [7, 4, 2, 1], minutos: 50, hora: '19:00' };
export const OPCOES_DIAS = [10, 7, 5, 4, 3, 2, 1];
export const OPCOES_MINUTOS = [30, 50, 90];
const JANELA_DIAS = 30; // provas até 30 dias à frente

function registro(estado) {
  return (estado.config || []).find((c) => c.chave === 'plano_estudo' && !c.excluido_em)?.valor || {};
}

export function preferenciasPlano(estado) {
  const v = registro(estado);
  return {
    dias: Array.isArray(v.dias) && v.dias.length ? v.dias : PLANO_PADRAO.dias,
    minutos: Number(v.minutos) || PLANO_PADRAO.minutos,
    hora: /^\d{2}:\d{2}$/.test(v.hora || '') ? v.hora : PLANO_PADRAO.hora,
  };
}

async function gravarRegistro(mudar) {
  const atual = (await listar('config')).find((c) => c.chave === 'plano_estudo');
  const valor = { dispensadas: [], planos: {}, ...(atual?.valor || {}) };
  mudar(valor);
  await salvar('config', { ...(atual || {}), chave: 'plano_estudo', valor });
}

export const salvarPreferenciasPlano = (prefs) => gravarRegistro((v) => Object.assign(v, prefs));

export function sessoesDaProva(estado, provaId) {
  return eventosDoCalendario(estado)
    .filter((e) => e.tipo === 'revisao' && e.prova_id === provaId)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
}

// Provas que pedem atenção: sem plano ("novo") ou com plano feito para outra data ("remarcar").
export function provasParaPlanejar(estado, agora = Date.now()) {
  const reg = registro(estado);
  const dispensadas = new Set(reg.dispensadas || []);
  const limite = agora + JANELA_DIAS * 24 * 60 * 60 * 1000;
  return eventosDoCalendario(estado)
    .filter((e) => e.tipo === 'prova' && !dispensadas.has(e.id))
    .filter((e) => { const t = new Date(e.inicio).getTime(); return t > agora && t <= limite; })
    .map((prova) => {
      const sessoes = sessoesDaProva(estado, prova.id);
      const plano = reg.planos?.[prova.id];
      if (!sessoes.length) return { prova, situacao: 'novo' };
      // Compara o instante, não o texto: o Supabase devolve a mesma data em outro formato.
      if (plano && Date.parse(plano.inicio) !== Date.parse(prova.inicio) && sessoes.some((s) => new Date(s.inicio).getTime() > agora)) return { prova, situacao: 'remarcar' };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.prova.inicio) - new Date(b.prova.inicio));
}

// Dias disponíveis para revisar (de hoje até a véspera), no máximo 14.
export function diasPossiveis(prova, agora = Date.now()) {
  const hoje = chaveDia(new Date(agora));
  const vespera = somarDias(chaveDia(prova.inicio), -1);
  const dias = [];
  for (let d = vespera; d >= hoje && dias.length < 14; d = somarDias(d, -1)) dias.unshift(d);
  return dias;
}

// Sessões sugeridas: os "dias antes" escolhidos que ainda não passaram. Se nenhum couber
// (prova muito perto), sugere uma sessão hoje ou amanhã.
export function sugerirSessoes(prova, prefs, agora = Date.now()) {
  const diaProva = chaveDia(prova.inicio);
  const possiveis = new Set(diasPossiveis(prova, agora));
  const hoje = chaveDia(new Date(agora));
  const passouDaHora = (dia) => dia === hoje && new Date(instanteLocal(dia, prefs.hora)).getTime() <= agora;
  let dias = [...new Set(prefs.dias)].map((n) => somarDias(diaProva, -n)).filter((d) => possiveis.has(d) && !passouDaHora(d)).sort();
  if (!dias.length) {
    const reserva = [...possiveis].filter((d) => !passouDaHora(d)).sort();
    dias = reserva.length ? [reserva[reserva.length - 1]] : [];
  }
  return dias.map((dia) => ({ dia, hora: prefs.hora, minutos: prefs.minutos }));
}

function eventoDaSessao(prova, sessao) {
  const inicio = instanteLocal(sessao.dia, sessao.hora);
  return {
    tipo: 'revisao',
    titulo: `Revisão: ${prova.titulo}`.slice(0, 140),
    disciplina_id: prova.disciplina_id || null,
    prova_id: prova.id,
    inicio,
    fim: new Date(new Date(inicio).getTime() + sessao.minutos * 60 * 1000).toISOString(),
    dia_inteiro: false,
    status: null,
    origem: 'manual',
    descricao: 'Sessão do plano de estudo. Revise os cadernos e refaça as questões desta disciplina.',
  };
}

export async function criarPlano(prova, sessoes) {
  for (const s of sessoes) await salvar('eventos', eventoDaSessao(prova, s));
  await gravarRegistro((v) => {
    v.planos = { ...(v.planos || {}), [prova.id]: { inicio: prova.inicio } };
    v.dispensadas = (v.dispensadas || []).filter((id) => id !== prova.id);
  });
}

// A prova mudou de data: as sessões que ainda não aconteceram saem e entram as novas.
export async function remarcarPlano(estado, prova, prefs, agora = Date.now()) {
  for (const s of sessoesDaProva(estado, prova.id)) {
    if (new Date(s.inicio).getTime() > agora) await salvar('eventos', { ...s, excluido_em: new Date().toISOString() });
  }
  await criarPlano(prova, sugerirSessoes(prova, prefs, agora));
}

// "Agora não" (ou "Manter as sessões", quando a data mudou).
export function dispensarPlano(prova, { manter = false } = {}) {
  return gravarRegistro((v) => {
    if (manter) v.planos = { ...(v.planos || {}), [prova.id]: { inicio: prova.inicio } };
    else v.dispensadas = [...new Set([...(v.dispensadas || []), prova.id])];
  });
}
