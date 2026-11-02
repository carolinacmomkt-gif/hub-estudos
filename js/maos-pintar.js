// Colorir à mão (Com as mãos, 02/11/2026): lápis de cor, giz de cera, pincel macio, marca-texto e borracha
// por cima do desenho de colorir, entre o preenchimento (embaixo) e os contornos (sempre por cima).
// "Não sai da linha": o traço fica só dentro da área onde começou (máscara da área).
// Os traços ficam em maos.dados.mao [{ f, n, t, area, p: [[x, y, pressão], ...] }], em unidades da
// camada (1000 × 1000 nos desenhos prontos; o tamanho da imagem nos seus modelos).

import { getStroke } from './vendor/perfect-freehand.js';

export const PINCEIS = [
  { id: 'lapis', nome: 'Lápis de cor' },
  { id: 'giz', nome: 'Giz de cera' },
  { id: 'pincel', nome: 'Pincel' },
  { id: 'marca', nome: 'Marca-texto' },
  { id: 'borracha', nome: 'Borracha' },
];
export const ESPESSURAS = [[8, 'Fina'], [18, 'Média'], [40, 'Grossa']];

const cssVar = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
const canvasDe = (l, a) => { const c = document.createElement('canvas'); c.width = l; c.height = a; return c; };

// Textura de papel (granulado), igual em todo aparelho (semente fixa).
let textura = null;
function texturaDe(ctx) {
  if (!textura) {
    const c = canvasDe(96, 96);
    const x = c.getContext('2d');
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const img = x.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) { const v = rnd(); img.data[i + 3] = v > 0.55 ? Math.round((v - 0.55) * 400) : 0; }
    x.putImageData(img, 0, 0);
    textura = c;
  }
  return ctx.createPattern(textura, 'repeat');
}

function opcoes(f, tamanho, temPressao) {
  const base = { size: tamanho, smoothing: 0.6, streamline: 0.45, simulatePressure: !temPressao, last: true };
  if (f === 'lapis') return { ...base, thinning: 0.45 };
  if (f === 'giz') return { ...base, size: tamanho * 1.25, thinning: 0.25, smoothing: 0.4 };
  if (f === 'pincel') return { ...base, thinning: 0.7, start: { taper: tamanho * 1.5 }, end: { taper: tamanho * 2 } };
  if (f === 'marca') return { ...base, size: tamanho * 1.4, thinning: 0, simulatePressure: false };
  return { ...base, thinning: 0.2 }; // borracha
}

function caminho(contorno) {
  if (contorno.length < 2) return null;
  let d = `M ${contorno[0][0]} ${contorno[0][1]} Q`;
  for (let i = 0; i < contorno.length; i += 1) {
    const [x0, y0] = contorno[i];
    const [x1, y1] = contorno[(i + 1) % contorno.length];
    d += ` ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  return new Path2D(`${d} Z`);
}

// Uma pincelada num canvas do tamanho da camada (já com a cor, a opacidade e a textura do pincel).
function pincelada(l, a, traco, temPressao) {
  const c = canvasDe(l, a);
  const x = c.getContext('2d');
  const forma = caminho(getStroke(traco.p, opcoes(traco.f, traco.t, temPressao)));
  if (!forma) return c;
  x.fillStyle = traco.f === 'borracha' ? '#000' : cssVar(`--pinta-${traco.n}`) || cssVar('--maos-linha');
  if (traco.f === 'marca') x.globalAlpha = 0.38;
  else if (traco.f === 'pincel') x.globalAlpha = 0.9;
  x.fill(forma);
  if (traco.f === 'lapis' || traco.f === 'giz') {
    // Granulado: tira pontinhos do traço, como lápis de cor no papel.
    x.globalAlpha = traco.f === 'giz' ? 0.85 : 0.5;
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = texturaDe(x);
    x.fill(forma);
  }
  return c;
}

// Máscara da área (canvas com a área opaca), para recortar a pincelada.
function recortar(pinc, mascara) {
  if (!mascara) return pinc;
  const x = pinc.getContext('2d');
  x.globalCompositeOperation = 'destination-in';
  x.globalAlpha = 1;
  x.drawImage(mascara, 0, 0);
  return pinc;
}

function aplicar(ctx, pinc, f) {
  ctx.save();
  if (f === 'borracha') ctx.globalCompositeOperation = 'destination-out';
  else if (f === 'marca') ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(pinc, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Áreas: nos desenhos prontos, cada parte do SVG; nos seus modelos, a área fechada do balde
// ---------------------------------------------------------------------------

// Mapa das partes de um SVG de colorir (400×400 → l×a): cada pixel guarda o número da parte de cima.
export async function mapaDoSvg(svg, l, a) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const raiz = doc.documentElement;
  raiz.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  raiz.setAttribute('width', l); raiz.setAttribute('height', a);
  raiz.setAttribute('shape-rendering', 'crispEdges');
  const ids = [];
  raiz.querySelectorAll('path').forEach((p) => {
    if (!p.dataset?.r && !p.getAttribute('data-r')) { p.remove(); return; }
    ids.push(p.getAttribute('data-r'));
    const n = ids.length;
    p.setAttribute('style', `fill: rgb(${n & 255}, ${(n >> 8) & 255}, 7); stroke: none`);
  });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(raiz))}`;
  await img.decode();
  const c = canvasDe(l, a);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, l, a);
  const d = x.getImageData(0, 0, l, a).data;
  const mapa = new Uint16Array(l * a);
  for (let i = 0; i < mapa.length; i += 1) if (d[i * 4 + 2] === 7 && d[i * 4 + 3] === 255) mapa[i] = d[i * 4] + (d[i * 4 + 1] << 8);
  return { mapa, ids, l, a };
}

function mascaraDeIndices(l, a, dentro) {
  const c = canvasDe(l, a);
  const x = c.getContext('2d');
  const img = x.createImageData(l, a);
  for (let i = 0; i < l * a; i += 1) if (dentro(i)) img.data[i * 4 + 3] = 255;
  x.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// A camada de pintura à mão
// ---------------------------------------------------------------------------

// cfg: { canvas, l, a, tracos, area(x, y) → chave|null, mascara(chave) → canvas|null, aoTerminar(traco), ativo() }
export function criarCamadaMao(cfg) {
  const { canvas, l, a } = cfg;
  canvas.width = l; canvas.height = a;
  const ctx = canvas.getContext('2d');
  let atual = null;
  let temPressao = false;
  const toques = new Map();
  let pinca = null;

  const redesenhar = (lista) => {
    ctx.clearRect(0, 0, l, a);
    for (const t of lista) aplicar(ctx, recortar(pincelada(l, a, t, true), t.f === 'borracha' ? null : cfg.mascara(t.area)), t.f);
  };
  redesenhar(cfg.tracos || []);

  const ponto = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * l * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * a * 10) / 10, e.pressure || 0.5];
  };
  const mostrarVivo = () => {
    const pinc = recortar(pincelada(l, a, atual, temPressao), atual.f === 'borracha' ? null : atual.mascara);
    // Mostra o traço por cima do que já existe (sem gravar ainda).
    ctx.save(); ctx.clearRect(0, 0, l, a); ctx.drawImage(atual.base, 0, 0); ctx.restore();
    aplicar(ctx, pinc, atual.f);
  };

  // Zoom e arrastar com dois dedos (a camada inteira, com o desenho embaixo).
  const palco = cfg.palco;
  let zoom = { s: 1, x: 0, y: 0 };
  const aplicarZoom = () => { if (palco) palco.style.transform = zoom.s === 1 ? '' : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`; };

  canvas.addEventListener('pointerdown', (e) => {
    if (!cfg.ativo()) return;
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    if (e.pointerType === 'touch' && toques.size === 2) {
      // Segundo dedo: vira pinça (cancela o traço que começou).
      if (atual) { ctx.clearRect(0, 0, l, a); ctx.drawImage(atual.base, 0, 0); atual = null; }
      const [p1, p2] = [...toques.values()];
      pinca = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), c: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], z: { ...zoom } };
      return;
    }
    if (e.pointerType === 'touch' && !cfg.dedo()) return;
    if (toques.size > 1) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    temPressao = e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5;
    const p = ponto(e);
    const f = cfg.pincel();
    const area = f === 'borracha' || !cfg.naoSai() ? null : cfg.area(p[0], p[1]);
    const base = canvasDe(l, a);
    base.getContext('2d').drawImage(canvas, 0, 0);
    atual = { f, n: cfg.tinta(), t: cfg.tamanho(), area, p: [p], mascara: area === null ? null : cfg.mascara(area), base };
    mostrarVivo();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinca && toques.size === 2) {
      const [p1, p2] = [...toques.values()];
      const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      const c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      zoom = { s: Math.min(5, Math.max(1, pinca.z.s * (d / pinca.d))), x: pinca.z.x + c[0] - pinca.c[0], y: pinca.z.y + c[1] - pinca.c[1] };
      if (zoom.s === 1) { zoom.x = 0; zoom.y = 0; }
      aplicarZoom();
      return;
    }
    if (!atual || (e.pointerType === 'touch' && !cfg.dedo())) return;
    e.preventDefault();
    const eventos = e.getCoalescedEvents?.() || [e];
    for (const ev of eventos) {
      const p = ponto(ev);
      const ult = atual.p[atual.p.length - 1];
      if (Math.hypot(p[0] - ult[0], p[1] - ult[1]) >= 1.5) atual.p.push(p);
    }
    mostrarVivo();
  }, { passive: false });
  const terminar = (e) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (!atual) return;
    const t = { f: atual.f, n: atual.n, t: atual.t, area: atual.area, p: atual.p.map(([x, y, pr]) => [x, y, Math.round(pr * 100) / 100]) };
    atual = null;
    cfg.aoTerminar(t);
  };
  canvas.addEventListener('pointerup', terminar);
  canvas.addEventListener('pointercancel', (e) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (atual) { ctx.clearRect(0, 0, l, a); ctx.drawImage(atual.base, 0, 0); atual = null; }
  });

  return {
    redesenhar,
    zerarZoom() { zoom = { s: 1, x: 0, y: 0 }; aplicarZoom(); },
  };
}

// Máscaras das áreas (com cache por área).
export function mascarasDoSvg(mapa) {
  const cache = new Map();
  return {
    area(x, y) {
      const { l, a } = mapa;
      for (const [dx, dy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [4, 4], [-4, -4]]) {
        const px = Math.round(x) + dx; const py = Math.round(y) + dy;
        if (px < 0 || py < 0 || px >= l || py >= a) continue;
        const n = mapa.mapa[py * l + px];
        if (n) return mapa.ids[n - 1];
      }
      return null;
    },
    mascara(id) {
      if (id === null || id === undefined) return null;
      if (!cache.has(id)) {
        const n = mapa.ids.indexOf(id) + 1;
        cache.set(id, n ? mascaraDeIndices(mapa.l, mapa.a, (i) => mapa.mapa[i] === n) : null);
      }
      return cache.get(id);
    },
  };
}

// Nos seus modelos, a "área" é o ponto onde começou (a máscara sai do balde).
export function mascarasDoModelo(barreira, areaDoPonto) {
  const cache = new Map();
  return {
    area(x, y) { return areaDoPonto(barreira, x, y) ? [Math.round(x), Math.round(y)] : null; },
    mascara(area) {
      if (!area) return null;
      const chave = area.join(',');
      if (!cache.has(chave)) {
        const visto = areaDoPonto(barreira, area[0], area[1]);
        cache.set(chave, visto ? mascaraDeIndices(barreira.l, barreira.a, (i) => visto[i]) : null);
      }
      return cache.get(chave);
    },
  };
}
