// Slides no aparelho (relatório de métricas e pauta): desenha cada slide num canvas (prévia e PDF) e
// monta o PPTX (ZIP sem compressão com o mestre e o tema da pasta modelos/relatorio).
// Um slide é { fundo?, elementos: [texto | paragrafos | retangulo | imagem] } em pontos de 1200 × 675.

import { LARGURA, ALTURA, MARCA, quebrar, montarSlides, nomeDoArquivo } from './dados-relatorio.js';
import { pdfDeCanvases, baixar } from './exportar-caderno.js';

// asc: do topo da linha até a linha de base; linha: altura de uma linha simples (em "em").
export const FONTES = {
  open: { familia: 'Bussola Open Sans', nome: 'Open Sans', arquivo: 'open-sans', asc: 1.069, linha: 1.362 },
  raleway: { familia: 'Bussola Raleway', nome: 'Raleway', arquivo: 'raleway', asc: 0.94, linha: 1.174 },
  lato: { familia: 'Bussola Lato', nome: 'Lato', arquivo: 'lato', asc: 0.987, linha: 1.2 },
};
const fonteDe = (f) => FONTES[f] || FONTES.open;
let fontes = null;

export function carregarFontes() {
  if (fontes) return fontes;
  fontes = (async () => {
    if (typeof FontFace === 'undefined' || !document.fonts) return false;
    try {
      const lista = Object.values(FONTES).flatMap((f) => [400, 700].map((peso) => new FontFace(f.familia, `url(js/vendor/fontes/${f.arquivo}-${peso}.woff2)`, { weight: String(peso) })));
      await Promise.all(lista.map((f) => f.load()));
      lista.forEach((f) => document.fonts.add(f));
      return true;
    } catch {
      fontes = null; // sem internet na primeira vez: tenta de novo na próxima
      return false;
    }
  })();
  return fontes;
}

const fonte = (tam, negrito, f) => `${negrito ? 700 : 400} ${tam}px "${fonteDe(f).familia}", "${fonteDe(f).nome}", system-ui, sans-serif`;

let ctxMedida = null;
const medidas = new Map();
export function medir(texto, tam, negrito, f = 'open') {
  if (!texto) return 0;
  const chave = `${f}|${negrito ? 1 : 0}|${tam}|${texto}`;
  if (medidas.has(chave)) return medidas.get(chave);
  if (!ctxMedida) ctxMedida = document.createElement('canvas').getContext('2d');
  ctxMedida.font = fonte(tam, negrito, f);
  const w = ctxMedida.measureText(texto).width;
  if (medidas.size > 6000) medidas.clear();
  medidas.set(chave, w);
  return w;
}

export async function prepararMedidas() {
  await carregarFontes();
  medidas.clear();
}

export async function slidesDoRelatorio(rel) {
  await prepararMedidas();
  return montarSlides(rel, medir);
}

const imagens = new Map();
function imagemDe(src) {
  if (!imagens.has(src)) {
    imagens.set(src, new Promise((resolver) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => resolver(null);
      img.src = src;
    }));
    if (imagens.size > 80) imagens.delete(imagens.keys().next().value);
  }
  return imagens.get(src);
}

const cor = (c) => (String(c || '').startsWith('#') ? c : MARCA[c] || MARCA.texto);
const linhaDe = (el) => (el.entrelinha || fonteDe(el.f).linha) * el.tam;

function desenharRuns(ctx, runs, x, base, tam, fPadrao) {
  let cx = x;
  for (const r of runs) {
    if (!r.t) continue;
    const f = r.f || fPadrao;
    ctx.font = fonte(tam, r.b, f);
    ctx.fillStyle = cor(r.cor);
    ctx.fillText(r.t, cx, base);
    cx += medir(r.t, tam, r.b, f);
  }
}

function caminhoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (!r) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Linhas de um bloco de parágrafos: [{ runs, y }] (y = topo da linha).
export function linhasDosParagrafos(el) {
  const saida = [];
  const passo = linhaDe(el);
  let y = el.y;
  el.paragrafos.forEach((p, i) => {
    if (i) y += el.espaco ?? passo;
    const runs = p.map((r) => ({ ...r, f: r.f || el.f }));
    for (const linha of quebrar(runs, el.w, el.tam, medir)) {
      saida.push({ runs: linha, y });
      y += passo;
    }
  });
  return saida;
}

// Desenha um slide num canvas de "largura" px (a altura segue o 16:9).
export async function canvasDoSlide(slide, largura = 1920, canvas = document.createElement('canvas')) {
  const escala = largura / LARGURA;
  canvas.width = Math.round(LARGURA * escala);
  canvas.height = Math.round(ALTURA * escala);
  const ctx = canvas.getContext('2d');
  const prontas = new Map();
  for (const el of slide.elementos) if (el.tipo === 'imagem' && el.src) prontas.set(el.src, await imagemDe(el.src));
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = cor(slide.fundo || 'fundo');
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.textBaseline = 'alphabetic';
  for (const el of slide.elementos) {
    if (el.tipo === 'texto') {
      const total = el.runs.reduce((s, r) => s + medir(r.t, el.tam, r.b, r.f || el.f), 0);
      const x = el.alinhar === 'c' ? el.x + (el.w - total) / 2 : el.alinhar === 'r' ? el.x + el.w - total : el.x;
      const meio = (linhaDe(el) - fonteDe(el.f).linha * el.tam) / 2;
      desenharRuns(ctx, el.runs, x, el.y + meio + el.tam * fonteDe(el.f).asc, el.tam, el.f);
    } else if (el.tipo === 'paragrafos') {
      const meio = (linhaDe(el) - fonteDe(el.f).linha * el.tam) / 2;
      for (const l of linhasDosParagrafos(el)) desenharRuns(ctx, l.runs, el.x, l.y + meio + el.tam * fonteDe(el.f).asc, el.tam, el.f);
    } else if (el.tipo === 'retangulo') {
      ctx.fillStyle = cor(el.cor);
      ctx.fillRect(el.x, el.y, el.w, el.h);
    } else if (el.tipo === 'imagem') {
      const img = prontas.get(el.src);
      ctx.save();
      caminhoArredondado(ctx, el.x, el.y, el.w, el.h, el.raio || 0);
      ctx.clip();
      if (img) {
        const s = el.ajuste === 'conter' ? Math.min(el.w / img.naturalWidth, el.h / img.naturalHeight) : Math.max(el.w / img.naturalWidth, el.h / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        ctx.drawImage(img, el.x + (el.w - w) / 2, el.y + (el.h - h) / 2, w, h);
      } else {
        ctx.fillStyle = cor(el.vazia || 'texto');
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
      ctx.restore();
    }
  }
  return canvas;
}

export function pdfDeSlides(slides) {
  return pdfDeCanvases(slides.length, async (i) => ({ canvas: await canvasDoSlide(slides[i], 1920), largura: LARGURA * 0.8, altura: ALTURA * 0.8 }));
}

export async function pdfDoRelatorio(rel) {
  return pdfDeSlides(await slidesDoRelatorio(rel));
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

const EMU = 12700; // por ponto
const emu = (pt) => Math.round(pt * EMU);
const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caracteres de controle quebram o XML do PowerPoint.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const hex = (c) => cor(c).replace('#', '').toUpperCase();
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const CABECALHO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function run(r, tam, fPadrao) {
  if (!r.t) return '';
  const nome = fonteDe(r.f || fPadrao).nome;
  return `<a:r><a:rPr lang="pt-BR" sz="${Math.round(tam * 100)}"${r.b ? ' b="1"' : ' b="0"'} dirty="0"><a:solidFill><a:srgbClr val="${hex(r.cor)}"/></a:solidFill><a:latin typeface="${nome}"/><a:cs typeface="${nome}"/></a:rPr><a:t>${xml(r.t)}</a:t></a:r>`;
}

const ALINHAR = { l: 'l', c: 'ctr', r: 'r' };
const espacamento = (el) => (el.entrelinha ? `<a:lnSpc><a:spcPts val="${Math.round(el.entrelinha * el.tam * 100)}"/></a:lnSpc>` : '');

function caixaDeTexto(id, el) {
  const altura = el.tipo === 'paragrafos' ? el.h : linhaDe(el);
  const vazio = (sz) => `<a:p><a:pPr>${espacamento(el)}</a:pPr><a:endParaRPr lang="pt-BR" sz="${sz}"/></a:p>`;
  const corpo = el.tipo === 'paragrafos'
    ? el.paragrafos.map((p, i) => `${i ? vazio(Math.round(el.tam * 100)) : ''}<a:p><a:pPr algn="l">${espacamento(el)}</a:pPr>${p.map((r) => run(r, el.tam, el.f)).join('')}</a:p>`).join('')
    : `<a:p><a:pPr algn="${ALINHAR[el.alinhar] || 'l'}">${espacamento(el)}</a:pPr>${el.runs.map((r) => run(r, el.tam, el.f)).join('')}</a:p>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(altura)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="${el.tipo === 'paragrafos' || el.quebrar ? 'square' : 'none'}" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${corpo}</p:txBody></p:sp>`;
}

function retangulo(id, el) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${emu(el.x)}" y="${emu(el.y)}"/><a:ext cx="${emu(el.w)}" cy="${emu(el.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${hex(el.cor)}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

// A imagem vai recortada (srcRect) para cobrir a área, como no canvas.
function figura(id, el, rId, dims) {
  const geo = el.raio
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round((el.raio / Math.min(el.w, el.h)) * 100000)}"/></a:avLst></a:prstGeom>`
    : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  let corte = '';
  let { x, y, w, h } = el;
  if (dims?.w && dims?.h) {
    const aImg = dims.w / dims.h;
    const aCaixa = el.w / el.h;
    if (el.ajuste === 'conter') {
      if (aImg > aCaixa) { h = el.w / aImg; y = el.y + (el.h - h) / 2; } else { w = el.h * aImg; x = el.x + (el.w - w) / 2; }
    } else if (Math.abs(aImg - aCaixa) > 0.001) {
      if (aImg > aCaixa) { const c = Math.round(((1 - aCaixa / aImg) / 2) * 100000); corte = `<a:srcRect l="${c}" r="${c}"/>`; } else { const c = Math.round(((1 - aImg / aCaixa) / 2) * 100000); corte = `<a:srcRect t="${c}" b="${c}"/>`; }
    }
  }
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Imagem ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${rId}"/>${corte}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>${geo}</p:spPr></p:pic>`;
}

// Bytes da imagem (data URL ou endereço do app), com a extensão e o tamanho em px.
async function bytesDe(src) {
  let bytes;
  let tipo;
  const m = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(src || '');
  if (m) {
    tipo = m[1];
    const bin = atob(m[2]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  } else if (src) {
    const r = await fetch(src);
    if (!r.ok) return null;
    tipo = r.headers.get('content-type') || '';
    bytes = new Uint8Array(await r.arrayBuffer());
  } else return null;
  const img = await imagemDe(src);
  if (!/png|jpe?g/i.test(tipo) && img) {
    // Outro formato (webp, gif): vira JPEG para o PowerPoint abrir.
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    bytes = new Uint8Array(await blob.arrayBuffer());
    tipo = 'image/jpeg';
  }
  return { bytes, ext: /png/i.test(tipo) ? 'png' : 'jpeg', w: img?.naturalWidth, h: img?.naturalHeight };
}

const base = {};
async function parteDoModelo(nome) {
  if (!base[nome]) {
    const r = await fetch(`modelos/relatorio/${nome}`);
    if (!r.ok) throw new Error('Não deu para abrir o modelo do PPTX. Confira a internet e tente de novo.');
    base[nome] = await r.text();
  }
  return base[nome];
}

export async function pptxDoRelatorio(rel) {
  return pptxDeSlides(await slidesDoRelatorio(rel), { titulo: `Relatório de métricas · ${rel.nome}` });
}

export async function pptxDeSlides(slides, { titulo = 'Apresentação' } = {}) {
  const [master, layout, tema, textoPadrao] = await Promise.all(['master.xml', 'layout.xml', 'theme.xml', 'texto-padrao.xml'].map(parteDoModelo));
  const arquivos = [];
  const add = (nome, conteudo) => arquivos.push({ nome, dados: typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : conteudo });
  const midias = [];

  const midiaPorSrc = new Map();
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    const rels = [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
    let id = 2;
    const formas = [];
    for (const el of slide.elementos) {
      if (el.tipo === 'imagem') {
        if (!el.src) continue;
        if (!midiaPorSrc.has(el.src)) {
          const b = await bytesDe(el.src);
          if (b) {
            const nome = `imagem${midias.length + 1}.${b.ext}`;
            midias.push({ nome, bytes: b.bytes });
            midiaPorSrc.set(el.src, { nome, w: b.w, h: b.h });
          } else midiaPorSrc.set(el.src, null);
        }
        const m = midiaPorSrc.get(el.src);
        if (!m) continue;
        const rId = `rId${rels.length + 1}`;
        rels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${m.nome}"/>`);
        formas.push(figura(id++, el, rId, m));
      } else if (el.tipo === 'retangulo') formas.push(retangulo(id++, el));
      else formas.push(caixaDeTexto(id++, el));
    }
    add(`ppt/slides/slide${i + 1}.xml`, `${CABECALHO}<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(slide.fundo || 'fundo')}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${formas.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    add(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  }
  midias.forEach((m) => add(`ppt/media/${m.nome}`, m.bytes));

  const n = slides.length;
  const tipoSlide = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
  add('[Content_Types].xml', `${CABECALHO}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>'
    + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
    + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
    + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
    + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    + '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>'
    + '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>'
    + '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    + slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${tipoSlide}"/>`).join('')
    + '</Types>');
  add('_rels/.rels', `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    + '</Relationships>');
  const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  add('docProps/core.xml', `${CABECALHO}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(titulo)}</dc:title><dc:creator>Confluir</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified></cp:coreProperties>`);
  add('docProps/app.xml', `${CABECALHO}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Bússola</Application><Slides>${n}</Slides></Properties>`);
  add('ppt/presentation.xml', `${CABECALHO}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>`
    + `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('')}</p:sldIdLst>`
    + `<p:sldSz cx="${emu(LARGURA)}" cy="${emu(ALTURA)}"/><p:notesSz cx="6858000" cy="9144000"/>${textoPadrao}</p:presentation>`);
  add('ppt/_rels/presentation.xml.rels', `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>'
    + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
    + '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>'
    + slides.map((_, i) => `<Relationship Id="rId${10 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')
    + '</Relationships>');
  add('ppt/presProps.xml', `${CABECALHO}<p:presentationPr ${NS}/>`);
  add('ppt/viewProps.xml', `${CABECALHO}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  add('ppt/tableStyles.xml', `${CABECALHO}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  add('ppt/slideMasters/slideMaster1.xml', master);
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  add('ppt/slideLayouts/slideLayout1.xml', layout);
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  add('ppt/theme/theme1.xml', tema);
  // O [Content_Types].xml vai primeiro no ZIP (alguns leitores exigem).
  arquivos.sort((a, b) => (a.nome === '[Content_Types].xml' ? -1 : b.nome === '[Content_Types].xml' ? 1 : 0));
  return new Blob([zipSemCompressao(arquivos)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

// ZIP "store" (sem compressão): as imagens já vêm comprimidas e o XML é pequeno.
let tabelaCrc = null;
function crc32(bytes) {
  if (!tabelaCrc) {
    tabelaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tabelaCrc[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) c = tabelaCrc[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function zipSemCompressao(arquivos) {
  const enc = new TextEncoder();
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1º de janeiro de 1980
    local.setUint32(14, crc, true);
    local.setUint32(18, a.dados.length, true);
    local.setUint32(22, a.dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    locais.push(new Uint8Array(local.buffer), nome, a.dados);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0x21, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, a.dados.length, true);
    central.setUint32(24, a.dados.length, true);
    central.setUint16(28, nome.length, true);
    central.setUint32(42, deslocamento, true);
    centrais.push(new Uint8Array(central.buffer), nome);
    deslocamento += 30 + nome.length + a.dados.length;
  }
  const tamCentral = centrais.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, deslocamento, true);
  const partes = [...locais, ...centrais, new Uint8Array(fim.buffer)];
  const total = partes.reduce((s, b) => s + b.length, 0);
  const saida = new Uint8Array(total);
  let p = 0;
  for (const b of partes) { saida.set(b, p); p += b.length; }
  return saida;
}

export async function baixarPptx(rel) {
  baixar(await pptxDoRelatorio(rel), nomeDoArquivo(rel, 'pptx'));
}
export async function baixarPdf(rel) {
  baixar(await pdfDoRelatorio(rel), nomeDoArquivo(rel, 'pdf'));
}
