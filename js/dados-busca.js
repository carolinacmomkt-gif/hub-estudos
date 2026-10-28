// "Pergunte à Bússola" sem tela: a busca em tudo do app (no aparelho, sem internet) e o resumo
// que vai para a IA quando a Carol faz uma pergunta. Sem acento, sem maiúscula, tolera um erro
// de digitação nas palavras maiores.

import { resumoDoMes, lancamentos, mesDe, somarMeses, CATEGORIAS_PADRAO, situacaoDasContas } from './dados-financas.js';

export const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palavras que não ajudam a achar nada ("quando é a prova de estatística?" → "prova estatistica").
const VAZIAS = new Set(('a o as os de do da dos das e é em no na nos nas um uma uns umas com sem para pra pro por que qual quais quando quanto quanta quantos quantas onde quem como eu meu minha meus minhas me mim tenho tem tive foi era sao ser estou esta este esse essa isso aquilo sobre ate mais menos ja ainda vou vai ao aos se ou the').split(' ').map(normalizar));

export function palavrasDe(termo) {
  return normalizar(termo).split(/[^a-z0-9]+/).filter((p) => p.length >= 2 && !VAZIAS.has(p));
}

export const pareceUmaPergunta = (termo) => /\?\s*$/.test(termo) || /^\s*(quando|quanto|quanta|quantos|quantas|qual|quais|onde|quem|como|o que|tenho|devo|preciso|posso|resuma|me (diga|fala|mostra))\b/i.test(normalizar(termo));

// Distância de edição até 1 (para "estatisitca" achar "estatística").
function quase(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  if (i === a.length && i === b.length) return true;
  const resto = (x, y) => x.slice(i + 1) === y.slice(i + 1);
  return resto(a, b) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

function casa(palavra, tokens, textoTodo) {
  if (textoTodo.includes(palavra)) return true;
  return palavra.length >= 5 && tokens.some((t) => t.length >= 4 && quase(palavra, t));
}

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const corta = (t, n = 160) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const dia = (iso) => (iso ? String(iso).slice(0, 10) : '');
const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Tudo o que dá para achar, num formato só.
export function itensBuscaveis(estado, { paginas = [] } = {}) {
  const nomeDisc = new Map(vivos(estado.disciplinas).map((d) => [d.id, d.nome]));
  const categorias = (estado.config || []).find((c) => c.chave === 'financas' && !c.excluido_em)?.valor?.categorias || CATEGORIAS_PADRAO;
  const nomeCat = (id) => categorias.find((c) => c.id === id)?.nome || '';
  const cadernos = new Map(vivos(estado.cadernos).map((c) => [c.id, c]));
  const itens = [];
  const add = (tipo, rotulo, x, titulo, texto, destino, extra = {}) => itens.push({ tipo, rotulo, id: x.id, titulo: corta(titulo, 120) || '(sem título)', texto: String(texto || ''), destino, data: extra.data || x.atualizado_em || x.criado_em || '', detalhe: extra.detalhe || '', valor: extra.valor });

  for (const t of vivos(estado.tarefas)) add('tarefa', t.feita_em ? 'Tarefa feita' : 'Tarefa', t, t.titulo, t.notas, t.projeto_id ? `#tarefas/projeto-${t.projeto_id}` : '#tarefas', { data: t.data || t.prazo || '', detalhe: [t.data && `dia ${t.data}`, t.prazo && `prazo ${t.prazo}`, t.feita_em && 'feita'].filter(Boolean).join(' · ') });
  for (const p of vivos(estado.projetos)) add('projeto', 'Projeto', p, p.titulo, p.notas, `#tarefas/projeto-${p.id}`);
  for (const e of vivos(estado.eventos)) add('evento', { prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade', feriado: 'Feriado', aula: 'Aula' }[e.tipo] || 'Evento', e, e.titulo, `${nomeDisc.get(e.disciplina_id) || ''} ${e.tipo || ''}`, e.inicio ? `#calendario/${dia(e.inicio)}` : '#calendario', { data: e.inicio, detalhe: [nomeDisc.get(e.disciplina_id), e.status].filter(Boolean).join(' · ') });
  for (const d of vivos(estado.disciplinas)) add('disciplina', 'Disciplina', d, d.nome, d.professor, `#faculdade/${d.id}`);
  for (const c of cadernos.values()) add('caderno', 'Caderno', c, c.titulo, (c.tags || []).join(' '), `#cadernos/${c.id}`, { detalhe: nomeDisc.get(c.disciplina_id) || '' });
  for (const p of vivos(paginas)) {
    const plano = p?.tracos_json?.texto?.plano;
    const caderno = cadernos.get(p.caderno_id);
    if (plano && caderno) add('pagina', 'Página de caderno', p, `${caderno.titulo}: ${String(plano).split('\n').find((l) => l.trim()) || ''}`, plano, `#cadernos/${caderno.id}`);
  }
  for (const a of vivos(estado.artigos)) add('leitura', 'Leitura', a, a.titulo, `${a.autor || ''} ${(a.tags || []).join(' ')} ${a.resumo || ''} ${String(a.texto || '').slice(0, 6000)} ${a.notas || ''}`, `#biblioteca/${a.id}`, { detalhe: [a.autor, a.status].filter(Boolean).join(' · ') });
  for (const q of vivos(estado.questoes)) add('questao', 'Questão', q, q.enunciado, `${q.explicacao || ''} ${(q.tags || []).join(' ')}`, '#questoes');
  for (const p of vivos(estado.pautas)) add('pauta', 'Pauta do Substack', p, p.titulo, `${p.subtitulo || ''} ${String(p.texto || '').slice(0, 4000)} ${p.notas || ''}`, `#substack/${p.id}`, { detalhe: p.etapa });
  for (const v of vivos(estado.videos)) add('video', 'Vídeo', v, v.titulo, `${v.gancho || ''} ${v.notas || ''} ${(v.tags || []).join?.(' ') || ''}`, `#youtube/${v.id}`, { detalhe: v.etapa });
  for (const l of lancamentos(estado.financas || [])) add('lancamento', l.tipo === 'entrada' ? 'Entrada' : 'Gasto', l, l.descricao || nomeCat(l.categoria) || 'Lançamento', `${nomeCat(l.categoria)} ${l.categoria || ''} ${l.origem || ''}`, '#financas/lancamentos', { data: l.data, detalhe: `${brl(l.valor)} · ${l.data}${nomeCat(l.categoria) ? ` · ${nomeCat(l.categoria)}` : ''}`, valor: Number(l.valor) || 0 });
  for (const d of vivos(estado.demandas)) add('demanda', 'Demanda', d, d.titulo, `${d.detalhe || ''} ${d.onde || ''} ${d.quem || ''}`, '#inicio', { detalhe: [d.onde, d.status === 'nova' ? 'esperando' : d.status].filter(Boolean).join(' · ') });
  for (const m of vivos(estado.metas)) add('meta', 'Meta', m, m.titulo, m.area, '#metas/lista');
  for (const l of vivos(estado.lazer)) add('lazer', 'Lazer', l, l.titulo, l.tipo, '#metas/lazer');
  for (const h of vivos(estado.habitos)) add('habito', 'Hábito', h, h.nome, '', '#habitos');
  for (const c of vivos(estado.caixa)) add('ideia', 'Ideia', c, c.texto, '', '#inicio');
  return itens;
}

// Os mais parecidos primeiro: palavra no título vale mais. Na busca, todas as palavras precisam
// aparecer (se nada aparecer, vale qualquer uma); na pergunta, vale qualquer uma.
export function buscar(estado, termo, { paginas = [], limite = 40, itens, qualquer = false } = {}) {
  const todas = buscarCom(estado, termo, { paginas, limite, itens, qualquer });
  return todas.length || qualquer ? todas : buscarCom(estado, termo, { paginas, limite, itens, qualquer: true });
}

function buscarCom(estado, termo, { paginas, limite, itens, qualquer }) {
  const palavras = palavrasDe(termo);
  if (!palavras.length) return [];
  const lista = itens || itensBuscaveis(estado, { paginas });
  const achados = [];
  for (const item of lista) {
    const titulo = normalizar(item.titulo);
    const todo = `${titulo} ${normalizar(item.texto)} ${normalizar(item.rotulo)} ${normalizar(item.detalhe)}`;
    const tokensTitulo = titulo.split(/[^a-z0-9]+/);
    const tokensTodo = todo.split(/[^a-z0-9]+/);
    let pontos = 0;
    let faltou = 0;
    for (const p of palavras) {
      if (casa(p, tokensTitulo, titulo)) pontos += 3;
      else if (casa(p, tokensTodo, todo)) pontos += 1;
      else faltou += 1;
    }
    if (qualquer ? !pontos : faltou) continue;
    if (titulo.startsWith(palavras[0])) pontos += 1;
    achados.push({ ...item, pontos });
  }
  return achados.sort((a, b) => b.pontos - a.pontos || String(b.data).localeCompare(String(a.data))).slice(0, limite);
}

// ---------------------------------------------------------------------------
// O que vai para a IA: os itens achados (resumidos) e um panorama curto do momento
// ---------------------------------------------------------------------------

export function contextoDaPergunta(estado, pergunta, { hoje, paginas = [] } = {}) {
  const itens = itensBuscaveis(estado, { paginas });
  let achados = buscar(estado, pergunta, { itens, limite: 30, qualquer: true });
  // Pergunta sem palavra que case com nada (ex.: "o que tenho amanhã?"): vai só o panorama.
  const temGasto = /\b(gast|pagu|compr|despes|dinheir|receb|entrad|financ|fatura|conta)/.test(normalizar(pergunta));
  const mes = mesDe(hoje);
  const cats = (estado.config || []).find((c) => c.chave === 'financas' && !c.excluido_em)?.valor?.categorias || CATEGORIAS_PADRAO;
  const resumo = (m) => { const r = resumoDoMes(estado.financas || [], m, { categorias: cats }); return { mes: m, entrou: r.entrou, saiu: r.saiu, por_categoria: r.porCategoria.slice(0, 12).map((c) => ({ categoria: c.nome, total: c.total })) }; };
  const agora = Date.parse(`${hoje}T12:00:00`);
  const proximos = vivos(estado.eventos).filter((e) => e.inicio && Date.parse(e.inicio) >= agora - 864e5 && Date.parse(e.inicio) <= agora + 21 * 864e5)
    .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))).slice(0, 25)
    .map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo, quando: e.inicio, status: e.status || null }));
  const abertas = vivos(estado.tarefas).filter((t) => !t.feita_em).sort((a, b) => String(a.data || '9').localeCompare(String(b.data || '9'))).slice(0, 25)
    .map((t) => ({ id: t.id, titulo: t.titulo, dia: t.data || null, prazo: t.prazo || null, prioridade: t.prioridade || 0 }));
  if (temGasto) {
    // Gastos de que ela fala ("delivery", "ifood"): todos os lançamentos que casam, de até 6 meses.
    const seis = somarMeses(mes, -5);
    achados = [...achados.filter((a) => a.tipo !== 'lancamento'), ...achados.filter((a) => a.tipo === 'lancamento' && String(a.data).slice(0, 7) >= seis)];
  }
  return {
    hoje,
    pergunta: String(pergunta).slice(0, 500),
    achados: achados.slice(0, 30).map((a) => ({ id: a.id, tipo: a.rotulo, titulo: a.titulo, detalhe: a.detalhe, data: dia(a.data), trecho: corta(a.texto, 300), ...(a.valor !== undefined ? { valor: a.valor } : {}) })),
    agenda_proximos_21_dias: proximos,
    tarefas_abertas: abertas,
    ...(temGasto ? {
      financas: {
        este_mes: resumo(mes),
        mes_passado: resumo(somarMeses(mes, -1)),
        contas_do_mes: situacaoDasContas(estado.financas || [], mes, hoje).slice(0, 15).map((x) => ({ conta: x.conta.descricao, valor: x.conta.valor, vence: x.vence, situacao: x.estado })),
      },
    } : {}),
  };
}
