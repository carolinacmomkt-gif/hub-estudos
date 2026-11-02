// Gerador de pauta (Trabalho → Pautas): as artes prontas do Trello + legenda, no modelo da Confluir
// (o PDF "DRA. KARYNE MAGALHÃES OUTUBRO"). Igual para todas as clientes: só mudam o nome, o mês e os posts.
// config "pauta:<cliente>:<AAAA-MM>". O desenho segue as medidas do modelo (720 × 405) em pontos de 1200 × 675.

import { MES_VALIDO, nomeDoMes, mesAnterior, chaveDoNome } from './dados-relatorio.js';

export const PREFIXO_PAUTA = 'pauta:';
export const TIPOS = ['Post', 'Carrossel', 'Reel', 'Stories', 'Vídeo'];
const K = 1200 / 720; // do modelo (pontos do PDF) para o nosso slide

// Cores do modelo (do documento, não do app).
export const CORES_PAUTA = { capa: '#E9EDEE', faixa: '#E9EDEE', branco: '#FFFFFF', titulo: '#1A1A1A', texto: '#000000', mes: '#595959', verde: '#1A9988', laranja: '#EB5600' };
export const LOGO = 'modelos/pauta/logo-confluir.png';
export const FINAL = 'modelos/pauta/final.jpg';

export const chaveDaPauta = (cliente, mes) => `${PREFIXO_PAUTA}${cliente}:${mes}`;

export function lerParametroPauta(parametro) {
  const m = /^(.+):(\d{4}-\d{2})$/.exec(parametro || '');
  return m && MES_VALIDO.test(m[2]) ? { cliente: m[1], mes: m[2] } : null;
}
export const parametroDaPauta = (cliente, mes) => `${encodeURIComponent(cliente)}:${mes}`;

// O mês da pauta normalmente é o próximo (a pauta se monta antes de postar).
export function mesDaPautaPadrao(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + (hoje.getDate() >= 15 ? 1 : 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function pautaVazia(cliente, nome, mes) {
  return { cliente, nome: nome || '', mes, pecas: [] };
}

export function normalizarPauta(valor, cliente, mes) {
  const v = valor || {};
  return {
    ...pautaVazia(cliente, v.nome, mes),
    ...v,
    cliente,
    mes,
    pecas: (Array.isArray(v.pecas) ? v.pecas : []).filter((p) => p && p.card).map((p) => ({
      card: String(p.card),
      titulo: String(p.titulo || ''),
      tipo: TIPOS.includes(p.tipo) ? p.tipo : 'Post',
      anexos: Array.isArray(p.anexos) ? p.anexos.map(String) : [],
      legenda: String(p.legenda || ''),
      modo: ['descricao', 'ia', 'manual'].includes(p.modo) ? p.modo : 'descricao',
      descricao: String(p.descricao || ''),
      url: p.url || '',
      lista: String(p.lista || ''),
      data: p.data || null,
      locais: Array.isArray(p.locais) ? p.locais.filter((l) => l && l.id && typeof l.src === 'string').slice(0, 10) : [],
    })),
  };
}

export function pautaDaRota(estado, parametro, nomePadrao = '') {
  const p = lerParametroPauta(parametro);
  if (!p) return null;
  const chave = chaveDaPauta(p.cliente, p.mes);
  if (estado.pautaAtual?.chave === chave) return estado.pautaAtual;
  const linha = (estado.config || []).find((c) => c.chave === chave && !c.excluido_em);
  const anterior = (estado.config || []).find((c) => c.chave === chaveDaPauta(p.cliente, mesAnterior(p.mes)) && !c.excluido_em)?.valor;
  return { ...normalizarPauta(linha?.valor || { nome: anterior?.nome || nomePadrao }, p.cliente, p.mes), chave };
}

export function pautasSalvas(config = []) {
  return config.filter((c) => !c.excluido_em && String(c.chave || '').startsWith(PREFIXO_PAUTA) && c.valor)
    .map((c) => {
      const p = lerParametroPauta(c.chave.slice(PREFIXO_PAUTA.length));
      return p ? { chave: c.chave, ...p, valor: c.valor } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mes.localeCompare(a.mes) || String(a.valor.nome).localeCompare(String(b.valor.nome), 'pt-BR'));
}

export { chaveDoNome };

// ---------------------------------------------------------------------------
// Cartões do Trello
// ---------------------------------------------------------------------------

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// O cartão é do mês? Pela lista com o nome do mês (o arquivo do design) ou pela data.
export function cartaoDoMes(c, mes) {
  if (!MES_VALIDO.test(mes || '')) return false;
  const nome = MESES[Number(mes.slice(5)) - 1];
  if (new RegExp(`\\b${nome}\\b`).test(sem(c.lista))) return true;
  return Boolean(c.data && c.data.slice(0, 7) === mes);
}

export const ehImagem = (a) => /^image\//.test(a.tipo || '') || /\.(png|jpe?g|webp|gif)$/i.test(a.nome || '');
export const ehVideo = (a) => /^video\//.test(a.tipo || '') || /\.(mp4|mov|m4v)$/i.test(a.nome || '');

export function tipoDoCartao(c) {
  const f = sem(c.formato);
  if (/reel|video/.test(f) || c.tipoQuadro === 'videos') return 'Reel';
  if (/stor/.test(f)) return 'Stories';
  return 'Post';
}

// O título sem o nome da cliente na frente ("KARYNE - Halitofobia" → "Halitofobia").
export function tituloLimpo(titulo, nomeCliente) {
  let t = String(titulo || '').trim();
  const palavras = sem(nomeCliente).replace(/\b(dra?|dr)\b\.?/g, ' ').split(/\s+/).filter((p) => p.length > 2);
  for (let i = 0; i < 3; i += 1) {
    const m = /^([^\-–—|:]{2,40})\s*[-–—|:]\s*(.+)$/.exec(t);
    if (!m) break;
    const prefixo = sem(m[1]);
    if (palavras.some((p) => prefixo.includes(p)) || /\b(post|reel|carrossel|stories|video)\b/.test(prefixo)) t = m[2].trim();
    else break;
  }
  return t || String(titulo || '').trim();
}

// A legenda que já vem na descrição: o que vem depois de "Legenda:" (se houver), senão a descrição toda.
export function legendaDaDescricao(descricao) {
  const d = String(descricao || '').replace(/\r/g, '').trim();
  if (!d) return '';
  const m = /(^|\n)\s*\**\s*legenda\s*\**\s*:?\**\s*\n?([\s\S]+)/i.exec(d);
  const texto = (m ? m[2] : d).replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return texto;
}

// Os anexos que entram por padrão: as imagens (no reel, a capa se houver); sem imagem, o vídeo.
export function anexosPadrao(c, tipo) {
  const imagens = (c.anexos || []).filter(ehImagem);
  if (tipo === 'Reel') {
    const capa = imagens.find((a) => a.capa) || imagens[0];
    if (capa) return [capa.id];
  }
  if (imagens.length) return imagens.map((a) => a.id);
  const video = (c.anexos || []).find(ehVideo);
  return video ? [video.id] : [];
}

export function pecaDoCartao(c, nomeCliente) {
  const tipo = tipoDoCartao(c);
  const imagens = (c.anexos || []).filter(ehImagem).length;
  // Só conta como legenda pronta quando a descrição traz "Legenda:"; senão é briefing (a IA escreve).
  const legenda = /(^|\n)\s*\**\s*legenda\b/i.test(c.descricao || '') ? legendaDaDescricao(c.descricao) : '';
  return {
    card: c.id,
    titulo: tituloLimpo(c.titulo, nomeCliente),
    tipo: tipo === 'Post' && imagens > 1 ? 'Carrossel' : tipo,
    anexos: anexosPadrao(c, tipo),
    legenda,
    modo: legenda ? 'descricao' : 'ia',
    descricao: String(c.descricao || '').slice(0, 6000),
    url: c.url || '',
    lista: c.lista || '',
    data: c.data || null,
  };
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

const C = CORES_PAUTA;
const barrinha = () => [
  { tipo: 'retangulo', x: 65.4 * K, y: 93.8 * K, w: 29.6 * K, h: 3.6 * K, cor: C.verde },
  { tipo: 'retangulo', x: 94.7 * K, y: 93.8 * K, w: 29.4 * K, h: 3.6 * K, cor: C.laranja },
];

function caber(medir, runs, tam, largura, f, minimo) {
  let t = tam;
  const largo = (s) => runs.reduce((soma, r) => soma + medir(r.t, s, r.b, r.f || f), 0);
  while (t > minimo && largo(t) > largura) t -= 0.5;
  return t;
}

// Grade das artes na metade direita (sem espaço entre elas, como no modelo).
export function gradeDasArtes(artes, area) {
  const n = artes.length;
  if (!n) return [];
  const aspecto = artes[0].largura && artes[0].altura ? artes[0].largura / artes[0].altura : 4 / 5;
  if (n === 1) {
    let h = area.h;
    let w = h * aspecto;
    if (w > area.w) { w = area.w; h = w / aspecto; }
    return [{ ...artes[0], x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h }];
  }
  let colunas = 1;
  for (colunas = 1; colunas <= n; colunas += 1) {
    const linhas = Math.ceil(n / colunas);
    if (linhas * (area.w / colunas / aspecto) <= area.h + 0.5) break;
  }
  colunas = Math.min(colunas, n);
  const w = area.w / colunas;
  let h = w / aspecto;
  const linhas = Math.ceil(n / colunas);
  if (linhas * h > area.h) h = area.h / linhas;
  const y0 = area.y + (area.h - linhas * h) / 2;
  return artes.map((a, i) => ({ ...a, x: area.x + (i % colunas) * w, y: y0 + Math.floor(i / colunas) * h, w, h }));
}

const AREA_ARTE = { x: 282.9 * K, y: 0, w: (720 - 282.9) * K, h: 675 };

// artesDe(peca) → [{ src, largura, altura }] já baixadas (as que faltam não entram).
export function montarSlidesDaPauta(pauta, artesDe, medir) {
  const slides = [];
  const nome = pauta.nome || '';
  const mesTexto = MES_VALIDO.test(pauta.mes || '') ? `${nomeDoMes(pauta.mes)} ${pauta.mes.slice(0, 4)}` : '';
  const larguraCapa = 1200 - 64.2 * K - 80;
  const tamNome = caber(medir, [{ t: nome, b: true }], 42 * K, larguraCapa, 'raleway', 36);
  slides.push({
    id: 'capa',
    fundo: C.capa,
    elementos: [
      { tipo: 'retangulo', x: 0, y: 0, w: 1200, h: 38.4 * K, cor: C.branco },
      ...barrinha(),
      { tipo: 'texto', x: 64.2 * K, y: 112 * K, w: larguraCapa, tam: 42 * K, f: 'raleway', alinhar: 'l', runs: [{ t: 'Conteúdo', b: true, cor: C.titulo }] },
      { tipo: 'texto', x: 64.2 * K, y: 162 * K, w: larguraCapa, tam: tamNome, f: 'raleway', alinhar: 'l', runs: [{ t: nome, b: true, cor: C.titulo }] },
      { tipo: 'texto', x: 64.2 * K, y: 226 * K, w: larguraCapa, tam: 16 * K, f: 'lato', alinhar: 'l', runs: [{ t: mesTexto, cor: C.mes }] },
      { tipo: 'imagem', x: 289.9 * K, y: 343.3 * K, w: 129 * K, h: 22.8 * K, src: LOGO, ajuste: 'conter' },
    ],
  });

  for (const peca of pauta.pecas) {
    const titulo = `${peca.tipo === 'Carrossel' ? 'Post' : peca.tipo} - ${peca.titulo || 'Sem título'}`;
    const xTexto = 32.6 * K;
    const largura = AREA_ARTE.x - xTexto - 16;
    let tamTitulo = caber(medir, [{ t: titulo, b: true }], 20.4 * K, largura, 'raleway', 26);
    const tituloQuebra = tamTitulo <= 26 && medir(titulo, 26, true, 'raleway') > largura;
    if (tituloQuebra) tamTitulo = 26;
    const els = [
      { tipo: 'retangulo', x: 0, y: 0, w: 1200, h: 38.4 * K, cor: C.faixa },
      ...barrinha(),
      tituloQuebra
        ? { tipo: 'paragrafos', x: xTexto, y: 62, w: largura, h: 92, tam: tamTitulo, f: 'raleway', entrelinha: 1.15, paragrafos: [[{ t: titulo, b: true, cor: C.titulo }]] }
        : { tipo: 'texto', x: xTexto, y: 46 * K, w: largura, tam: tamTitulo, f: 'raleway', alinhar: 'l', runs: [{ t: titulo, b: true, cor: C.titulo }] },
    ];
    // Legenda: "Legenda:" em negrito abrindo o primeiro parágrafo; a fonte diminui se não couber.
    const paragrafos = String(peca.legenda || '').replace(/\r/g, '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
    const blocos = (paragrafos.length ? paragrafos : ['']).map((p, i) => (i === 0 ? [{ t: 'Legenda: ', b: true, cor: C.texto }, { t: p, cor: C.texto }] : [{ t: p, cor: C.texto }]));
    const topo = 108 * K;
    const altura = 395 * K - topo;
    let tam = 11 * K;
    const cabe = (t) => {
      const el = { x: xTexto, y: topo, w: largura, tam: t, f: 'raleway', entrelinha: 1.32, espaco: t * 0.7, paragrafos: blocos };
      let linhas = 0;
      for (const b of blocos) linhas += quebrarParaMedir(b, largura, t, medir).length;
      return linhas * t * el.entrelinha + (blocos.length - 1) * el.espaco <= altura;
    };
    while (tam > 11 && !cabe(tam)) tam -= 0.5;
    els.push({ tipo: 'paragrafos', x: xTexto, y: topo, w: largura, h: altura, tam, f: 'raleway', entrelinha: 1.32, espaco: tam * 0.7, paragrafos: blocos });
    const artes = artesDe(peca);
    for (const a of gradeDasArtes(artes, AREA_ARTE)) els.push({ tipo: 'imagem', x: a.x, y: a.y, w: a.w, h: a.h, src: a.src, ajuste: 'cobrir' });
    slides.push({ id: `peca:${peca.card}`, fundo: C.branco, elementos: els });
  }

  slides.push({ id: 'final', fundo: C.laranja, elementos: [{ tipo: 'imagem', x: 0, y: 0, w: 1200, h: 675, src: FINAL, ajuste: 'cobrir' }] });
  return slides;
}

// Mesma quebra do desenho (para medir a altura da legenda).
import { quebrar } from './dados-relatorio.js';

function quebrarParaMedir(runs, largura, tam, medir) {
  return quebrar(runs.map((r) => ({ ...r, f: r.f || 'raleway' })), largura, tam, medir);
}

export const nomeDoArquivoDaPauta = (p, ext) => `Pauta-${String(p.nome || p.cliente || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-${nomeDoMes(p.mes)}-${p.mes.slice(0, 4)}.${ext}`;
