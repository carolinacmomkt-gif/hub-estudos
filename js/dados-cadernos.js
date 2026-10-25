// Cadernos: tipos, capas, estantes, pastas e busca. Funções puras sobre o estado.

import { nomeDaDisciplina, disciplinasAtivas } from './dados-faculdade.js';
import { areasAtivas } from './dados-estudos.js';

export const TIPOS_CADERNO = [
  { id: 'comum', nome: 'Caderno comum', descricao: 'Páginas em sequência.' },
  { id: 'materia', nome: 'Por matéria', descricao: 'Com divisórias (seções), como um caderno de 10 matérias.' },
  { id: 'fichario', nome: 'Fichário', descricao: 'Folhas soltas: reorganize à vontade.' },
  { id: 'pdf', nome: 'Caderno de PDF', descricao: 'Escreva por cima de slides ou de um artigo.' },
  { id: 'infinito', nome: 'Quadro infinito', descricao: 'A folha cresce enquanto você escreve. Bom para mapas mentais.' },
  { id: 'planner', nome: 'Planner', descricao: 'Semanas ou meses já com as datas.' },
];
export const ESTILOS_CAPA = [
  { id: 'lisa', nome: 'Lisa' },
  { id: 'listras', nome: 'Listras' },
  { id: 'pontos', nome: 'Pontos' },
  { id: 'moldura', nome: 'Moldura' },
  { id: 'faixa', nome: 'Faixa' },
  { id: 'xadrez', nome: 'Xadrez' },
];
export const CORES_CAPA = [1, 2, 3, 4, 5, 6];

export const nomeDoTipo = (id) => TIPOS_CADERNO.find((t) => t.id === id)?.nome || 'Caderno comum';

export function cadernosAtivos(estado) {
  return (estado.cadernos || []).filter((c) => !c.excluido_em)
    .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
}

export function pastasAtivas(estado) {
  return (estado.pastas || []).filter((p) => !p.excluido_em)
    .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

export const subpastas = (estado, paiId) => pastasAtivas(estado).filter((p) => (p.pai_id || null) === (paiId || null));

// Caminho da pasta até a raiz (para o "você está em").
export function caminhoDaPasta(estado, id) {
  const todas = pastasAtivas(estado);
  const caminho = [];
  let atual = todas.find((p) => p.id === id);
  while (atual && caminho.length < 20) {
    caminho.unshift(atual);
    atual = todas.find((p) => p.id === atual.pai_id);
  }
  return caminho;
}

// A pasta e todas as que estão dentro dela.
export function pastaEDescendentes(estado, id) {
  const ids = new Set([id]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const p of pastasAtivas(estado)) if (p.pai_id && ids.has(p.pai_id) && !ids.has(p.id)) { ids.add(p.id); mudou = true; }
  }
  return ids;
}

export function textoDeBusca(estado, c) {
  return [c.titulo, ...(c.tags || []), nomeDaDisciplina(estado, c.disciplina_id), areasAtivas(estado).find((a) => a.id === c.area_id)?.nome]
    .filter(Boolean).join(' ').toLowerCase();
}

// Estantes: uma por disciplina e por trilha/tema; o resto fica em "Outros cadernos".
export function estantes(estado, lista = cadernosAtivos(estado)) {
  const grupos = [];
  for (const d of disciplinasAtivas(estado)) {
    const itens = lista.filter((c) => c.disciplina_id === d.id);
    if (itens.length) grupos.push({ id: `d-${d.id}`, nome: d.nome, rotulo: 'Faculdade', itens });
  }
  for (const a of areasAtivas(estado)) {
    const itens = lista.filter((c) => !c.disciplina_id && c.area_id === a.id);
    if (itens.length) grupos.push({ id: `a-${a.id}`, nome: a.nome, rotulo: a.tipo === 'trilha' ? 'Trilha' : 'Tema', itens });
  }
  const usados = new Set(grupos.flatMap((g) => g.itens.map((c) => c.id)));
  const resto = lista.filter((c) => !usados.has(c.id));
  if (resto.length) grupos.push({ id: 'outros', nome: grupos.length ? 'Outros cadernos' : 'Seus cadernos', rotulo: '', itens: resto });
  return grupos;
}

export function capaDe(c) {
  return {
    cor: CORES_CAPA.includes(Number(c?.capa?.cor)) ? Number(c.capa.cor) : 1,
    estilo: ESTILOS_CAPA.some((e) => e.id === c?.capa?.estilo) ? c.capa.estilo : 'lisa',
  };
}

// Segunda-feira da semana de uma data (AAAA-MM-DD) e o primeiro dia do mês.
export function segundaDaSemana(chave) {
  const [a, m, d] = chave.split('-').map(Number);
  const dt = new Date(a, m - 1, d, 12);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return chaveLocal(dt);
}

export function primeiroDoMes(chave) {
  return `${chave.slice(0, 7)}-01`;
}

export function somarPeriodo(chave, tipo, n) {
  const [a, m, d] = chave.split('-').map(Number);
  const dt = tipo === 'mes' ? new Date(a, m - 1 + n, 1, 12) : new Date(a, m - 1, d + 7 * n, 12);
  return chaveLocal(dt);
}

function chaveLocal(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
