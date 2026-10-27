// Gamificação das Finanças (decisão da Carol, 27/10/2026): os pontos vêm de cuidar bem do
// dinheiro, e as recompensas (que custam dinheiro) viram uma permissão já merecida.
// Pontos calculados a partir dos dados de Finanças; só os resgates ficam guardados.
// Nada tira pontos e um dia sem anotar não pune.

import { diaNoMes, mesDe, somarMeses } from './dados-financas.js';

export const PONTOS = {
  lancamento: 1, lancamentosPorDia: 5, contaEmDia: 10, semanaNoLimite: 20, porDezGuardados: 1, caixinha: 30, mesNoAzul: 50,
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

const TITULOS = ['Começando', 'No controle', 'Organizada', 'Econômica', 'Estrategista', 'Investidora', 'Próspera', 'Lendária'];

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diaDe = (momento) => iso(new Date(momento));
const somarDias = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const segundaDe = (s) => somarDias(s, -((new Date(`${s}T12:00:00`).getDay() + 6) % 7));

function limitesDe(config) {
  const v = (config || []).find((c) => c.chave === 'financas' && !c.excluido_em)?.valor || {};
  return Object.fromEntries((v.categorias || []).filter((c) => Number(c.limite) > 0 && !c.removida).map((c) => [c.id, Number(c.limite)]));
}

const ehLancamento = (f) => (f.tipo === 'entrada' || f.tipo === 'saida') && !f.dados?.recompensa;

// Cada ponto ganho, com o dia (para a sequência e o "hoje").
export function ganhos(dados, hoje = iso(new Date())) {
  const lista = [];
  const linhas = vivos(dados.financas);
  const lancs = linhas.filter(ehLancamento);

  // Anotar: +1 por lançamento, até 5 por dia (o hábito de anotar é o que importa).
  const porDia = new Map();
  for (const l of lancs) porDia.set(l.data, (porDia.get(l.data) || 0) + 1);
  for (const [dia, n] of porDia) lista.push({ dia, pontos: Math.min(n, PONTOS.lancamentosPorDia) * PONTOS.lancamento, tipo: 'lancamento' });

  // Conta fixa paga até o vencimento.
  const contas = new Map(linhas.filter((c) => c.tipo === 'conta').map((c) => [c.id, c]));
  for (const l of lancs) {
    const conta = l.dados?.conta_id && contas.get(l.dados.conta_id);
    if (conta && l.dados.mes && l.data <= diaNoMes(l.dados.mes, Number(conta.recorrencia?.dia) || 1)) {
      lista.push({ dia: l.data, pontos: PONTOS.contaEmDia, tipo: 'conta' });
    }
  }

  // Fatura do cartão paga até o vencimento.
  const cartoes = new Map(linhas.filter((c) => c.tipo === 'cartao').map((c) => [c.id, c]));
  for (const pg of linhas.filter((x) => x.tipo === 'pagamento' && x.dados?.cartao_id && x.dados?.mes)) {
    const c = cartoes.get(pg.dados.cartao_id);
    if (c && pg.data <= diaNoMes(pg.dados.mes, Number(c.dados?.vencimento) || 10)) lista.push({ dia: pg.data, pontos: PONTOS.contaEmDia, tipo: 'conta' });
  }

  // Semana fechada sem passar de nenhum limite (o limite do mês, proporcional à semana).
  const limites = limitesDe(dados.config);
  if (Object.keys(limites).length) {
    const semanas = new Map();
    for (const l of lancs.filter((x) => x.tipo === 'saida')) {
      const seg = segundaDe(l.data);
      if (somarDias(seg, 6) >= hoje) continue; // só semanas que já terminaram
      const s = semanas.get(seg) || {};
      s[l.categoria || 'outros'] = (s[l.categoria || 'outros'] || 0) + (Number(l.valor) || 0);
      semanas.set(seg, s);
    }
    for (const [seg, gastos] of semanas) {
      const dentro = Object.entries(limites).every(([cat, lim]) => (gastos[cat] || 0) <= (lim * 7) / 30);
      if (dentro) lista.push({ dia: somarDias(seg, 6), pontos: PONTOS.semanaNoLimite, tipo: 'semana' });
    }
  }

  // Caixinhas: +1 a cada R$ 10 guardados (tirar depois não desconta) e +30 ao bater a meta.
  for (const c of linhas.filter((x) => x.tipo === 'caixinha')) {
    for (const h of c.dados?.historico || []) {
      if (Number(h.valor) >= 10) lista.push({ dia: h.data, pontos: Math.floor(Number(h.valor) / 10) * PONTOS.porDezGuardados, tipo: 'guardar' });
    }
    if (Number(c.valor) > 0 && Number(c.dados?.guardado) >= Number(c.valor)) {
      lista.push({ dia: diaDe(c.atualizado_em || Date.now()), pontos: PONTOS.caixinha, tipo: 'caixinha' });
    }
  }

  // Mês fechado no azul.
  const saldo = new Map();
  for (const l of lancs) saldo.set(mesDe(l.data), (saldo.get(mesDe(l.data)) || 0) + (l.tipo === 'entrada' ? 1 : -1) * (Number(l.valor) || 0));
  for (const [m, s] of saldo) if (m < mesDe(hoje) && s > 0) lista.push({ dia: `${somarMeses(m, 1)}-01`, pontos: PONTOS.mesNoAzul, tipo: 'mes' });
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

// Dias seguidos anotando. Sem culpa: um dia de folga a cada 7 não quebra.
export function sequencia(lista, hoje) {
  const dias = new Set(lista.filter((g) => g.tipo === 'lancamento').map((g) => g.dia));
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

export function conquistas(dados, lista, hoje = iso(new Date())) {
  const conta = (tipo) => lista.filter((g) => g.tipo === tipo).length;
  const lancs = vivos(dados.financas).filter(ehLancamento).length;
  const seq = sequencia(lista, hoje).dias;
  const azul = conta('mes');
  return [
    { id: 'fin-1', emoji: '✍️', nome: 'Primeiro registro', texto: 'Anotar o primeiro gasto ou entrada', atual: lancs, meta: 1 },
    { id: 'fin-7', emoji: '🔥', nome: 'Semana anotando', texto: '7 dias seguidos anotando os gastos', atual: seq, meta: 7 },
    { id: 'fin-30', emoji: '🌟', nome: 'Mês inteiro anotado', texto: '30 dias seguidos anotando', atual: seq, meta: 30 },
    { id: 'contas-5', emoji: '📅', nome: 'Contas em dia', texto: 'Pagar 5 contas até o vencimento', atual: conta('conta'), meta: 5 },
    { id: 'semana-1', emoji: '🎯', nome: 'Dentro do limite', texto: 'Fechar uma semana sem passar dos limites', atual: conta('semana'), meta: 1 },
    { id: 'semana-4', emoji: '🧭', nome: 'Mês sob controle', texto: '4 semanas dentro dos limites', atual: conta('semana'), meta: 4 },
    { id: 'caixinha-1', emoji: '🐷', nome: 'Meta guardada', texto: 'Bater a meta de uma caixinha', atual: conta('caixinha'), meta: 1 },
    { id: 'mes-azul', emoji: '💚', nome: 'Mês no azul', texto: 'Fechar um mês com sobra', atual: azul, meta: 1 },
    { id: 'mes-azul-3', emoji: '💎', nome: 'Três meses no azul', texto: 'Fechar 3 meses com sobra', atual: azul, meta: 3 },
  ].map((c) => ({ ...c, feita: c.atual >= c.meta, fracao: Math.min(1, c.atual / c.meta) }));
}

export function recompensasDe(config) {
  const v = (config || []).find((c) => c.chave === 'recompensas' && !c.excluido_em)?.valor || {};
  const itens = Array.isArray(v.itens) ? v.itens : RECOMPENSAS_PADRAO;
  return { itens: itens.filter((i) => !i.removida), resgates: Array.isArray(v.resgates) ? v.resgates : [] };
}

// Tudo junto, para a aba Recompensas e o card do Hoje.
export function situacaoGamificacao(dados, hoje = iso(new Date())) {
  const lista = ganhos(dados, hoje);
  const xp = lista.reduce((t, g) => t + g.pontos, 0);
  const { itens, resgates } = recompensasDe(dados.config);
  const gastos = resgates.reduce((t, r) => t + (Number(r.pontos) || 0), 0);
  const saldo = Math.max(0, xp - gastos);
  const hojeXp = lista.filter((g) => g.dia === hoje).reduce((t, g) => t + g.pontos, 0);
  const proxima = [...itens].sort((a, b) => a.custo - b.custo).find((i) => i.custo > saldo) || null;
  const podeResgatar = itens.filter((i) => i.custo <= saldo).sort((a, b) => b.custo - a.custo);
  return {
    xp, saldo, hojeXp, nivel: nivelDe(xp), sequencia: sequencia(lista, hoje), conquistas: conquistas(dados, lista, hoje),
    itens, resgates, proxima, podeResgatar,
  };
}

// Pontos de um lançamento novo (para o "+1" que aparece na hora): só até o limite do dia.
export function pontosDoLancamento(financas, dia) {
  const ja = vivos(financas).filter((f) => ehLancamento(f) && f.data === dia).length;
  return ja < PONTOS.lancamentosPorDia ? PONTOS.lancamento : 0;
}
