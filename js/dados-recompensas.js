// Gamificação sem tela: pontos (XP) calculados a partir do que a Carol já fez, nível, conquistas,
// sequência de dias sem culpa e o saldo para resgatar recompensas. Nada aqui tira pontos:
// um dia parado não pune (ideia do Finch, ao contrário do Habitica, que tira vida).

export const PONTOS = {
  tarefa: 10, importante: 5, urgente: 10, repeticao: 5, projeto: 50, caixinha: 30, humor: 2, lancamento: 1,
};

export const RECOMPENSAS_PADRAO = [
  { id: 'drive', emoji: '🍔', nome: 'Drive-thru', custo: 60, valor: 35 },
  { id: 'cafe', emoji: '☕', nome: 'Café especial', custo: 100, valor: 25 },
  { id: 'cinema', emoji: '🎬', nome: 'Cinema', custo: 200, valor: 45 },
  { id: 'shopping', emoji: '🛍️', nome: 'Passeio no shopping', custo: 250, valor: 0 },
  { id: 'livro', emoji: '📚', nome: 'Comprar um livro', custo: 300, valor: 60 },
  { id: 'goiania', emoji: '🚗', nome: 'Passeio em Goiânia', custo: 500, valor: 0 },
  { id: 'brasilia', emoji: '🏛️', nome: 'Passeio em Brasília', custo: 800, valor: 0 },
];

const TITULOS = ['Começando', 'No ritmo', 'Constante', 'Focada', 'Determinada', 'Imparável', 'Inspiradora', 'Lendária'];

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diaDe = (momento) => iso(new Date(momento));
const somarDias = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };

// Cada ponto ganho, com o dia (para a sequência e o "hoje").
export function ganhos(dados) {
  const lista = [];
  for (const t of vivos(dados.tarefas)) {
    if (t.recorrencia?.tipo) {
      for (const d of t.dados?.feitas || []) lista.push({ dia: d, pontos: PONTOS.repeticao, tipo: 'tarefa' });
    } else if (t.feita_em) {
      const extra = t.prioridade === 2 ? PONTOS.urgente : t.prioridade === 1 ? PONTOS.importante : 0;
      lista.push({ dia: diaDe(t.feita_em), pontos: PONTOS.tarefa + extra, tipo: 'tarefa' });
    }
  }
  for (const s of vivos(dados.sessoes)) {
    const min = Number(s.minutos) || 0;
    if (min >= 5) lista.push({ dia: diaDe(s.inicio), pontos: Math.round(min * (s.concluida ? 0.6 : 0.3)), tipo: 'foco' });
  }
  for (const p of vivos(dados.projetos)) {
    if (p.status === 'concluido') lista.push({ dia: diaDe(p.atualizado_em || Date.now()), pontos: PONTOS.projeto, tipo: 'projeto' });
  }
  for (const f of vivos(dados.financas)) {
    if (f.tipo === 'caixinha' && Number(f.valor) > 0 && Number(f.dados?.guardado) >= Number(f.valor)) {
      lista.push({ dia: diaDe(f.atualizado_em || Date.now()), pontos: PONTOS.caixinha, tipo: 'caixinha' });
    } else if ((f.tipo === 'entrada' || f.tipo === 'saida') && !f.dados?.recompensa) {
      lista.push({ dia: f.data, pontos: PONTOS.lancamento, tipo: 'lancamento' });
    }
  }
  for (const d of vivos(dados.diario)) {
    if (d.humor || d.energia) lista.push({ dia: d.data, pontos: PONTOS.humor, tipo: 'humor' });
  }
  return lista;
}

// Nível: cada nível pede um pouco mais que o anterior (100, 150, 200…).
export function nivelDe(xp) {
  let nivel = 1;
  let base = 0;
  let passo = 100;
  while (xp >= base + passo) {
    base += passo;
    nivel += 1;
    passo += 50;
  }
  return { nivel, titulo: TITULOS[Math.min(TITULOS.length - 1, nivel - 1)], doNivel: xp - base, paraProximo: passo, fracao: (xp - base) / passo };
}

// Dias seguidos com alguma coisa feita. Sem culpa: um dia de folga a cada 7 não quebra.
export function sequencia(lista, hoje) {
  const dias = new Set(lista.map((g) => g.dia));
  let atual = dias.has(hoje) ? hoje : somarDias(hoje, -1);
  if (!dias.has(atual)) return { dias: 0, folgaUsada: false };
  let total = 0;
  let ultimaFolga = null;
  let folgaUsada = false;
  for (let i = 0; i < 400; i += 1) {
    if (dias.has(atual)) {
      total += 1;
    } else {
      const podeFolgar = !ultimaFolga || (new Date(`${ultimaFolga}T12:00:00`) - new Date(`${atual}T12:00:00`)) / 864e5 >= 7;
      if (!podeFolgar || !dias.has(somarDias(atual, -1))) break;
      ultimaFolga = atual;
      folgaUsada = true;
    }
    atual = somarDias(atual, -1);
  }
  return { dias: total, folgaUsada };
}

export function conquistas(dados, lista) {
  const conta = (tipo) => lista.filter((g) => g.tipo === tipo).length;
  const tarefas = conta('tarefa');
  const diasFoco = new Set(lista.filter((g) => g.tipo === 'foco').map((g) => g.dia)).size;
  const diasHumor = new Set(lista.filter((g) => g.tipo === 'humor').map((g) => g.dia)).size;
  const projetos = conta('projeto');
  const caixinhas = conta('caixinha');
  const mesesAzul = (() => {
    const meses = new Map();
    for (const f of vivos(dados.financas)) {
      if (f.tipo !== 'entrada' && f.tipo !== 'saida') continue;
      const m = String(f.data).slice(0, 7);
      meses.set(m, (meses.get(m) || 0) + (f.tipo === 'entrada' ? 1 : -1) * (Number(f.valor) || 0));
    }
    const atual = iso(new Date()).slice(0, 7);
    return [...meses].filter(([m, saldo]) => m < atual && saldo > 0).length;
  })();
  const seq = sequencia(lista, iso(new Date())).dias;
  const lista_ = [
    { id: 'tarefa-1', emoji: '✅', nome: 'Primeiro passo', texto: 'Concluir a primeira tarefa', atual: tarefas, meta: 1 },
    { id: 'tarefa-10', emoji: '📋', nome: 'Pegando o jeito', texto: '10 tarefas concluídas', atual: tarefas, meta: 10 },
    { id: 'tarefa-50', emoji: '🚀', nome: 'Máquina de fazer', texto: '50 tarefas concluídas', atual: tarefas, meta: 50 },
    { id: 'tarefa-200', emoji: '🏆', nome: 'Lenda das listas', texto: '200 tarefas concluídas', atual: tarefas, meta: 200 },
    { id: 'foco-1', emoji: '⏱️', nome: 'Primeiro foco', texto: 'Fazer uma sessão de foco', atual: diasFoco, meta: 1 },
    { id: 'foco-7', emoji: '🎯', nome: 'Semana focada', texto: 'Focar em 7 dias diferentes', atual: diasFoco, meta: 7 },
    { id: 'foco-30', emoji: '🧠', nome: 'Mente de aço', texto: 'Focar em 30 dias diferentes', atual: diasFoco, meta: 30 },
    { id: 'sequencia-7', emoji: '🔥', nome: '7 dias no ritmo', texto: '7 dias seguidos com algo feito', atual: seq, meta: 7 },
    { id: 'sequencia-30', emoji: '🌟', nome: 'Mês inteiro', texto: '30 dias seguidos com algo feito', atual: seq, meta: 30 },
    { id: 'projeto-1', emoji: '🏁', nome: 'Projeto entregue', texto: 'Concluir um projeto', atual: projetos, meta: 1 },
    { id: 'caixinha-1', emoji: '🐷', nome: 'Meta guardada', texto: 'Bater a meta de uma caixinha', atual: caixinhas, meta: 1 },
    { id: 'mes-azul', emoji: '💚', nome: 'Mês no azul', texto: 'Fechar um mês com sobra', atual: mesesAzul, meta: 1 },
    { id: 'diario-7', emoji: '📓', nome: 'Me conhecendo', texto: 'Registrar como está em 7 dias', atual: diasHumor, meta: 7 },
  ];
  return lista_.map((c) => ({ ...c, feita: c.atual >= c.meta, fracao: Math.min(1, c.atual / c.meta) }));
}

export function recompensasDe(config) {
  const v = (config || []).find((c) => c.chave === 'recompensas' && !c.excluido_em)?.valor || {};
  const itens = Array.isArray(v.itens) ? v.itens : RECOMPENSAS_PADRAO;
  return { itens: itens.filter((i) => !i.removida), resgates: Array.isArray(v.resgates) ? v.resgates : [] };
}

// Tudo junto, para a tela e o card do Hoje.
export function situacaoGamificacao(dados, hoje = iso(new Date())) {
  const lista = ganhos(dados);
  const xp = lista.reduce((t, g) => t + g.pontos, 0);
  const { itens, resgates } = recompensasDe(dados.config);
  const gastos = resgates.reduce((t, r) => t + (Number(r.pontos) || 0), 0);
  const saldo = Math.max(0, xp - gastos);
  const hojeXp = lista.filter((g) => g.dia === hoje).reduce((t, g) => t + g.pontos, 0);
  const proxima = [...itens].sort((a, b) => a.custo - b.custo).find((i) => i.custo > saldo) || null;
  const podeResgatar = itens.filter((i) => i.custo <= saldo).sort((a, b) => b.custo - a.custo);
  return {
    xp, saldo, hojeXp, nivel: nivelDe(xp), sequencia: sequencia(lista, hoje), conquistas: conquistas(dados, lista),
    itens, resgates, proxima, podeResgatar,
  };
}

// Pontos de uma tarefa ao concluir (para o "+10" que aparece na hora).
export function pontosDaTarefa(t) {
  if (t.recorrencia?.tipo) return PONTOS.repeticao;
  return PONTOS.tarefa + (t.prioridade === 2 ? PONTOS.urgente : t.prioridade === 1 ? PONTOS.importante : 0);
}
