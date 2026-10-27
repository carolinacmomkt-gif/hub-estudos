// Arranjo do Início: quais cards aparecem, em que ordem e de que tamanho, e os cards
// criados pela Carol (nota, atalhos, checklist e contagem regressiva).
// Fica em config (chave "inicio"), então vale para todos os aparelhos.

import { listar, salvar } from './persistencia.js';

export const CARDS_DO_APP = [
  { id: 'proximo', nome: 'Próximo passo', tamanho: 'inteiro' },
  { id: 'prazos', nome: 'Prazos dos próximos 7 dias', tamanho: '2/3' },
  { id: 'provas', nome: 'Provas', tamanho: '1/3' },
  { id: 'plano', nome: 'Plano para a prova', tamanho: '2/3' },
  { id: 'revisoes', nome: 'Revisões pendentes', tamanho: '1/3' },
  { id: 'notas', nome: 'Últimas notas', tamanho: '2/3' },
  { id: 'faltas', nome: 'Atenção às faltas', tamanho: '1/3' },
  { id: 'avisos', nome: 'Avisos da faculdade', tamanho: '2/3' },
  { id: 'youtube', nome: 'YouTube', tamanho: '1/3' },
  { id: 'foco', nome: 'Sessão de foco', tamanho: '1/3' },
  { id: 'resumo', nome: 'Sua semana', tamanho: '1/3' },
  { id: 'leituras', nome: 'Leituras', tamanho: 'metade' },
  { id: 'substack', nome: 'Substack', tamanho: 'metade' },
  { id: 'caixa', nome: 'Caixa de entrada', tamanho: 'inteiro' },
  { id: 'cadernos', nome: 'Cadernos recentes', tamanho: 'inteiro' },
  { id: 'progresso', nome: 'Progresso por área', tamanho: 'inteiro' },
];

export const TIPOS_PROPRIOS = [
  { id: 'nota', nome: 'Nota livre', descricao: 'Frase do dia, metas, lembretes fixos' },
  { id: 'atalhos', nome: 'Atalhos', descricao: 'Botões para os seus links ou telas do app' },
  { id: 'checklist', nome: 'Checklist', descricao: 'Tarefas curtas para marcar' },
  { id: 'contagem', nome: 'Contagem regressiva', descricao: 'Dias até uma data sua' },
];

export const TAMANHOS = [
  { id: 'inteiro', nome: 'Inteiro' },
  { id: '2/3', nome: '2/3' },
  { id: 'metade', nome: 'Metade' },
  { id: '1/3', nome: '1/3' },
];

// Altura escolhida ao puxar o canto (em px); sem altura, o card se ajusta ao conteúdo.
export const ALTURA_MIN = 120;
export const ALTURA_MAX = 1200;

const PADRAO_PROPRIO = { nota: 'metade', atalhos: 'metade', checklist: '1/3', contagem: '1/3' };

function salvo(estado) {
  return (estado.config || []).find((c) => c.chave === 'inicio' && !c.excluido_em)?.valor || {};
}

// Lista final de blocos: o que está salvo, mais os cards do app que surgiram depois.
export function blocosDoInicio(estado) {
  const v = salvo(estado);
  const proprios = v.proprios || {};
  const conhecidos = new Set(CARDS_DO_APP.map((c) => c.id));
  const tamanhoOk = (t) => TAMANHOS.some((x) => x.id === t);
  const blocos = (Array.isArray(v.blocos) ? v.blocos : [])
    .filter((b) => conhecidos.has(b.id) || proprios[b.id])
    .map((b) => ({
      id: b.id,
      visivel: b.visivel !== false,
      tamanho: tamanhoOk(b.tamanho) ? b.tamanho : '2/3',
      altura: Number(b.altura) >= ALTURA_MIN ? Math.min(ALTURA_MAX, Number(b.altura)) : null,
    }));
  const presentes = new Set(blocos.map((b) => b.id));
  CARDS_DO_APP.forEach((c, i) => {
    if (presentes.has(c.id)) return;
    // Card novo do app entra na posição do padrão (ou no fim).
    blocos.splice(Math.min(i, blocos.length), 0, { id: c.id, visivel: true, tamanho: c.tamanho, altura: null });
  });
  return { blocos, proprios };
}

export function nomeDoBloco(id, proprios) {
  const doApp = CARDS_DO_APP.find((c) => c.id === id);
  if (doApp) return doApp.nome;
  const p = proprios[id];
  return p?.titulo || TIPOS_PROPRIOS.find((t) => t.id === p?.tipo)?.nome || 'Card';
}

async function mudar(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'inicio');
  const base = blocosDoInicio({ config: atual ? [atual] : [] });
  fn(base);
  await salvar('config', { ...(atual || {}), chave: 'inicio', valor: { blocos: base.blocos, proprios: base.proprios } });
}

export const moverBloco = (id, passo) => mudar(({ blocos }) => {
  const i = blocos.findIndex((b) => b.id === id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= blocos.length) return;
  [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
});

// Arrastar e soltar: coloca o bloco "id" antes (ou depois) do bloco "alvoId".
export const colocarBloco = (id, alvoId, depois = false) => mudar(({ blocos }) => {
  const i = blocos.findIndex((b) => b.id === id);
  if (i < 0 || id === alvoId) return;
  const [bloco] = blocos.splice(i, 1);
  let j = blocos.findIndex((b) => b.id === alvoId);
  if (j < 0) j = blocos.length;
  else if (depois) j += 1;
  blocos.splice(j, 0, bloco);
});

// Puxar o canto: largura (um dos TAMANHOS) e altura em px (null = automática).
export const redimensionar = (id, tamanho, altura) => mudar(({ blocos }) => {
  const b = blocos.find((x) => x.id === id);
  if (!b) return;
  if (TAMANHOS.some((t) => t.id === tamanho)) b.tamanho = tamanho;
  if (altura !== undefined) b.altura = altura === null ? null : Math.round(Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, altura)));
});

export const mudarTamanho = (id, tamanho) => redimensionar(id, tamanho);

// Remover tira do Início (o card continua na lista "Adicionar"); adicionar põe de volta no topo.
export const removerBloco = (id) => mudar(({ blocos }) => {
  const b = blocos.find((x) => x.id === id);
  if (b) b.visivel = false;
});

export const adicionarBloco = (id) => mudar(({ blocos }) => {
  const i = blocos.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [b] = blocos.splice(i, 1);
  b.visivel = true;
  blocos.unshift(b);
});

export const alternarVisivel = (id) => mudar(({ blocos }) => {
  const b = blocos.find((x) => x.id === id);
  if (b) b.visivel = !b.visivel;
});

export function adicionarProprio(tipo, dados) {
  const id = `meu-${crypto.randomUUID().slice(0, 8)}`;
  return mudar((v) => {
    v.proprios[id] = { tipo, ...dados };
    v.blocos.unshift({ id, visivel: true, tamanho: PADRAO_PROPRIO[tipo] || 'metade', altura: null });
  }).then(() => id);
}

export const editarProprio = (id, dados) => mudar((v) => {
  if (v.proprios[id]) v.proprios[id] = { ...v.proprios[id], ...dados };
});

export const removerProprio = (id) => mudar((v) => {
  delete v.proprios[id];
  v.blocos = v.blocos.filter((b) => b.id !== id);
});

export const marcarItem = (id, indice) => mudar((v) => {
  const item = v.proprios[id]?.itens?.[indice];
  if (item) item.feito = !item.feito;
});

// Volta à ordem e aos tamanhos do padrão, mas guarda os cards próprios (ocultos).
export const voltarAoPadrao = () => mudar((v) => {
  v.blocos = [
    ...CARDS_DO_APP.map((c) => ({ id: c.id, visivel: true, tamanho: c.tamanho, altura: null })),
    ...Object.keys(v.proprios).map((id) => ({ id, visivel: false, tamanho: PADRAO_PROPRIO[v.proprios[id].tipo] || 'metade' })),
  ];
});
