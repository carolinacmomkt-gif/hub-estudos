// Projetos com painel (decisão da Carol, 03/11/2026): monta o plano de um modelo (fases e tarefas com
// datas contadas a partir da data principal), lê o painel de um projeto (fase atual, contagem,
// números com meta, ritmo) e as seções. Os detalhes ficam em projetos.dados:
// { modelo { tipo, metodo }, chave, respostas, fases [{ id, nome, inicio, fim }],
//   numeros { kpi: { 'AAAA-MM-DD': n } }, extras [{ id, nome, meta }], itens { secao: [...] },
//   eventos [ids], aprendizados }.
// As tarefas são tarefas de verdade (projeto_id), com dados.fase e dados.marco.
// Sem DOM, para dar para testar sozinho.

import { TIPOS, tipoDe, metodoDe } from './modelos-projeto.js';
import { somarDias, iso } from './dados-tarefas.js';

const DIA = 864e5;
const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA);
const num = (v) => Number(v) || 0;

export const temPainel = (p) => Boolean(p?.dados?.modelo?.tipo && tipoDe(p.dados.modelo.tipo));

// ---------------------------------------------------------------------------
// Plano (prévia do Novo projeto e o que é criado)
// ---------------------------------------------------------------------------

// Tarefas que cairiam antes de hoje vão para hoje (e a prévia avisa quantas).
export function montarPlano({ tipo, metodo, respostas = {}, chave, hoje = iso(new Date()) }) {
  const t = tipoDe(tipo);
  const m = metodoDe(tipo, metodo);
  if (!t || !m || !chave) return null;
  const ate = Math.max(7, diasEntre(hoje, chave));
  let noPassado = 0;
  const fases = m.fases(respostas, ate).map((fz) => ({
    id: fz.id,
    nome: fz.nome,
    inicio: somarDias(chave, fz.de),
    fim: somarDias(chave, fz.ate),
    tarefas: fz.tarefas.map((x, i) => {
      let data = somarDias(chave, x.dia);
      const passado = data < hoje;
      if (passado) { noPassado += 1; data = hoje; }
      return { chave: `${fz.id}:${i}`, titulo: x.titulo, data, marco: x.marco, passado };
    }),
  }));
  const datas = fases.flatMap((x) => [x.inicio, x.fim]).sort();
  return {
    tipo: t, metodo: m, chave, fases, noPassado,
    inicio: datas[0], fim: datas[datas.length - 1],
    total: fases.reduce((n, x) => n + x.tarefas.length, 0),
    marcos: fases.flatMap((x) => x.tarefas.filter((y) => y.marco).map((y) => ({ titulo: y.marco, data: y.data }))),
  };
}

// Itens iniciais das seções: materiais do tipo e o que o modelo já traz (ex.: capítulos do livro).
export function itensIniciais(tipo, respostas) {
  const t = tipoDe(tipo);
  const itens = Object.fromEntries((t?.secoes || []).map((s) => [s, []]));
  const id = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `i${Math.random().toString(36).slice(2)}`);
  if (itens.materiais) itens.materiais = (t.materiais || []).map((nome) => ({ id: id(), nome, feito: false }));
  for (const [s, lista] of Object.entries(t?.itensIniciais?.(respostas) || {})) itens[s] = lista.map((x) => ({ id: id(), ...x }));
  return itens;
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

export const somaDe = (registros) => Object.values(registros || {}).reduce((t, v) => t + num(v), 0);

export function kpisDoProjeto(p) {
  const d = p.dados || {};
  const t = tipoDe(d.modelo?.tipo);
  const r = d.respostas || {};
  const itens = d.itens || {};
  const valores = {};
  const lista = [];
  const modelo = [...(t?.kpis || []), ...(d.extras || []).map((x) => ({ id: x.id, nome: x.nome, tipo: 'soma', unidade: 'n', meta: x.meta ? () => num(x.meta) : null, extra: true }))];
  for (const k of modelo) {
    const valor = k.tipo === 'soma' ? somaDe(d.numeros?.[k.id]) : k.calc(valores, r, itens);
    valores[k.id] = valor;
    const meta = typeof k.meta === 'function' ? k.meta(r) : k.meta;
    lista.push({
      id: k.id, nome: k.nome, tipo: k.tipo, unidade: k.unidade, valor, meta: meta || null,
      fracao: meta ? Math.min(1, num(valor) / meta) : null, principal: Boolean(k.principal), extra: Boolean(k.extra), menorMelhor: Boolean(k.menorMelhor),
    });
  }
  return lista;
}

const fmtNum = new Intl.NumberFormat('pt-BR');
const fmtReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export function formatarValor(v, unidade) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (unidade === 'reais') return fmtReais.format(v);
  if (unidade === 'pct') return `${Math.round(v * 1000) / 10}%`.replace('.', ',');
  return fmtNum.format(v);
}

// Série dos últimos N dias de um número que se lança por dia (para o gráfico de barras).
export function serieDoNumero(p, kpiId, hoje = iso(new Date()), dias = 14) {
  const reg = p.dados?.numeros?.[kpiId] || {};
  return Array.from({ length: dias }, (_, i) => { const d = somarDias(hoje, i - dias + 1); return { data: d, valor: num(reg[d]) }; });
}

// ---------------------------------------------------------------------------
// Fases e painel
// ---------------------------------------------------------------------------

export function faseAtual(fases, hoje) {
  const lista = fases || [];
  if (!lista.length) return null;
  const agora = lista.filter((x) => x.inicio <= hoje && hoje <= x.fim);
  if (agora.length) return agora.sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
  if (hoje < lista[0].inicio) return lista[0];
  const passadas = lista.filter((x) => x.fim < hoje);
  return passadas[passadas.length - 1] || lista[lista.length - 1];
}

// Ritmo do número principal: quanto deveria estar feito a esta altura da janela (ex.: carrinho aberto).
export function ritmoDoProjeto(p, hoje = iso(new Date())) {
  if (!temPainel(p)) return null;
  const d = p.dados;
  const m = metodoDe(d.modelo.tipo, d.modelo.metodo);
  const janela = (d.fases || []).find((x) => x.id === m?.janela);
  const principal = kpisDoProjeto(p).find((k) => k.principal && k.meta);
  if (!janela || !principal || hoje < janela.inicio) return null;
  const total = Math.max(1, diasEntre(janela.inicio, janela.fim) + 1);
  const passado = Math.min(total, diasEntre(janela.inicio, hoje) + 1);
  const esperado = principal.meta * (passado / total);
  const fracaoTempo = passado / total;
  const abaixo = fracaoTempo >= 0.3 && principal.valor < esperado * 0.6;
  return { kpi: principal, esperado: Math.round(esperado), abaixo, encerrada: hoje > janela.fim, texto: `${principal.nome} abaixo do ritmo: ${formatarValor(principal.valor, principal.unidade)} de ~${formatarValor(Math.round(esperado), principal.unidade)} esperados` };
}

export function painelDoProjeto(p, tarefas, hoje = iso(new Date())) {
  const d = p.dados || {};
  const t = tipoDe(d.modelo?.tipo);
  const m = metodoDe(d.modelo?.tipo, d.modelo?.metodo);
  const doProjeto = vivos(tarefas).filter((x) => x.projeto_id === p.id && !x.recorrencia?.tipo);
  const fases = (d.fases || []).map((fz) => {
    const ts = doProjeto.filter((x) => x.dados?.fase === fz.id).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || (a.ordem || 0) - (b.ordem || 0));
    const feitas = ts.filter((x) => x.feita_em).length;
    return { ...fz, tarefas: ts, feitas, total: ts.length, fracao: ts.length ? feitas / ts.length : 0, estado: fz.fim < hoje ? 'passou' : fz.inicio > hoje ? 'depois' : 'agora' };
  });
  const atual = faseAtual(fases, hoje);
  const semFase = doProjeto.filter((x) => !fases.some((fz) => fz.id === x.dados?.fase));
  const abertas = doProjeto.filter((x) => !x.feita_em).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
  const ate = d.chave ? diasEntre(hoje, d.chave) : null;
  return {
    tipo: t, metodo: m, fases, atual, semFase, proxima: abertas[0] || null,
    chave: d.chave || null, rotuloChave: m?.chave || 'Data principal', ate,
    contagem: ate === null ? '' : ate > 1 ? `Faltam ${ate} dias para: ${(m?.chave || '').toLowerCase()}` : ate === 1 ? `Amanhã: ${(m?.chave || '').toLowerCase()}` : ate === 0 ? `Hoje: ${(m?.chave || '').toLowerCase()}` : `${m?.chave || 'Data'} foi há ${-ate} ${-ate === 1 ? 'dia' : 'dias'}`,
    kpis: kpisDoProjeto(p),
    ritmo: ritmoDoProjeto(p, hoje),
    itens: d.itens || {},
    secoes: t?.secoes || [],
  };
}

// Lista da aba Projetos: os com painel primeiro (pela data principal), depois os outros.
export function listaDeProjetos(estado) {
  const todos = vivos(estado.projetos);
  const comPainel = todos.filter(temPainel).sort((a, b) => (a.status === 'concluido') - (b.status === 'concluido') || String(a.dados.chave || '9999').localeCompare(String(b.dados.chave || '9999')));
  const outros = todos.filter((x) => !temPainel(x) && x.status !== 'concluido');
  return { comPainel, outros };
}

export const TIPOS_DE_PROJETO = TIPOS;
