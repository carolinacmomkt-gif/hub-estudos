// "Meus modelos" do Com as mãos (Carol, 02/11/2026): desenhos dela (foto, imagem, PDF ou um desenho feito
// na folha) que viram modelo para colorir com o balde ou para cobrir com a caneta.
// O modelo guarda só os traços: um PNG com os traços opacos e o resto transparente (até 1000 px), em
// config "maos_modelo:<id>" { nome, imagem, largura, altura }. Na tela, os traços ganham a cor do tema.
// Colorir um modelo seu guarda só os toques (dados.toques [[x, y, tinta]]): a pintura é refeita a cada vez.

import { obterEstado } from './estado.js';
import { abrirPdf, paginaDoPdf } from './fundos.js';

export const LADO_MAX = 1000;

export function meusModelos(estado = obterEstado()) {
  return (estado.config || [])
    .filter((c) => String(c.chave).startsWith('maos_modelo:') && !c.excluido_em && c.valor?.imagem)
    .map((c) => ({ id: c.chave.slice('maos_modelo:'.length), nome: c.valor.nome || 'Meu modelo', imagem: c.valor.imagem, largura: c.valor.largura, altura: c.valor.altura, linha: c }))
    .sort((a, b) => String(b.linha.criado_em || '').localeCompare(String(a.linha.criado_em || '')));
}
export const meuModelo = (id, estado) => meusModelos(estado).find((m) => m.id === id) || null;

const cssVar = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
const canvasDe = (l, a) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(l)); c.height = Math.max(1, Math.round(a)); return c; };

// ---------------------------------------------------------------------------
// Importar: arquivo → imagem em tons de cinza → só os traços
// ---------------------------------------------------------------------------

export async function lerFonte(arquivo) {
  if (/pdf$/i.test(arquivo.type || arquivo.name)) {
    const doc = await abrirPdf(arquivo);
    const bmp = await createImageBitmap((await paginaDoPdf(doc, 1, 1400)).blob);
    doc.destroy();
    return bmp;
  }
  return createImageBitmap(arquivo);
}

// Tons de cinza (0 = preto) no tamanho final, já girado (giro: 0, 1, 2, 3 = 0°, 90°, 180°, 270°).
export function cinzaDe(fonte, giro = 0) {
  const deitado = giro % 2 === 1;
  const escala = Math.min(1, LADO_MAX / Math.max(fonte.width, fonte.height));
  const l = Math.round((deitado ? fonte.height : fonte.width) * escala);
  const a = Math.round((deitado ? fonte.width : fonte.height) * escala);
  const c = canvasDe(l, a);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; // papel branco por baixo de PNG transparente (só no processamento, nunca na tela)
  x.fillRect(0, 0, l, a);
  x.translate(l / 2, a / 2);
  x.rotate((giro * Math.PI) / 2);
  x.drawImage(fonte, (-fonte.width * escala) / 2, (-fonte.height * escala) / 2, fonte.width * escala, fonte.height * escala);
  const { data } = x.getImageData(0, 0, l, a);
  const cinza = new Uint8ClampedArray(l * a);
  for (let i = 0; i < cinza.length; i += 1) cinza[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11);
  return { cinza, largura: l, altura: a };
}

// Limiar automático (Otsu): separa traço de fundo numa foto de página impressa.
export function limiarAutomatico(cinza) {
  const hist = new Array(256).fill(0);
  for (const v of cinza) hist[v] += 1;
  const total = cinza.length;
  let soma = 0;
  for (let i = 0; i < 256; i += 1) soma += i * hist[i];
  let somaB = 0; let pesoB = 0; let melhor = 0; let limiar = 128;
  for (let i = 0; i < 256; i += 1) {
    pesoB += hist[i];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    somaB += i * hist[i];
    const mB = somaB / pesoB; const mF = (soma - somaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) * (mB - mF);
    if (entre > melhor) { melhor = entre; limiar = i; }
  }
  return limiar;
}

// Máscara dos traços: 1 = traço (mais escuro que o limiar). "limpar" (0–100) aperta o limiar para
// sumir com o cinza e as sombras da foto.
export function mascaraDe({ cinza, largura, altura }, limiar) {
  const m = new Uint8Array(largura * altura);
  for (let i = 0; i < m.length; i += 1) m[i] = cinza[i] < limiar ? 1 : 0;
  return { m, largura, altura };
}

// Máscara → PNG (traço opaco, resto transparente).
export function pngDaMascara({ m, largura, altura }) {
  const c = canvasDe(largura, altura);
  const x = c.getContext('2d');
  const img = x.createImageData(largura, altura);
  for (let i = 0; i < m.length; i += 1) if (m[i]) img.data[i * 4 + 3] = 255;
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// Desenho feito na folha (canvas da tinta) → máscara recortada no que tem traço, com margem.
export function mascaraDoDesenho(canvas) {
  const x = canvas.getContext('2d', { willReadFrequently: true });
  const { width: l, height: a } = canvas;
  const { data } = x.getImageData(0, 0, l, a);
  let x0 = l; let y0 = a; let x1 = -1; let y1 = -1;
  for (let y = 0; y < a; y += 1) for (let xx = 0; xx < l; xx += 1) if (data[(y * l + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const margem = Math.round(Math.max(x1 - x0, y1 - y0) * 0.06) + 4;
  x0 = Math.max(0, x0 - margem); y0 = Math.max(0, y0 - margem); x1 = Math.min(l - 1, x1 + margem); y1 = Math.min(a - 1, y1 + margem);
  const escala = Math.min(1, LADO_MAX / Math.max(x1 - x0 + 1, y1 - y0 + 1));
  const c = canvasDe((x1 - x0 + 1) * escala, (y1 - y0 + 1) * escala);
  c.getContext('2d').drawImage(canvas, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, c.width, c.height);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8Array(c.width * c.height);
  for (let i = 0; i < m.length; i += 1) m[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  return { m, largura: c.width, altura: c.height };
}

// ---------------------------------------------------------------------------
// Desenhar os traços na cor do tema
// ---------------------------------------------------------------------------

const imagens = new Map();
export function imagemDoModelo(modelo) {
  if (!imagens.has(modelo.imagem)) {
    imagens.set(modelo.imagem, new Promise((resolver) => { const img = new Image(); img.onload = () => resolver(img); img.onerror = () => resolver(null); img.src = modelo.imagem; }));
  }
  return imagens.get(modelo.imagem);
}

// Traços pintados com uma cor (o PNG é só a forma; a cor vem do tema).
export function tracosNaCor(img, cor, largura = img.width, altura = img.height, opacidade = 1) {
  const c = canvasDe(largura, altura);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, largura, altura);
  x.globalCompositeOperation = 'source-in';
  x.globalAlpha = opacidade;
  x.fillStyle = cor;
  x.fillRect(0, 0, largura, altura);
  return c;
}

// Fundo da folha (para cobrir): papel do tema com os traços clarinhos, centrados na página.
export async function fundoParaCobrir(modelo, dim) {
  const img = await imagemDoModelo(modelo);
  if (!img) return null;
  const c = canvasDe(dim.largura, dim.altura);
  const x = c.getContext('2d');
  x.fillStyle = cssVar('--maos-vazio');
  x.fillRect(0, 0, c.width, c.height);
  const escala = Math.min((dim.largura * 0.84) / img.width, (dim.altura * 0.84) / img.height);
  const l = img.width * escala; const a = img.height * escala;
  x.drawImage(tracosNaCor(img, cssVar('--maos-linha'), l, a, 0.32), (dim.largura - l) / 2, (dim.altura - a) / 2);
  return new Promise((resolver) => { const i = new Image(); i.onload = () => resolver(i); i.src = c.toDataURL('image/png'); });
}

// ---------------------------------------------------------------------------
// Colorir com o balde
// ---------------------------------------------------------------------------

// Barreiras: traço da imagem, engrossado "vedar" px para a tinta não vazar por falhinhas.
export function barreiras(img, vedar = 1) {
  const c = canvasDe(img.width, img.height);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const l = c.width; const a = c.height;
  let m = new Uint8Array(l * a);
  for (let i = 0; i < m.length; i += 1) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  for (let v = 0; v < vedar; v += 1) {
    const n = m.slice();
    for (let y = 1; y < a - 1; y += 1) for (let xx = 1; xx < l - 1; xx += 1) {
      const i = y * l + xx;
      if (!m[i] && (m[i - 1] || m[i + 1] || m[i - l] || m[i + l])) n[i] = 1;
    }
    m = n;
  }
  return { m, l, a };
}

// Pinta a área de (x, y) (preenchimento por linhas) no ImageData "cor" com [r, g, b, alfa].
function balde(b, cores, x, y, rgba) {
  const { m, l, a } = b;
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= l || y >= a || m[y * l + x]) return 0;
  const visto = new Uint8Array(l * a);
  const pilha = [[x, y]];
  let pintados = 0;
  while (pilha.length) {
    const [px, py] = pilha.pop();
    let xi = px;
    while (xi >= 0 && !m[py * l + xi] && !visto[py * l + xi]) xi -= 1;
    xi += 1;
    let acima = false; let abaixo = false;
    while (xi < l && !m[py * l + xi] && !visto[py * l + xi]) {
      const i = py * l + xi;
      visto[i] = 1;
      cores.data.set(rgba, i * 4);
      pintados += 1;
      if (py > 0) { const livre = !m[i - l] && !visto[i - l]; if (livre && !acima) { pilha.push([xi, py - 1]); acima = true; } else if (!livre) acima = false; }
      if (py < a - 1) { const livre = !m[i + l] && !visto[i + l]; if (livre && !abaixo) { pilha.push([xi, py + 1]); abaixo = true; } else if (!livre) abaixo = false; }
      xi += 1;
    }
  }
  return pintados;
}

// A área fechada que contém (x, y): máscara (1 = dentro), para a pintura à mão não sair da linha.
export function areaDoPonto(b, x, y) {
  const { m, l, a } = b;
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= l || y >= a || m[y * l + x]) return null;
  const visto = new Uint8Array(l * a);
  const pilha = [[x, y]];
  while (pilha.length) {
    const [px, py] = pilha.pop();
    let xi = px;
    while (xi >= 0 && !m[py * l + xi] && !visto[py * l + xi]) xi -= 1;
    xi += 1;
    let acima = false; let abaixo = false;
    while (xi < l && !m[py * l + xi] && !visto[py * l + xi]) {
      const i = py * l + xi;
      visto[i] = 1;
      if (py > 0) { const livre = !m[i - l] && !visto[i - l]; if (livre && !acima) { pilha.push([xi, py - 1]); acima = true; } else if (!livre) acima = false; }
      if (py < a - 1) { const livre = !m[i + l] && !visto[i + l]; if (livre && !abaixo) { pilha.push([xi, py + 1]); abaixo = true; } else if (!livre) abaixo = false; }
      xi += 1;
    }
  }
  return visto;
}

function rgbaDe(cor) {
  const c = canvasDe(1, 1);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = cor;
  x.fillRect(0, 0, 1, 1);
  return [...x.getImageData(0, 0, 1, 1).data];
}

// Pintura de um modelo seu: papel, as áreas dos toques (em ordem) e os traços por cima. Cada toque
// novo pinta só a área tocada (sem refazer tudo); desfazer refaz a partir dos toques guardados.
export async function criarPintura(canvas, modelo, toques = [], vedar = 1, camadaTracos = null) {
  const img = await imagemDoModelo(modelo);
  if (!img) return null;
  canvas.width = img.width; canvas.height = img.height;
  const x = canvas.getContext('2d', { willReadFrequently: true });
  const b = barreiras(img, vedar);
  const tracos = tracosNaCor(img, cssVar('--maos-linha'));
  const papel = rgbaDe(cssVar('--maos-vazio'));
  const tintas = new Map();
  const rgba = (n) => { if (!tintas.has(n)) tintas.set(n, n ? rgbaDe(cssVar(`--pinta-${n}`)) : papel); return tintas.get(n); };
  let cores;
  // Com a camada de traços separada (pintura à mão no meio), os traços vão para ela, por cima de tudo.
  if (camadaTracos) { camadaTracos.width = img.width; camadaTracos.height = img.height; camadaTracos.getContext('2d').drawImage(tracos, 0, 0); }
  const desenhar = () => { x.putImageData(cores, 0, 0); if (!camadaTracos) x.drawImage(tracos, 0, 0); };
  const refazer = (lista) => {
    cores = x.createImageData(img.width, img.height);
    for (let i = 0; i < cores.data.length; i += 4) cores.data.set(papel, i);
    for (const [tx, ty, n] of lista) balde(b, cores, tx, ty, rgba(n));
    desenhar();
  };
  refazer(toques);
  return {
    largura: img.width,
    altura: img.height,
    barreira: b,
    // Pinta a área de (tx, ty); devolve false se tocou num traço (fora de área).
    tocar(tx, ty, n) { const ok = balde(b, cores, tx, ty, rgba(n)) > 0; if (ok) desenhar(); return ok; },
    refazer,
  };
}

// Miniatura (para a galeria): o canvas inteiro em JPEG pequeno.
export function miniaturaDoCanvas(canvas, largura = 240) {
  const altura = Math.round(largura * (canvas.height / canvas.width));
  const c = canvasDe(largura, altura);
  c.getContext('2d').drawImage(canvas, 0, 0, largura, altura);
  return c.toDataURL('image/jpeg', 0.75);
}
