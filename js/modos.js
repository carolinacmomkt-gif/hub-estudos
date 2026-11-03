// Modos de foco (decisão da Carol, 03/11/2026): Tudo, Trabalho, Estudo ou Descanso mudam o menu e o
// Hoje para mostrar só aquele contexto. Fica neste aparelho (hub.modo). E o Arquivo da Faculdade
// (config "faculdade_arquivo"): a Faculdade sai do menu, do Hoje, dos avisos e da sincronização.

export const MODOS = [
  { id: 'tudo', nome: 'Tudo', grupos: null },
  { id: 'trabalho', nome: 'Trabalho', grupos: ['dia', 'planejar', 'trabalho'] },
  { id: 'estudo', nome: 'Estudo', grupos: ['dia', 'planejar', 'estudos', 'criacao'] },
  { id: 'descanso', nome: 'Descanso', grupos: ['dia', 'vida'] },
];

// Cards do Hoje por contexto (os que não estão aqui valem em todos os modos).
const CARDS = {
  trabalho: ['trabalho', 'demandas'],
  estudo: ['prazos', 'provas', 'plano', 'notas', 'precisa', 'faltas', 'avisos', 'leituras', 'cadernos', 'youtube', 'substack'],
  vida: ['financas', 'contas', 'humor', 'sonho', 'sonhofoto', 'fimdesemana', 'recompensas', 'habitos'],
};
export const CARDS_DA_FACULDADE = ['prazos', 'provas', 'plano', 'notas', 'precisa', 'faltas', 'avisos'];

export function modoAtual() {
  try {
    const v = localStorage.getItem('hub.modo');
    return MODOS.some((m) => m.id === v) ? v : 'tudo';
  } catch {
    return 'tudo';
  }
}
export function definirModo(id) {
  try { localStorage.setItem('hub.modo', MODOS.some((m) => m.id === id) ? id : 'tudo'); } catch { /* sem armazenamento */ }
}
export const nomeDoModo = (id = modoAtual()) => MODOS.find((m) => m.id === id)?.nome || 'Tudo';

export function grupoNoModo(grupoId, modo = modoAtual()) {
  const m = MODOS.find((x) => x.id === modo);
  return !m?.grupos || m.grupos.includes(grupoId);
}

export function cardNoModo(cardId, modo = modoAtual()) {
  if (modo === 'tudo') return true;
  if (modo === 'trabalho') return !CARDS.estudo.includes(cardId) && !CARDS.vida.includes(cardId);
  if (modo === 'estudo') return !CARDS.trabalho.includes(cardId) && !CARDS.vida.includes(cardId);
  if (modo === 'descanso') return !CARDS.trabalho.includes(cardId) && !CARDS.estudo.includes(cardId) && !['tarefas', 'prioridades', 'meudia', 'projetos', 'caixa'].includes(cardId);
  return true;
}

export const faculdadeArquivada = (config) => Boolean((config || []).find((c) => c.chave === 'faculdade_arquivo' && !c.excluido_em)?.valor?.arquivada);
