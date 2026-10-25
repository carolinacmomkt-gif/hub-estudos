// Fundos de página com imagem: modelos próprios (imagem ou PDF importado como folha) e
// páginas de caderno de PDF. As imagens ficam no Storage e numa cópia no aparelho
// (Cache "hub-arquivos"), para abrir sem internet. O PDF é lido aqui mesmo, com o pdf.js.

import { obterEstado } from './estado.js';
import { baixarArquivo } from './nuvem.js';

const CACHE = 'hub-arquivos';
const LARGURA_FUNDO = 1600; // px da imagem de cada página de PDF
const LARGURA_MODELO = 1400;
const imagens = new Map(); // chave → Promise<ImageBitmap|null>
let pdfjs = null;

const chave = (caminho) => new Request(`${location.origin}/__arquivos/${caminho}`);

export async function guardarNoAparelho(caminho, blob) {
  try {
    const c = await caches.open(CACHE);
    await c.put(chave(caminho), new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }));
  } catch {
    // sem Cache Storage: segue só com a nuvem
  }
}

// Blob do arquivo: primeiro a cópia do aparelho, depois a nuvem (e guarda a cópia).
export async function arquivoGuardado(caminho) {
  try {
    const r = await (await caches.open(CACHE)).match(chave(caminho));
    if (r) return r.blob();
  } catch {
    // sem Cache Storage
  }
  const blob = await baixarArquivo(caminho);
  await guardarNoAparelho(caminho, blob);
  return blob;
}

export async function apagarDoAparelho(caminho) {
  try {
    await (await caches.open(CACHE)).delete(chave(caminho));
  } catch {
    // nada a apagar
  }
}

// ---------------------------------------------------------------------------
// Modelos próprios (ficam em config, chave "modelo_folha:<id>", com a imagem em JPEG)
// ---------------------------------------------------------------------------

export function modelosProprios(estado = obterEstado()) {
  return (estado.config || [])
    .filter((c) => String(c.chave).startsWith('modelo_folha:') && !c.excluido_em && c.valor?.imagem)
    .map((c) => ({ id: c.chave.slice('modelo_folha:'.length), nome: c.valor.nome || 'Meu modelo', imagem: c.valor.imagem, linha: c }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function deImagem(url) {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = url;
  });
}

// Imagem do fundo de uma página (null quando o fundo é um modelo desenhado).
export function imagemDoFundo(pagina) {
  const modelo = pagina?.modelo_folha || pagina?.modelo || '';
  let k = null;
  let carregar = null;
  if (modelo.startsWith('proprio:')) {
    const m = modelosProprios().find((x) => `proprio:${x.id}` === modelo);
    if (!m) return Promise.resolve(null);
    k = modelo;
    carregar = () => deImagem(m.imagem);
  } else if (modelo === 'pdf' && pagina.pdf_path) {
    k = pagina.pdf_path;
    carregar = async () => {
      try {
        return await createImageBitmap(await arquivoGuardado(pagina.pdf_path));
      } catch {
        return null;
      }
    };
  }
  if (!k) return Promise.resolve(null);
  if (!imagens.has(k)) {
    const p = carregar();
    imagens.set(k, p);
    p.then((img) => { if (!img) imagens.delete(k); });
  }
  return imagens.get(k);
}

// ---------------------------------------------------------------------------
// Imagens e PDFs
// ---------------------------------------------------------------------------

function canvasPara(largura, altura) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(largura));
  c.height = Math.max(1, Math.round(altura));
  return c;
}

const paraBlob = (canvas, tipo = 'image/jpeg', qualidade = 0.86) => new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));

async function carregarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

export async function abrirPdf(blob) {
  const lib = await carregarPdfjs();
  return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
}

// Uma página do PDF como imagem JPEG (fundo branco), com "largura" px. Devolve { blob, largura, altura }.
export async function paginaDoPdf(doc, n, largura = LARGURA_FUNDO) {
  const pagina = await doc.getPage(n);
  const base = pagina.getViewport({ scale: 1 });
  const vista = pagina.getViewport({ scale: largura / base.width });
  const canvas = canvasPara(vista.width, vista.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // papel do PDF: branco como no original
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
  pagina.cleanup();
  return { blob: await paraBlob(canvas), largura: base.width, altura: base.height };
}

// Imagem (ou 1ª página de um PDF) → JPEG em data URL para virar modelo de folha.
export async function imagemParaModelo(arquivo) {
  let fonte;
  if (/pdf$/i.test(arquivo.type || arquivo.name)) {
    const doc = await abrirPdf(arquivo);
    fonte = await createImageBitmap((await paginaDoPdf(doc, 1, LARGURA_MODELO)).blob);
    doc.destroy();
  } else {
    fonte = await createImageBitmap(arquivo);
  }
  const escala = Math.min(1, LARGURA_MODELO / fonte.width);
  const canvas = canvasPara(fonte.width * escala, fonte.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  fonte.close?.();
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), proporcao: canvas.height / canvas.width };
}
