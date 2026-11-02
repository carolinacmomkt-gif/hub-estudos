// Relatório de métricas (Trabalho → Relatórios): o mesmo modelo da Confluir para todos os clientes.
// Aqui ficam os dados (config "relatorio:<cliente>:<AAAA-MM>"), as contas e o desenho dos slides
// em pontos (1200 × 675, 16:9). A prévia, o PDF e o PPTX usam o mesmo desenho.

export const PREFIXO = 'relatorio:';
export const LARGURA = 1200; // pontos (15.240.000 EMU no PPTX)
export const ALTURA = 675;

// Marca da Confluir no relatório (cores do documento, não do app: não mudam com o tema).
export const MARCA = { fundo: '#4E5C2B', destaque: '#E06919', texto: '#D9D9D9', fonte: 'Open Sans' };

// Métricas, na ordem dos slides. "rotulo" é o que aparece na tela do app.
export const METRICAS = [
  { id: 'visitas', rotulo: 'Visitas ao perfil', curto: 'Visitas ao perfil' },
  { id: 'toques', rotulo: 'Toques em links externos', curto: 'Toques em links' },
  { id: 'alcance', rotulo: 'Contas alcançadas', curto: 'Contas alcançadas' },
  { id: 'seguidores', rotulo: 'Seguidores novos (saldo do mês)', curto: 'Seguidores novos' },
  { id: 'interacoes', rotulo: 'Interações com o conteúdo', curto: 'Interações' },
];

export const SLIDES = [
  { id: 'atividade', nome: 'Atividade do perfil' },
  { id: 'alcance', nome: 'Alcance' },
  { id: 'seguidores', nome: 'Seguidores' },
  { id: 'engajamento', nome: 'Engajamento' },
  { id: 'conteudo', nome: 'Conteúdo relevante' },
  { id: 'consideracoes', nome: 'Considerações' },
];

export const TOPICOS_PADRAO = ['Alcance', 'Engajamento', 'Linha editorial'];
export const PROPORCAO_IMAGEM = 3787652 / 4977879; // largura ÷ altura das capas do slide "Conteúdo relevante"

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

export const chaveDoRelatorio = (cliente, mes) => `${PREFIXO}${cliente}:${mes}`;
export const nomeDoMes = (mes) => (MES_VALIDO.test(mes || '') ? MESES[Number(mes.slice(5)) - 1] : '');
export const mesPorExtenso = (mes) => (MES_VALIDO.test(mes || '') ? `${nomeDoMes(mes)} | ${mes.slice(0, 4)}` : '');
export const mesCurto = (mes) => (MES_VALIDO.test(mes || '') ? `${nomeDoMes(mes).toLowerCase()} de ${mes.slice(0, 4)}` : '');

export function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

// O mês que normalmente se relata: o anterior ao de hoje (no começo do mês fecha-se o passado).
export function mesPadrao(hoje = new Date()) {
  const m = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return mesAnterior(m);
}

export const formatar = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '');

// "1.194", "1,194", "1194", "12,3 mil", "1,2 mi" → número inteiro (ou null).
export function lerNumero(texto) {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto) : null;
  const t = String(texto).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  const mult = /milh|\d\s*mi?\b/.test(t) ? 1e6 : /\d\s*k\b|\bmil\b/.test(t) ? 1e3 : 1;
  const sinal = /^-|^−/.test(t) ? -1 : 1;
  let num = t.replace(/[^\d.,]/g, '');
  if (!num) return null;
  if (mult > 1) num = num.replace(',', '.');
  else num = num.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = Number(num);
  return Number.isFinite(v) ? sinal * Math.round(v * mult) : null;
}

export function relatorioVazio(cliente, nome, mes) {
  return {
    cliente,
    nome: nome || '',
    mes,
    numeros: Object.fromEntries(METRICAS.map((m) => [m.id, null])),
    variacao: Object.fromEntries(METRICAS.map((m) => [m.id, null])),
    imagens: [null, null, null],
    consideracoes: TOPICOS_PADRAO.map((titulo) => ({ titulo, texto: '' })),
    slides: Object.fromEntries(SLIDES.map((s) => [s.id, true])),
    destaques: [],
    observacoes: '',
  };
}

// Junta o que veio salvo com o formato atual (campos novos ganham o padrão).
export function normalizar(valor, cliente, mes) {
  const base = relatorioVazio(cliente, valor?.nome, mes);
  const v = valor || {};
  return {
    ...base,
    ...v,
    cliente,
    mes,
    numeros: { ...base.numeros, ...(v.numeros || {}) },
    variacao: { ...base.variacao, ...(v.variacao || {}) },
    imagens: [0, 1, 2].map((i) => (typeof v.imagens?.[i] === 'string' ? v.imagens[i] : null)),
    consideracoes: Array.isArray(v.consideracoes) && v.consideracoes.length ? v.consideracoes.map((c) => ({ titulo: String(c.titulo || ''), texto: String(c.texto || '') })) : base.consideracoes,
    slides: { ...base.slides, ...(v.slides || {}) },
    destaques: Array.isArray(v.destaques) ? v.destaques : [],
  };
}

export function relatoriosSalvos(config = []) {
  return config.filter((c) => !c.excluido_em && String(c.chave || '').startsWith(PREFIXO) && c.valor)
    .map((c) => {
      const [cliente, mes] = c.chave.slice(PREFIXO.length).split(/:(?=\d{4}-\d{2}$)/);
      return { chave: c.chave, cliente, mes, valor: c.valor, atualizado_em: c.atualizado_em };
    })
    .filter((r) => MES_VALIDO.test(r.mes || ''))
    .sort((a, b) => b.mes.localeCompare(a.mes) || String(a.valor.nome).localeCompare(String(b.valor.nome), 'pt-BR'));
}

// Comparação de uma métrica com o mês anterior: do relatório salvo do mês passado, se houver;
// senão, da porcentagem que o próprio Instagram mostra no print ("vs. período anterior").
export function comparar(rel, anterior, id) {
  const atual = rel.numeros?.[id];
  if (!Number.isFinite(atual)) return null;
  const antes = anterior?.numeros?.[id];
  if (Number.isFinite(antes)) {
    if (id === 'seguidores') return { antes, dif: atual - antes, pct: null, fonte: 'relatorio' };
    if (antes === 0) return { antes, dif: atual, pct: null, fonte: 'relatorio' };
    return { antes, dif: atual - antes, pct: ((atual - antes) / Math.abs(antes)) * 100, fonte: 'relatorio' };
  }
  const pct = rel.variacao?.[id];
  if (Number.isFinite(pct) && id !== 'seguidores') return { antes: null, dif: null, pct, fonte: 'print' };
  return null;
}

export function textoComparacao(c) {
  if (!c) return '';
  if (c.pct !== null && Number.isFinite(c.pct)) {
    const p = Math.abs(c.pct) < 10 ? c.pct.toFixed(1).replace('.', ',') : String(Math.round(c.pct));
    if (Math.abs(c.pct) < 0.5) return 'igual ao mês anterior';
    return `${c.pct > 0 ? '+' : ''}${p}% em relação ao mês anterior`;
  }
  if (Number.isFinite(c.dif)) return c.dif === 0 ? 'igual ao mês anterior' : `${c.dif > 0 ? '+' : ''}${formatar(c.dif)} em relação ao mês anterior`;
  return '';
}

// ---------------------------------------------------------------------------
// Desenho dos slides. medir(texto, tamanho, negrito) devolve a largura em pontos.
// ---------------------------------------------------------------------------

export const ASCENDENTE = 1.069; // Open Sans: topo da linha até a linha de base, em "em"
export const ALTURA_LINHA = 1.362; // altura de uma linha simples, em "em"

const titulo = (t) => ({ tipo: 'texto', x: 90, y: 78, w: 760, tam: 47, alinhar: 'l', runs: [{ t, b: true, cor: 'destaque' }] });
const dataNoTopo = (rel) => ({ tipo: 'texto', x: 760, y: 86, w: 368, tam: 29, alinhar: 'r', runs: [{ t: mesPorExtenso(rel.mes), cor: 'texto' }] });
const nomeEmbaixo = (rel) => ({ tipo: 'texto', x: 560, y: 566, w: 568, tam: 29, alinhar: 'r', runs: [{ t: rel.nome, cor: 'texto' }] });

// Diminui o tamanho até caber na largura (números grandes, nomes longos).
function caber(medir, runs, tam, largura, minimo = 12) {
  let t = tam;
  const largo = (s) => runs.reduce((soma, r) => soma + medir(r.t, s, r.b), 0);
  while (t > minimo && largo(t) > largura) t -= 1;
  return t;
}

function texto(medir, el) {
  const largura = el.w;
  return { ...el, tam: el.quebrar ? el.tam : caber(medir, el.runs, el.tam, largura) };
}

// Quebra um parágrafo (runs) em linhas que caibam na largura. Devolve [[{t, b, cor}]].
export function quebrar(runs, largura, tam, medir) {
  const palavras = [];
  for (const r of runs) {
    const partes = String(r.t).split(/(\s+)/).filter((p) => p !== '');
    for (const p of partes) palavras.push({ ...r, t: p });
  }
  const linhas = [];
  let linha = [];
  let usado = 0;
  for (const p of palavras) {
    const espaco = /^\s+$/.test(p.t);
    const w = medir(p.t, tam, p.b);
    if (!espaco && usado + w > largura && linha.some((x) => !/^\s+$/.test(x.t))) {
      while (linha.length && /^\s+$/.test(linha[linha.length - 1].t)) linha.pop();
      linhas.push(linha);
      linha = [];
      usado = 0;
    }
    if (espaco && !linha.length) continue;
    linha.push(p);
    usado += w;
  }
  while (linha.length && /^\s+$/.test(linha[linha.length - 1].t)) linha.pop();
  if (linha.length) linhas.push(linha);
  return linhas.length ? linhas : [[]];
}

// Altura que os parágrafos ocupam (com uma linha em branco entre eles, como no modelo).
function alturaDosParagrafos(paragrafos, largura, tam, medir) {
  const linhas = paragrafos.reduce((soma, p) => soma + quebrar(p, largura, tam, medir).length, 0) + Math.max(0, paragrafos.length - 1);
  return linhas * tam * ALTURA_LINHA;
}

export function paragrafosDasConsideracoes(rel) {
  return (rel.consideracoes || []).filter((c) => String(c.texto).trim()).map((c) => {
    const t = String(c.titulo || '').trim();
    const corpo = String(c.texto || '').replace(/\s+/g, ' ').trim();
    return t ? [{ t, b: true, cor: 'texto' }, { t: corpo ? `: ${corpo}` : '', cor: 'texto' }] : [{ t: corpo, cor: 'texto' }];
  });
}

function slideDeNumero(rel, medir, nome, valor, rotulo, tamNumero, yNumero, yRotulo, tamRotulo) {
  return [
    titulo(nome),
    dataNoTopo(rel),
    texto(medir, { tipo: 'texto', x: 100, y: yNumero, w: 900, tam: tamNumero, alinhar: 'l', runs: [{ t: formatar(valor) || '—', b: true, cor: 'texto' }] }),
    texto(medir, { tipo: 'texto', x: 104, y: yRotulo, w: 900, tam: tamRotulo, alinhar: 'l', runs: [{ t: rotulo, cor: 'texto' }] }),
    nomeEmbaixo(rel),
  ];
}

function fraseSeguidores(n) {
  if (!Number.isFinite(n)) return [{ t: 'Seguidores do mês: —', cor: 'texto' }];
  if (n > 0) return [{ t: 'Foram ', cor: 'texto' }, { t: `+${formatar(n)}`, b: true, cor: 'texto' }, { t: n === 1 ? ' nova conta.' : ' novas contas.', cor: 'texto' }];
  if (n === 0) return [{ t: 'O número de seguidores ', cor: 'texto' }, { t: 'se manteve', b: true, cor: 'texto' }, { t: '.', cor: 'texto' }];
  return [{ t: 'Foram ', cor: 'texto' }, { t: formatar(Math.abs(n)), b: true, cor: 'texto' }, { t: ' contas a menos.', cor: 'texto' }];
}

// Lista de slides: { id, elementos: [texto | imagem] }, já com os tamanhos que cabem.
export function montarSlides(rel, medir) {
  const n = rel.numeros || {};
  const slides = [];
  slides.push({
    id: 'capa',
    elementos: [
      texto(medir, { tipo: 'texto', x: 100, y: 236, w: 1000, tam: 29, alinhar: 'c', runs: [{ t: rel.nome, cor: 'texto' }] }),
      texto(medir, { tipo: 'texto', x: 100, y: 284, w: 1000, tam: 47, alinhar: 'c', runs: [{ t: 'Relatório de métricas', b: true, cor: 'destaque' }] }),
      texto(medir, { tipo: 'texto', x: 100, y: 364, w: 1000, tam: 29, alinhar: 'c', runs: [{ t: mesPorExtenso(rel.mes), cor: 'texto' }] }),
    ],
  });
  const ligado = (id) => rel.slides?.[id] !== false;

  if (ligado('atividade')) {
    const temToques = Number.isFinite(n.toques);
    const temVisitas = Number.isFinite(n.visitas);
    const els = [titulo('Atividade do perfil'), dataNoTopo(rel), nomeEmbaixo(rel)];
    const colunas = [
      temVisitas || !temToques ? { valor: n.visitas, rotulo: 'visitas ao perfil', cor: 'texto', tam: 123 } : null,
      temToques ? { valor: n.toques, rotulo: 'toques em links externos', cor: 'destaque', tam: 117 } : null,
    ].filter(Boolean);
    colunas.forEach((c, i) => {
      const x = colunas.length === 1 ? 110 : [110, 620][i];
      const w = colunas.length === 1 ? 900 : 490;
      els.push(texto(medir, { tipo: 'texto', x, y: 236, w, tam: c.tam, alinhar: 'l', runs: [{ t: formatar(c.valor) || '—', b: true, cor: c.cor }] }));
      els.push(texto(medir, { tipo: 'texto', x: x + 4, y: 404, w, tam: 39, alinhar: 'l', runs: [{ t: c.rotulo, cor: c.cor }] }));
    });
    slides.push({ id: 'atividade', elementos: els });
  }
  if (ligado('alcance')) slides.push({ id: 'alcance', elementos: slideDeNumero(rel, medir, 'Alcance', n.alcance, 'contas alcançadas', 132, 214, 392, 39) });
  if (ligado('seguidores')) {
    slides.push({
      id: 'seguidores',
      elementos: [
        titulo('Seguidores'),
        dataNoTopo(rel),
        texto(medir, { tipo: 'texto', x: 100, y: 300, w: 1000, tam: 66, alinhar: 'l', runs: fraseSeguidores(n.seguidores) }),
        nomeEmbaixo(rel),
      ],
    });
  }
  if (ligado('engajamento')) slides.push({ id: 'engajamento', elementos: slideDeNumero(rel, medir, 'Engajamento', n.interacoes, 'interações com o conteúdo.', 132, 222, 400, 33) });

  const imagens = (rel.imagens || []).filter(Boolean);
  if (ligado('conteudo') && imagens.length) {
    const w = 299;
    const h = Math.round(w / PROPORCAO_IMAGEM);
    const passo = 360.5;
    const inicio = 600 - (w + passo * (imagens.length - 1)) / 2;
    slides.push({
      id: 'conteudo',
      elementos: [
        titulo('Conteúdo relevante'),
        dataNoTopo(rel),
        ...imagens.map((src, i) => ({ tipo: 'imagem', x: Math.round(inicio + passo * i), y: 205, w, h, raio: 13, src })),
      ],
    });
  }
  const paragrafos = paragrafosDasConsideracoes(rel);
  if (ligado('consideracoes') && paragrafos.length) {
    const largura = 860;
    const altura = 548 - 168;
    let tam = 22;
    while (tam > 12 && alturaDosParagrafos(paragrafos, largura, tam, medir) > altura) tam -= 0.5;
    slides.push({
      id: 'consideracoes',
      elementos: [
        titulo('Considerações'),
        dataNoTopo(rel),
        { tipo: 'paragrafos', x: 90, y: 168, w: largura, h: altura, tam, paragrafos },
        nomeEmbaixo(rel),
      ],
    });
  }
  return slides;
}

export const nomeDoArquivo = (rel, ext) => `Relatorio-de-metricas-${String(rel.nome || rel.cliente || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-${nomeDoMes(rel.mes)}-${rel.mes.slice(0, 4)}.${ext}`;

// "#relatorio/<cliente>:<AAAA-MM>" → { cliente, mes } (ou null).
export function lerParametro(parametro) {
  const m = /^(.+):(\d{4}-\d{2})$/.exec(parametro || '');
  return m && MES_VALIDO.test(m[2]) ? { cliente: m[1], mes: m[2] } : null;
}
export const parametroDe = (cliente, mes) => `${encodeURIComponent(cliente)}:${mes}`;

// O relatório da rota: o rascunho em edição (se for o mesmo), senão o salvo, senão um novo.
export function relatorioDaRota(estado, parametro, nomePadrao = '') {
  const p = lerParametro(parametro);
  if (!p) return null;
  const chave = chaveDoRelatorio(p.cliente, p.mes);
  if (estado.relAtual?.chave === chave) return estado.relAtual;
  const linha = (estado.config || []).find((c) => c.chave === chave && !c.excluido_em);
  const anterior = (estado.config || []).find((c) => c.chave === chaveDoRelatorio(p.cliente, mesAnterior(p.mes)) && !c.excluido_em)?.valor;
  const rel = normalizar(linha?.valor || {
    nome: anterior?.nome || nomePadrao,
    consideracoes: anterior?.consideracoes?.length ? anterior.consideracoes.map((c) => ({ titulo: c.titulo, texto: '' })) : undefined,
  }, p.cliente, p.mes);
  return { ...rel, chave };
}

export function anteriorDe(estado, rel) {
  const v = (estado.config || []).find((c) => c.chave === chaveDoRelatorio(rel.cliente, mesAnterior(rel.mes)) && !c.excluido_em)?.valor;
  return v ? normalizar(v, rel.cliente, mesAnterior(rel.mes)) : null;
}

// Cliente sem chave (digitado): a chave vem do nome.
export const chaveDoNome = (nome) => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
