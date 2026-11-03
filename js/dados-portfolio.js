// Gestão de projetos (decisão da Carol, 03/11/2026): painel de projetos (portfólio por área, com farol),
// quadro das tarefas (a fazer → fazendo → feito) e a revisão semanal guiada.
// Sem DOM, para dar para testar sozinho.

import { AREAS_TAREFA, progressoDoProjeto, somarDias, iso } from './dados-tarefas.js';
import { ritmoDoProjeto } from './dados-projetos.js';

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const DIA = 864e5;
const dias = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);

export const FAROL = {
  atrasado: { nome: 'Atrasado', ordem: 0 },
  risco: { nome: 'Em risco', ordem: 1 },
  prazo: { nome: 'No prazo', ordem: 2 },
  pausado: { nome: 'Pausado', ordem: 3 },
  concluido: { nome: 'Concluído', ordem: 4 },
};

// Farol de um projeto: atrasado (prazo passou ou tarefa vencida), em risco (prazo em até 7 dias com
// menos de 70% feito, ou parado há 14 dias com tarefas abertas), no prazo, pausado ou concluído.
export function statusDoProjeto(p, tarefas, hoje = iso(new Date())) {
  const pr = progressoDoProjeto(p, tarefas);
  const doProjeto = vivos(tarefas).filter((t) => t.projeto_id === p.id && !t.recorrencia?.tipo);
  const abertas = doProjeto.filter((t) => !t.feita_em);
  const proxima = abertas.filter((t) => t.data || t.prazo).sort((a, b) => (a.prazo || a.data).localeCompare(b.prazo || b.data))[0]
    || abertas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0))[0] || null;
  const base = { progresso: pr, proxima, abertas: abertas.length };
  if (p.status === 'concluido') return { ...base, farol: 'concluido', motivo: 'Concluído' };
  if (p.status === 'pausado') return { ...base, farol: 'pausado', motivo: 'Pausado' };
  const vencidas = abertas.filter((t) => (t.prazo || t.data) && (t.prazo || t.data) < hoje);
  if (p.prazo && p.prazo < hoje) return { ...base, farol: 'atrasado', motivo: `O prazo passou há ${dias(p.prazo, hoje)} ${dias(p.prazo, hoje) === 1 ? 'dia' : 'dias'}` };
  if (vencidas.length) return { ...base, farol: 'atrasado', motivo: `${vencidas.length} ${vencidas.length === 1 ? 'tarefa vencida' : 'tarefas vencidas'}` };
  // Projeto com painel: o número principal abaixo do ritmo (ex.: vendas no carrinho aberto) é risco.
  const ritmo = ritmoDoProjeto(p, hoje);
  if (ritmo?.abaixo && !ritmo.encerrada) return { ...base, farol: 'risco', motivo: ritmo.texto };
  if (p.prazo && dias(hoje, p.prazo) <= 7 && pr.fracao < 0.7) return { ...base, farol: 'risco', motivo: `Prazo em ${dias(hoje, p.prazo)} dias e ${Math.round(pr.fracao * 100)}% feito` };
  const ultima = [p.atualizado_em, ...doProjeto.map((t) => t.feita_em || t.atualizado_em)].filter(Boolean).sort().pop();
  if (abertas.length && ultima && dias(String(ultima).slice(0, 10), hoje) >= 14) return { ...base, farol: 'risco', motivo: `Parado há ${dias(String(ultima).slice(0, 10), hoje)} dias` };
  if (!pr.total) return { ...base, farol: 'risco', motivo: 'Sem tarefas: qual é o próximo passo?' };
  return { ...base, farol: 'prazo', motivo: p.prazo ? `Prazo em ${dias(hoje, p.prazo)} dias` : 'Sem prazo' };
}

// Metas que um projeto move (ligação "projeto" ou "projetos" da meta).
export function metasDoProjeto(projetoId, metas) {
  return vivos(metas).filter((m) => {
    const lig = m.dados?.ligacao;
    return (lig?.tipo === 'projeto' && lig.id === projetoId) || (lig?.tipo === 'projetos' && (lig.ids || []).includes(projetoId));
  });
}

export function portfolio(estado, hoje = iso(new Date())) {
  const projetos = vivos(estado.projetos);
  const areas = AREAS_TAREFA.map((a) => {
    const itens = projetos.filter((p) => (p.area || 'pessoal') === a.id)
      .map((p) => ({ projeto: p, ...statusDoProjeto(p, estado.tarefas, hoje), metas: metasDoProjeto(p.id, estado.metas) }))
      .sort((x, y) => FAROL[x.farol].ordem - FAROL[y.farol].ordem || (x.projeto.prazo || '9999').localeCompare(y.projeto.prazo || '9999'));
    return { ...a, itens };
  }).filter((a) => a.itens.length);
  const todos = areas.flatMap((a) => a.itens);
  const contagem = Object.fromEntries(Object.keys(FAROL).map((k) => [k, todos.filter((x) => x.farol === k).length]));
  return { areas, contagem, ativos: todos.filter((x) => !['concluido', 'pausado'].includes(x.farol)) };
}

// ---------------------------------------------------------------------------
// Quadro das tarefas: a fazer → fazendo → feito (o "fazendo" fica em tarefa.dados.fazendo)
// ---------------------------------------------------------------------------

export const COLUNAS = [
  { id: 'afazer', nome: 'A fazer' },
  { id: 'fazendo', nome: 'Fazendo' },
  { id: 'feito', nome: 'Feito' },
];
export const colunaDa = (t) => (t.feita_em ? 'feito' : t.dados?.fazendo ? 'fazendo' : 'afazer');

export function quadroDoProjeto(projetoId, tarefas, hoje = iso(new Date())) {
  const lista = vivos(tarefas).filter((t) => t.projeto_id === projetoId && !t.recorrencia?.tipo);
  const recentes = (t) => !t.feita_em || dias(String(t.feita_em).slice(0, 10), hoje) <= 30;
  return COLUNAS.map((c) => ({
    ...c,
    tarefas: lista.filter((t) => colunaDa(t) === c.id && recentes(t))
      .sort((a, b) => (a.prazo || a.data || '9999').localeCompare(b.prazo || b.data || '9999') || (a.ordem || 0) - (b.ordem || 0)),
  }));
}

export const segundaDe = (data) => { const d = new Date(`${data}T12:00:00Z`); return somarDias(data, -((d.getUTCDay() + 6) % 7)); };

// ---------------------------------------------------------------------------
// Revisão semanal guiada (config "revisao_semanal" { [segunda]: { passos, prioridades, feita_em } })
// ---------------------------------------------------------------------------

export const PASSOS_REVISAO = [
  { id: 'entrada', nome: 'Esvaziar a entrada', ajuda: 'Capturas e demandas novas: cada uma vira tarefa, projeto ou sai.', rota: '#entrada' },
  { id: 'atrasadas', nome: 'Resolver as atrasadas', ajuda: 'Fazer, mudar o dia ou largar o que passou do prazo.', rota: '#tarefas/hoje' },
  { id: 'projetos', nome: 'Olhar os projetos em risco', ajuda: 'Cada projeto ativo precisa de um próximo passo com dia.', rota: '#portfolio' },
  { id: 'datas', nome: 'Ver as datas das clientes (30 dias)', ajuda: 'Dias das profissões, campanhas e feriados que pedem post.', rota: '#calendario' },
  { id: 'prioridades', nome: 'Escolher as 3 prioridades da semana', ajuda: 'O que, se ficar pronto, faz a semana valer.', rota: '#revisao' },
];

export function revisaoDaSemana(config, hoje = iso(new Date())) {
  const semana = segundaDe(hoje);
  const v = (config || []).find((c) => c.chave === 'revisao_semanal' && !c.excluido_em)?.valor || {};
  return { semana, ...(v[semana] || { passos: {}, prioridades: [], feita_em: null }), todas: v };
}

// Números de cada passo (para mostrar o que falta).
export function numerosDaRevisao(estado, { demandasNovas = 0, capturas = 0, datas30 = 0 } = {}, hoje = iso(new Date())) {
  const abertas = vivos(estado.tarefas).filter((t) => !t.feita_em && !t.recorrencia?.tipo);
  const atrasadas = abertas.filter((t) => (t.prazo || t.data) && (t.prazo || t.data) < hoje).length;
  const pf = portfolio(estado, hoje);
  const semPasso = pf.ativos.filter((x) => !x.proxima).length;
  return {
    entrada: demandasNovas + capturas,
    atrasadas,
    projetos: pf.contagem.atrasado + pf.contagem.risco + semPasso,
    datas: datas30,
  };
}
