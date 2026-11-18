// Arquivos do cronograma da R7 (Carol, 17/11/2026), no aparelho e sem IA:
// - textoDoArquivo: o documento da quinzena que ela monta no Claude (PDF, Word, texto ou Markdown) vira texto
//   linha por linha, para lerDocumentoDaQuinzena (dados-cronograma.js) achar os blocos "23.11 · CARROSSEL";
// - imagensDosArquivos: as artes que ela anexa (imagens ou PDF, uma página por tela) viram JPEG de até 1080 px,
//   na ordem do número no nome do arquivo;
// - guardarArte / urlDaArte: as artes ficam no Storage ({id}/r7/...), e a tela usa uma cópia em memória.

import { abrirPdf, paginaDoPdf } from './fundos.js';
import { abrirZip } from './zip.js';
import { enviarArquivo, baixarArquivo, apagarArquivo, idDaUsuaria } from './nuvem.js';

const LADO = 1080;

// ---------------------------------------------------------------------------
// Texto do documento
// ---------------------------------------------------------------------------

// PDF: os pedaços de texto juntos por linha (mesma altura), as linhas de cima para baixo.
async function textoDoPdf(arquivo) {
  const doc = await abrirPdf(arquivo);
  const saida = [];
  for (let n = 1; n <= Math.min(doc.numPages, 80); n += 1) {
    const pagina = await doc.getPage(n);
    const { items } = await pagina.getTextContent();
    const linhas = [];
    for (const it of items) {
      if (!('str' in it) || !it.str) continue;
      const y = it.transform[5];
      const h = Math.abs(it.transform[3]) || 10;
      let linha = linhas.find((l) => Math.abs(l.y - y) < h * 0.5);
      if (!linha) { linha = { y, partes: [] }; linhas.push(linha); }
      linha.partes.push({ x: it.transform[4], t: it.str });
    }
    linhas.sort((a, b) => b.y - a.y);
    for (const l of linhas) {
      l.partes.sort((a, b) => a.x - b.x);
      saida.push(l.partes.map((p) => p.t).join('').replace(/\s{2,}/g, ' ').trim());
    }
    pagina.cleanup();
  }
  return saida.join('\n');
}

const desescapar = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Word (.docx): um parágrafo por linha; quebras de linha dentro do parágrafo também viram linha.
async function textoDoDocx(arquivo) {
  const zip = await abrirZip(arquivo);
  const xml = await zip.texto('word/document.xml') || '';
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => desescapar(m[0]
    .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n').replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:t\b[^>]*>([^<]*)<\/w:t>/g, '\u0001$1\u0002').replace(/<[^>]+>/g, '')
    .replace(/\u0001|\u0002/g, ''))).join('\n');
}

// PowerPoint (.pptx, ex.: um Google Slides baixado): o texto de cada slide, parágrafo por linha.
async function textoDoPptx(arquivo) {
  const zip = await abrirZip(arquivo);
  const nomes = zip.nomes ? zip.nomes().filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)) : [];
  nomes.sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  const saida = [];
  for (const n of nomes) {
    const xml = await zip.texto(n) || '';
    saida.push(...[...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => desescapar([...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(''))));
  }
  return saida.join('\n');
}

// PDF no visual de cronograma: por página, as linhas com posição (y a partir do topo), os links e as
// imagens grandes (artes) na ordem em que foram desenhadas. Ver lerCronogramaPronto (dados-cronograma.js).
const MIN_ARTE = 200;

async function imagensDaPagina(pagina, lib) {
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
    const c = document.createElement('canvas');
    c.width = obj.width;
    c.height = obj.height;
    const ctx = c.getContext('2d');
    if (obj.bitmap) ctx.drawImage(obj.bitmap, 0, 0);
    else if (obj.data) {
      const rgba = new Uint8ClampedArray(obj.width * obj.height * 4);
      const tem3 = obj.data.length === obj.width * obj.height * 3;
      for (let p = 0, q = 0; p < rgba.length; p += 4) {
        rgba[p] = obj.data[q]; rgba[p + 1] = obj.data[q + 1]; rgba[p + 2] = obj.data[q + 2];
        rgba[p + 3] = tem3 ? 255 : obj.data[q + 3];
        q += tem3 ? 3 : 4;
      }
      ctx.putImageData(new ImageData(rgba, obj.width, obj.height), 0, 0);
    } else continue;
    saida.push(await reduzir(await new Promise((r) => c.toBlob(r, 'image/png'))));
  }
  return saida;
}

export async function paginasDoPdf(arquivo, { comImagens = true } = {}) {
  const doc = await abrirPdf(arquivo);
  const lib = await import('./vendor/pdfjs/pdf.min.mjs');
  const paginas = [];
  const imagens = [];
  for (let n = 1; n <= Math.min(doc.numPages, 60); n += 1) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 1 });
    const { items } = await pagina.getTextContent();
    const pedacos = items.filter((it) => 'str' in it && it.str.trim()).map((it) => {
      const h = Math.abs(it.transform[3]) || it.height || 10;
      return { x: it.transform[4], base: vista.height - it.transform[5], h, fim: it.transform[4] + (it.width || 0), t: it.str };
    }).sort((a, b) => a.base - b.base || a.x - b.x);
    // Mesma linha: mesma altura de base e perto na horizontal (colunas separadas viram linhas separadas).
    const linhas = [];
    for (const p of pedacos) {
      const l = linhas.find((x) => Math.abs(x.base - p.base) < p.h * 0.5 && p.x - x.fim < p.h * 2.2 && p.x >= x.x - 1);
      if (l) { l.t += (p.x - l.fim > p.h * 0.15 && !/\s$/.test(l.t) ? ' ' : '') + p.t; l.fim = Math.max(l.fim, p.fim); } else linhas.push({ ...p });
    }
    const anotacoes = await pagina.getAnnotations().catch(() => []);
    const links = anotacoes.filter((a) => a.url).map((a) => ({ x: a.rect[0], y: vista.height - a.rect[3], url: a.url }));
    paginas.push({ largura: vista.width, altura: vista.height, linhas: linhas.map((l) => ({ x: l.x, y: l.base - l.h, t: l.t.replace(/\s+/g, ' ').trim() })), links, imagens: 0 });
    const imgs = comImagens ? await imagensDaPagina(pagina, lib).catch(() => []) : [];
    paginas[paginas.length - 1].imagens = imgs.length;
    imagens.push(imgs);
    pagina.cleanup();
  }
  return { paginas, imagens };
}

export async function textoDoArquivo(arquivo) {
  const nome = String(arquivo?.name || '').toLowerCase();
  if (/pdf$/.test(arquivo.type) || nome.endsWith('.pdf')) return textoDoPdf(arquivo);
  if (/wordprocessingml/.test(arquivo.type) || nome.endsWith('.docx')) return textoDoDocx(arquivo);
  if (/presentationml/.test(arquivo.type) || nome.endsWith('.pptx')) return textoDoPptx(arquivo);
  if (/^text\//.test(arquivo.type) || /\.(txt|md|markdown)$/.test(nome)) return arquivo.text();
  throw new Error('Use PDF, Word (.docx), PowerPoint (.pptx) ou texto (.txt, .md).');
}

// ---------------------------------------------------------------------------
// Artes
// ---------------------------------------------------------------------------

function abrirImagem(blob) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolver(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('imagem')); };
    img.src = url;
  });
}

// Qualquer imagem → JPEG com o lado maior de até 1080 px.
export async function reduzir(blob, lado = LADO) {
  const img = await abrirImagem(blob);
  const s = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}

const numeroDoNome = (nome) => {
  const m = /(\d+)(?!.*\d)/.exec(String(nome || '').replace(/\.[a-z0-9]+$/i, ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

// Imagens (na ordem do número no nome: S1_1, S1_2…) ou PDF (uma página por arte) → [Blob JPEG].
export async function imagensDosArquivos(arquivos) {
  const lista = [...arquivos];
  const imagens = lista.filter((a) => /^image\//.test(a.type) || /\.(png|jpe?g|webp|gif)$/i.test(a.name))
    .map((a, i) => ({ a, i })).sort((x, y) => (numeroDoNome(x.a.name) - numeroDoNome(y.a.name)) || x.i - y.i).map((x) => x.a);
  const saida = [];
  for (const a of imagens) saida.push(await reduzir(a));
  for (const a of lista.filter((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name))) {
    const doc = await abrirPdf(a);
    for (let n = 1; n <= Math.min(doc.numPages, 20); n += 1) {
      const { blob } = await paginaDoPdf(doc, n, LADO);
      saida.push(await reduzir(blob));
    }
  }
  return saida;
}

// Guarda uma arte no Storage e devolve o caminho.
export async function guardarArte(blob, { cliente, inicio, peca, n }) {
  const id = idDaUsuaria();
  if (!id) throw new Error('Entre no app para guardar as artes.');
  const limpo = (t) => String(t || '').replace(/[^\w.-]+/g, '-').slice(0, 60);
  const caminho = `${id}/r7/${limpo(cliente)}/${limpo(inicio)}/${limpo(peca)}-${n}-${Date.now().toString(36)}.jpg`;
  await enviarArquivo(caminho, new File([blob], caminho.split('/').pop(), { type: 'image/jpeg' }));
  memoria.set(caminho, URL.createObjectURL(blob));
  return caminho;
}

export const apagarArte = (caminho) => { memoria.delete(caminho); return apagarArquivo(caminho); };

// Cópia em memória das artes (endereço blob:), para a tela e para o PDF/PPTX.
const memoria = new Map();
const carregando = new Map();

export function urlDaArte(caminho) {
  return memoria.get(caminho) || null;
}

export function carregarArte(caminho) {
  if (memoria.has(caminho)) return Promise.resolve(memoria.get(caminho));
  if (!carregando.has(caminho)) {
    carregando.set(caminho, baixarArquivo(caminho).then((blob) => {
      const url = URL.createObjectURL(blob);
      memoria.set(caminho, url);
      return url;
    }).catch(() => null).finally(() => carregando.delete(caminho)));
  }
  return carregando.get(caminho);
}

// Todas as artes do cronograma em memória (antes do PDF/PPTX): { caminho: url }.
export async function artesDoCronograma(cron) {
  const caminhos = cron.pecas.flatMap((p) => (p.artes || []).map((a) => a.caminho)).filter(Boolean);
  const pares = await Promise.all(caminhos.map(async (c) => [c, await carregarArte(c)]));
  return Object.fromEntries(pares.filter(([, u]) => u));
}
