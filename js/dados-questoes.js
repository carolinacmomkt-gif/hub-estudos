// Questões: banco, simulados e revisão espaçada (as erradas voltam em 1, 3, 7 e 15 dias).
// Funções puras sobre o estado; quem grava é o eventos-questoes.js.

import { chaveDia, somarDias } from './dados-calendario.js';

export const INTERVALOS = [1, 3, 7, 15]; // dias depois do erro, um por etapa
export const NIVEIS = [
  { id: 'facil', nome: 'Fácil' },
  { id: 'medio', nome: 'Médio' },
  { id: 'dificil', nome: 'Difícil' },
];
export const TIPOS_QUESTAO = [
  { id: 'multipla', nome: 'Múltipla escolha' },
  { id: 'vf', nome: 'Verdadeiro ou falso' },
  { id: 'dissertativa', nome: 'Dissertativa' },
];
export const MODOS = [
  { id: 'prova', nome: 'Prova', descricao: 'Múltipla escolha e V/F. O gabarito e a nota aparecem no fim.' },
  { id: 'fixacao', nome: 'Fixação', descricao: 'Perguntas abertas. A IA corrige cada resposta com nota e comentário.' },
  { id: 'revisao', nome: 'Revisão', descricao: 'As que você errou, no dia de revisar. Mostra o gabarito na hora.' },
];
export const LETRAS = 'ABCDE';

export const nomeNivel = (id) => NIVEIS.find((n) => n.id === id)?.nome || 'Médio';
export const nomeTipo = (id) => TIPOS_QUESTAO.find((t) => t.id === id)?.nome || '';

export function questoesAtivas(estado) {
  return (estado.questoes || []).filter((q) => !q.excluido_em);
}

export function questaoPeloId(estado, id) {
  return questoesAtivas(estado).find((q) => q.id === id) || null;
}

// Revisão aberta (não concluída) de cada questão.
export function revisaoDaQuestao(estado, questaoId) {
  return (estado.revisoes || []).find((r) => r.questao_id === questaoId && !r.excluido_em && !r.concluida_em) || null;
}

// Revisões para fazer hoje (ou atrasadas), só de questões que ainda existem.
export function revisoesDoDia(estado, agora = Date.now()) {
  const hoje = chaveDia(new Date(agora));
  const ids = new Set(questoesAtivas(estado).map((q) => q.id));
  return (estado.revisoes || [])
    .filter((r) => !r.excluido_em && !r.concluida_em && ids.has(r.questao_id) && String(r.proxima_em).slice(0, 10) <= hoje)
    .sort((a, b) => String(a.proxima_em).localeCompare(String(b.proxima_em)));
}

export function proximasRevisoes(estado, agora = Date.now()) {
  const hoje = chaveDia(new Date(agora));
  const ids = new Set(questoesAtivas(estado).map((q) => q.id));
  return (estado.revisoes || [])
    .filter((r) => !r.excluido_em && !r.concluida_em && ids.has(r.questao_id) && String(r.proxima_em).slice(0, 10) > hoje)
    .sort((a, b) => String(a.proxima_em).localeCompare(String(b.proxima_em)));
}

// Próximo passo da revisão depois de responder.
// Errou: volta para a etapa 0 (amanhã). Acertou: sobe uma etapa; depois da última, fica concluída.
export function avancarRevisao(revisao, acertou, agora = Date.now()) {
  const hoje = chaveDia(new Date(agora));
  if (!acertou) return { etapa: 0, proxima_em: somarDias(hoje, INTERVALOS[0]), concluida_em: null };
  const etapa = Number(revisao?.etapa) || 0;
  if (etapa >= INTERVALOS.length - 1) return { etapa, proxima_em: hoje, concluida_em: new Date(agora).toISOString() };
  const nova = etapa + 1;
  return { etapa: nova, proxima_em: somarDias(hoje, INTERVALOS[nova] - INTERVALOS[etapa]), concluida_em: null };
}

// Confere uma resposta objetiva. Dissertativa depende da correção da IA (nota ≥ 6).
export function confere(questao, resposta) {
  if (resposta === undefined || resposta === null || resposta === '') return false;
  if (questao.tipo === 'multipla' || questao.tipo === 'vf') return String(resposta).toUpperCase() === String(questao.resposta_correta).toUpperCase();
  return null;
}

export function textoDaResposta(questao, resposta) {
  if (questao.tipo === 'vf') return resposta === 'V' ? 'Verdadeiro' : resposta === 'F' ? 'Falso' : '—';
  if (questao.tipo === 'multipla') {
    const i = LETRAS.indexOf(String(resposta || '').toUpperCase());
    return i >= 0 && questao.alternativas?.[i] ? `${LETRAS[i]}) ${questao.alternativas[i]}` : '—';
  }
  return resposta || '—';
}

// Nota de 0 a 10 do simulado: objetivas valem 10 ou 0; dissertativas, a nota da IA.
export function notaDoSimulado(simulado, questoes) {
  const respostas = simulado.respostas || {};
  let soma = 0;
  let acertos = 0;
  for (const q of questoes) {
    const r = respostas[q.id] || {};
    const nota = q.tipo === 'dissertativa' ? Number(r.nota) || 0 : (r.correta ? 10 : 0);
    soma += nota;
    if (r.correta) acertos += 1;
  }
  const total = questoes.length;
  return { acertos, total, nota: total ? Math.round((soma / total) * 10) / 10 : 0 };
}

export function taxaDeAcerto(q) {
  const tentativas = (Number(q.acertos) || 0) + (Number(q.erros) || 0);
  return tentativas ? (Number(q.acertos) || 0) / tentativas : null;
}

// filtros: { busca, disciplina, area, tipo, nivel, tag, situacao: ''|'erradas'|'novas'|'revisao' }
export function filtrarQuestoes(estado, filtros = {}) {
  const busca = String(filtros.busca || '').trim().toLowerCase();
  const emRevisao = new Set((estado.revisoes || []).filter((r) => !r.excluido_em && !r.concluida_em).map((r) => r.questao_id));
  return questoesAtivas(estado).filter((q) => {
    if (filtros.disciplina && q.disciplina_id !== filtros.disciplina) return false;
    if (filtros.area && q.area_id !== filtros.area) return false;
    if (filtros.tipo && q.tipo !== filtros.tipo) return false;
    if (filtros.nivel && q.nivel !== filtros.nivel) return false;
    if (filtros.tag && !(q.tags || []).includes(filtros.tag)) return false;
    if (filtros.situacao === 'erradas' && !(Number(q.erros) > 0)) return false;
    if (filtros.situacao === 'novas' && (Number(q.acertos) || Number(q.erros))) return false;
    if (filtros.situacao === 'revisao' && !emRevisao.has(q.id)) return false;
    if (busca && !`${q.enunciado} ${(q.tags || []).join(' ')}`.toLowerCase().includes(busca)) return false;
    return true;
  }).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}

export function tagsDasQuestoes(estado) {
  return [...new Set(questoesAtivas(estado).flatMap((q) => q.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function resumoDoBanco(estado, agora = Date.now()) {
  const qs = questoesAtivas(estado);
  const acertos = qs.reduce((s, q) => s + (Number(q.acertos) || 0), 0);
  const erros = qs.reduce((s, q) => s + (Number(q.erros) || 0), 0);
  return {
    total: qs.length,
    novas: qs.filter((q) => !(Number(q.acertos) || Number(q.erros))).length,
    acerto: acertos + erros ? acertos / (acertos + erros) : null,
    hoje: revisoesDoDia(estado, agora).length,
  };
}

export function simuladosFeitos(estado) {
  return (estado.simulados || []).filter((s) => !s.excluido_em)
    .sort((a, b) => String(b.iniciado_em || b.criado_em).localeCompare(String(a.iniciado_em || a.criado_em)));
}

// Sorteia até n questões (embaralha uma cópia).
export function sortear(lista, n) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, n);
}

// Questões que cabem no modo: prova = objetivas; fixação = dissertativas (ou qualquer uma, respondida por escrito).
export function cabeNoModo(q, modo) {
  if (modo === 'prova') return q.tipo === 'multipla' || q.tipo === 'vf';
  return true;
}

// Revisões pendentes agrupadas por disciplina/área (para o card do Início).
export function revisoesPorGrupo(estado, nomeDoGrupo, agora = Date.now()) {
  const grupos = new Map();
  for (const r of revisoesDoDia(estado, agora)) {
    const q = questaoPeloId(estado, r.questao_id);
    const nome = nomeDoGrupo(q) || 'Sem disciplina';
    grupos.set(nome, (grupos.get(nome) || 0) + 1);
  }
  return [...grupos].map(([disciplina, quantidade]) => ({ disciplina, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}
