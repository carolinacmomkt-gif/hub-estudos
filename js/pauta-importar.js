// Posts extras da pauta (fora do Trello): imagens, PDF ou PPTX viram peças.
// - Imagens: um post (várias = carrossel, na ordem do número no nome do arquivo).
// - PDF ou PPTX que é uma pauta (páginas com "Legenda"): cada página vira um post, com o título,
//   a legenda e as artes daquela página.
// - PDF ou PPTX sem "Legenda": o arquivo todo vira um carrossel (cada página é uma lâmina).
// As imagens ficam na própria pauta (JPEG de até 900 px), então cabem sem internet.

import { abrirPdf, paginaDoPdf } from './fundos.js';
import { abrirZip } from './zip.js';
import { ordenarLaminas } from './dados-pauta.js';

const LADO = 900;
const MIN_ARTE = 220; // px: menor que isso é ícone ou logo, não arte
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 10);

function canvasDe(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Qualquer fonte desenhável → { id, src (data URL JPEG), largura, altura }.
function local(fonte, w, h) {
  const s = Math.min(1, LADO / Math.max(w, h));
  const c = canvasDe(w * s, h * s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(fonte, 0, 0, c.width, c.height);
  return { id: `local-${novoId()}`, src: c.toDataURL('image/jpeg', 0.82), largura: c.width, altura: c.height };
}

function abrirImagem(blob) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolver(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('imagem')); };
    img.src = url;
  });
}

async function localDoBlob(blob) {
  const img = await abrirImagem(blob);
  return local(img, img.naturalWidth, img.naturalHeight);
}

// "Post - Halitofobia" → { tipo: 'Post', titulo: 'Halitofobia' }
function lerTitulo(linha) {
  const t = String(linha || '').trim();
  const m = /^(post|carrossel|reels?|stories|story|v[ií]deo)\s*[-–—:]\s*(.+)$/i.exec(t);
  if (!m) return { tipo: null, titulo: t };
  const k = m[1].toLowerCase();
  const tipo = k.startsWith('reel') ? 'Reel' : k.startsWith('stor') ? 'Stories' : k.startsWith('carr') ? 'Carrossel' : /v[ií]deo/.test(k) ? 'Vídeo' : 'Post';
  return { tipo, titulo: m[2].trim() };
}

// Texto da página (parágrafos) → { tipo, titulo, legenda }. O título é o parágrafo "Post - …"/"Reel - …"
// em qualquer lugar da página (no PDF ele às vezes vem depois da legenda); sem ele, o primeiro antes da legenda.
function separarTexto(paragrafos) {
  const iTitulo = paragrafos.findIndex((p) => lerTitulo(p).tipo && p.length < 140);
  const iLegenda = paragrafos.findIndex((p) => /^\s*legenda\b/i.test(p));
  const titulo = iTitulo >= 0 ? lerTitulo(paragrafos[iTitulo]) : lerTitulo((iLegenda < 0 ? paragrafos : paragrafos.slice(0, iLegenda)).find((p) => p.trim()) || '');
  let legenda = '';
  if (iLegenda >= 0) {
    // A legenda vai do "Legenda:" até o fim, sem o título (e, se o título veio antes no meio, até ele).
    const fim = iTitulo > iLegenda ? iTitulo : paragrafos.length;
    legenda = [paragrafos[iLegenda].replace(/^\s*legenda\s*:?\s*/i, ''), ...paragrafos.slice(iLegenda + 1, fim)].map((p) => p.trim()).filter(Boolean).join('\n\n');
  }
  return { tipo: titulo.tipo, titulo: titulo.titulo, legenda };
}

const nomeSemExtensao = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s*\d+\s*$/, '').trim();

function peca({ titulo, tipo, legenda, locais }) {
  return {
    card: `extra-${novoId()}`,
    extra: true,
    titulo: titulo || 'Post extra',
    tipo: tipo || (locais.length > 1 ? 'Carrossel' : 'Post'),
    anexos: locais.map((l) => l.id),
    locais,
    legenda: legenda || '',
    modo: legenda ? 'manual' : 'ia',
    descricao: '',
    url: '',
    lista: '',
    data: null,
  };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function textoDaPaginaPdf(pagina) {
  const { items } = await pagina.getTextContent();
  const paragrafos = [];
  let atual = '';
  let yAnterior = null;
  let alturaAnterior = 0;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = it.transform[5];
    const h = Math.abs(it.transform[3]) || it.height || 10;
    if (yAnterior !== null && Math.abs(yAnterior - y) > Math.max(h, alturaAnterior) * 1.9) {
      if (atual.trim()) paragrafos.push(atual.trim());
      atual = '';
    } else if (yAnterior !== null && Math.abs(yAnterior - y) > 1 && atual && !/\s$/.test(atual)) atual += ' ';
    atual += it.str;
    if (it.hasEOL && !/\s$/.test(atual)) atual += ' ';
    // "Legenda:" na mesma linha do texto começa um parágrafo próprio.
    yAnterior = y;
    alturaAnterior = h;
  }
  if (atual.trim()) paragrafos.push(atual.trim());
  return paragrafos.flatMap((p) => p.split(/(?=\bLegenda\s*:)/i)).map((p) => p.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
}

// As imagens desenhadas na página, na ordem em que aparecem (Canva desenha da esquerda para a direita).
async function imagensDaPaginaPdf(pagina, lib) {
  const ops = await pagina.getOperatorList();
  const saida = [];
  const vistos = new Set();
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    if (ops.fnArray[i] !== lib.OPS.paintImageXObject) continue;
    const nome = ops.argsArray[i][0];
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    const obj = await new Promise((resolver) => {
      try {
        const objs = String(nome).startsWith('g_') ? pagina.commonObjs : pagina.objs;
        if (objs.has(nome)) resolver(objs.get(nome)); else objs.get(nome, resolver);
      } catch { resolver(null); }
      setTimeout(() => resolver(null), 4000);
    });
    if (!obj || obj.width < MIN_ARTE || obj.height < MIN_ARTE) continue;
    let fonte = obj.bitmap || null;
    if (!fonte && obj.data) {
      const c = canvasDe(obj.width, obj.height);
      const rgba = new Uint8ClampedArray(obj.width * obj.height * 4);
      const tem3 = obj.data.length === obj.width * obj.height * 3;
      for (let p = 0, q = 0; p < rgba.length; p += 4) {
        rgba[p] = obj.data[q]; rgba[p + 1] = obj.data[q + 1]; rgba[p + 2] = obj.data[q + 2];
        rgba[p + 3] = tem3 ? 255 : obj.data[q + 3];
        q += tem3 ? 3 : 4;
      }
      c.getContext('2d').putImageData(new ImageData(rgba, obj.width, obj.height), 0, 0);
      fonte = c;
    }
    if (fonte) saida.push(local(fonte, obj.width, obj.height));
  }
  return saida;
}

async function lerPdf(arquivo) {
  const doc = await abrirPdf(arquivo);
  const lib = await import('./vendor/pdfjs/pdf.min.mjs');
  const paginas = [];
  for (let n = 1; n <= Math.min(doc.numPages, 40); n += 1) {
    const pagina = await doc.getPage(n);
    paginas.push({ n, pagina, texto: await textoDaPaginaPdf(pagina) });
  }
  const ehPauta = paginas.some((p) => p.texto.some((t) => /^\s*legenda\b/i.test(t)));
  if (!ehPauta) {
    // O arquivo todo é um carrossel: cada página vira uma lâmina.
    const locais = [];
    for (const p of paginas) {
      const { blob } = await paginaDoPdf(doc, p.n, 1080);
      locais.push(await localDoBlob(blob));
    }
    return [peca({ titulo: nomeSemExtensao(arquivo.name), locais })];
  }
  const pecas = [];
  for (const p of paginas) {
    if (!p.texto.some((t) => /^\s*legenda\b/i.test(t))) continue; // capa e página final
    const { tipo, titulo, legenda } = separarTexto(p.texto);
    pecas.push(peca({ titulo, tipo, legenda, locais: await imagensDaPaginaPdf(p.pagina, lib) }));
  }
  return pecas;
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

const atributo = (xml, nome) => new RegExp(`${nome}="([^"]*)"`).exec(xml)?.[1];
const desescapar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const pasta = (caminho) => caminho.slice(0, caminho.lastIndexOf('/') + 1);
function resolver(base, alvo) {
  const partes = (pasta(base) + alvo).split('/');
  const saida = [];
  for (const p of partes) { if (p === '..') saida.pop(); else if (p !== '.') saida.push(p); }
  return saida.join('/');
}
const relacoes = (xml) => Object.fromEntries([...String(xml || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [atributo(m[0], 'Id'), atributo(m[0], 'Target')]));

async function lerPptx(arquivo) {
  const zip = await abrirZip(arquivo);
  const pres = await zip.texto('ppt/presentation.xml');
  const relsPres = relacoes(await zip.texto('ppt/_rels/presentation.xml.rels'));
  const ids = [...String(pres || '').matchAll(/<p:sldId\b[^>]*>/g)].map((m) => atributo(m[0], 'r:id'));
  const caminhos = ids.map((id) => relsPres[id]).filter(Boolean).map((t) => resolver('ppt/presentation.xml', t)).slice(0, 40);
  const slides = [];
  for (const caminho of caminhos) {
    const xml = await zip.texto(caminho) || '';
    const rels = relacoes(await zip.texto(`${pasta(caminho)}_rels/${caminho.split('/').pop()}.rels`));
    const paragrafos = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => desescapar([...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(''))).map((t) => t.trim()).filter(Boolean);
    const figuras = [...xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>|<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<a:blipFill>[\s\S]*?<\/p:sp>/g)].map((m) => {
      const bloco = m[0];
      const rid = /r:embed="([^"]+)"/.exec(bloco)?.[1];
      const off = /<a:off x="(-?\d+)" y="(-?\d+)"/.exec(bloco);
      return rid && rels[rid] ? { alvo: resolver(caminho, rels[rid]), x: Number(off?.[1] || 0), y: Number(off?.[2] || 0) } : null;
    }).filter(Boolean);
    // De cima para baixo e da esquerda para a direita (mesma fileira com tolerância).
    figuras.sort((a, b) => (Math.abs(a.y - b.y) > 300000 ? a.y - b.y : a.x - b.x));
    slides.push({ paragrafos, figuras });
  }
  const imagensDo = async (s) => {
    const locais = [];
    for (const f of s.figuras) {
      const blob = await zip.blob(f.alvo);
      if (!blob || !/\.(png|jpe?g|gif|webp)$/i.test(f.alvo)) continue;
      try {
        const img = await abrirImagem(blob);
        if (img.naturalWidth < MIN_ARTE || img.naturalHeight < MIN_ARTE) continue;
        locais.push(local(img, img.naturalWidth, img.naturalHeight));
      } catch { /* imagem que o navegador não abre (emf, tiff): fica de fora */ }
    }
    return locais;
  };
  const ehPauta = slides.some((s) => s.paragrafos.some((p) => /^\s*legenda\b/i.test(p)));
  if (!ehPauta) {
    // Carrossel: a maior imagem de cada slide é a lâmina.
    const locais = [];
    for (const s of slides) {
      const imgs = await imagensDo(s);
      if (imgs.length) locais.push(imgs.sort((a, b) => b.largura * b.altura - a.largura * a.altura)[0]);
    }
    return locais.length ? [peca({ titulo: nomeSemExtensao(arquivo.name), locais })] : [];
  }
  const pecas = [];
  for (const s of slides) {
    if (!s.paragrafos.some((p) => /^\s*legenda\b/i.test(p))) continue;
    pecas.push(peca({ ...separarTexto(s.paragrafos), locais: await imagensDo(s) }));
  }
  return pecas;
}

// ---------------------------------------------------------------------------

// arquivos (FileList) → { pecas, avisos }
export async function importarPostsExtras(arquivos) {
  const lista = [...arquivos];
  const imagens = ordenarLaminas(lista.filter((a) => /^image\//.test(a.type) || /\.(png|jpe?g|webp|gif|heic)$/i.test(a.name))
    .map((a, i) => ({ arquivo: a, nome: a.name, pos: i })));
  const pecas = [];
  const avisos = [];
  if (imagens.length) {
    const locais = [];
    for (const { arquivo } of imagens) {
      try { locais.push(await localDoBlob(arquivo)); } catch { avisos.push(`"${arquivo.name}" não abriu como imagem.`); }
    }
    if (locais.length) pecas.push(peca({ titulo: nomeSemExtensao(imagens[0].nome), locais }));
  }
  for (const a of lista) {
    try {
      if (/pdf$/i.test(a.type) || /\.pdf$/i.test(a.name)) pecas.push(...await lerPdf(a));
      else if (/presentation/.test(a.type) || /\.pptx$/i.test(a.name)) pecas.push(...await lerPptx(a));
    } catch {
      avisos.push(`Não deu para ler "${a.name}". Tente exportar de novo em PDF.`);
    }
  }
  for (const p of pecas) if (!p.locais.length) avisos.push(`"${p.titulo}" entrou sem arte: toque no + para pôr a imagem.`);
  return { pecas, avisos };
}
