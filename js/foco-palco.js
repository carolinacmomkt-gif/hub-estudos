// Tela imersiva da sessão de foco ("palco"): relógio flip, tela cheia, tela sempre acesa,
// controles que somem sozinhos, som ambiente gerado no aparelho e a comemoração no fim do foco.

const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Relógio flip
// ---------------------------------------------------------------------------

const metade = (classe, d) => `<span class="${classe}"><b>${d}</b></span>`;
const cartao = (d) => `<span class="flip" data-v="${d}">${metade('flip-cima', d)}${metade('flip-baixo', d)}</span>`;

export function relogioFlip(texto) {
  return [...texto].map((c) => (c === ':' ? '<span class="flip-sep">:</span>' : cartao(c))).join('');
}

// Vira só os cartões que mudaram (de segundo em segundo).
export function atualizarFlip(texto) {
  const caixa = document.querySelector('[data-flip]');
  if (!caixa) return;
  const cartoes = caixa.querySelectorAll('.flip');
  const digitos = [...texto].filter((c) => c !== ':');
  if (cartoes.length !== digitos.length) {
    caixa.innerHTML = relogioFlip(texto);
    return;
  }
  digitos.forEach((novo, i) => {
    const el = cartoes[i];
    const antigo = el.dataset.v;
    if (antigo === novo) return;
    el.dataset.v = novo;
    el.querySelector('.flip-cima b').textContent = novo;
    if (semMovimento() || document.hidden) {
      el.querySelector('.flip-baixo b').textContent = novo;
      el.querySelectorAll('.flip-folha').forEach((f) => f.remove());
      return;
    }
    el.querySelectorAll('.flip-folha').forEach((f) => f.remove());
    el.insertAdjacentHTML('beforeend', `${metade('flip-folha folha-cima', antigo)}${metade('flip-folha folha-baixo', novo)}`);
    setTimeout(() => {
      if (el.dataset.v !== novo) return;
      el.querySelector('.flip-baixo b').textContent = novo;
      el.querySelectorAll('.flip-folha').forEach((f) => f.remove());
    }, 620);
  });
}

// ---------------------------------------------------------------------------
// Tela cheia e tela sempre acesa
// ---------------------------------------------------------------------------

export function entrarEmTelaCheia() {
  try {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  } catch {
    // o navegador não deixa: o palco já ocupa a janela inteira
  }
}

export function sairDaTelaCheia() {
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {
    // nada a fazer
  }
}

export const emTelaCheia = () => Boolean(document.fullscreenElement);

let trava = null;
let querTrava = false;

async function pedirTrava() {
  if (!querTrava || trava || document.hidden || !('wakeLock' in navigator)) return;
  try {
    trava = await navigator.wakeLock.request('screen');
    trava.addEventListener('release', () => { trava = null; });
  } catch {
    trava = null;
  }
}

export function telaAcesa(ligar) {
  querTrava = ligar;
  if (ligar) pedirTrava();
  else if (trava) {
    trava.release().catch(() => {});
    trava = null;
  }
}

// ---------------------------------------------------------------------------
// Controles que somem depois de 3 s sem mexer (um toque traz de volta)
// ---------------------------------------------------------------------------

let tempoCalmo = null;
let calmoLigado = false;

// O palco pode ser redesenhado no meio (troca de fase): o elemento é procurado na hora.
function acordar() {
  document.querySelector('[data-palco]')?.classList.remove('calmo');
  clearTimeout(tempoCalmo);
  if (calmoLigado) tempoCalmo = setTimeout(() => document.querySelector('[data-palco]')?.classList.add('calmo'), 3000);
}

export function controlesSomem(ligar) {
  calmoLigado = ligar;
  acordar();
}

// ---------------------------------------------------------------------------
// Som ambiente (gerado aqui mesmo: funciona sem internet e sem arquivos)
// ---------------------------------------------------------------------------

export const AMBIENTES = [
  { id: '', nome: 'Sem som' },
  { id: 'chuva', nome: 'Chuva' },
  { id: 'marrom', nome: 'Ruído marrom' },
  { id: 'lareira', nome: 'Lareira' },
];

let audio = null; // { ctx, saida, fontes: [], estalos, tipo }

function ruido(ctx, tipo, segundos = 6) {
  const n = ctx.sampleRate * segundos;
  const buffer = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal += 1) {
    const d = buffer.getChannelData(canal);
    let ultimo = 0;
    let b0 = 0; let b1 = 0; let b2 = 0;
    for (let i = 0; i < n; i += 1) {
      const branco = Math.random() * 2 - 1;
      if (tipo === 'rosa') {
        b0 = 0.99765 * b0 + branco * 0.099;
        b1 = 0.963 * b1 + branco * 0.2965;
        b2 = 0.57 * b2 + branco * 1.0526;
        d[i] = (b0 + b1 + b2 + branco * 0.1848) * 0.11;
      } else {
        ultimo = (ultimo + 0.02 * branco) / 1.02;
        d[i] = ultimo * 3.2;
      }
    }
  }
  return buffer;
}

function tocarLaco(ctx, buffer, destino, filtros = []) {
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.loop = true;
  let no = fonte;
  for (const [tipo, freq] of filtros) {
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    no.connect(f);
    no = f;
  }
  no.connect(destino);
  fonte.start();
  return fonte;
}

function estalo(ctx, destino) {
  const n = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.02));
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const f = ctx.createBufferSource();
  const g = ctx.createGain();
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'highpass';
  filtro.frequency.value = 1500 + Math.random() * 2500;
  g.gain.value = 0.15 + Math.random() * 0.35;
  f.buffer = b;
  f.connect(filtro).connect(g).connect(destino);
  f.start();
}

function pararAudio() {
  if (!audio) return;
  const { ctx, saida, estalos } = audio;
  clearInterval(estalos);
  try {
    saida.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  } catch {
    // já fechado
  }
  setTimeout(() => ctx.close().catch(() => {}), 1200);
  audio = null;
}

// tipo: '' (desliga), 'chuva', 'marrom' ou 'lareira'; volume de 0 a 1; baixo = pausa (o som some).
export function somAmbiente(tipo, volume = 0.5, { baixo = false } = {}) {
  if (!tipo) {
    pararAudio();
    return;
  }
  const alvo = baixo ? 0 : Math.max(0, Math.min(1, volume)) * 0.6;
  if (audio?.tipo === tipo) {
    audio.ctx.resume?.().catch(() => {});
    audio.saida.gain.setTargetAtTime(alvo, audio.ctx.currentTime, baixo ? 1.2 : 0.6);
    return;
  }
  pararAudio();
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const saida = ctx.createGain();
    saida.gain.value = 0;
    saida.connect(ctx.destination);
    const fontes = [];
    let estalos = null;
    if (tipo === 'chuva') {
      fontes.push(tocarLaco(ctx, ruido(ctx, 'rosa'), saida, [['highpass', 500], ['lowpass', 7000]]));
    } else if (tipo === 'marrom') {
      fontes.push(tocarLaco(ctx, ruido(ctx, 'marrom'), saida, [['lowpass', 900]]));
    } else if (tipo === 'lareira') {
      fontes.push(tocarLaco(ctx, ruido(ctx, 'marrom'), saida, [['lowpass', 380]]));
      estalos = setInterval(() => {
        if (Math.random() < 0.55) estalo(ctx, saida);
      }, 140);
    }
    audio = { ctx, saida, fontes, estalos, tipo };
    saida.gain.setTargetAtTime(alvo, ctx.currentTime, 0.8);
  } catch {
    audio = null;
  }
}

// O navegador só deixa tocar depois de um toque: ao tocar no palco, o som volta se estava parado.
export function destravarAudio() {
  audio?.ctx.resume?.().catch(() => {});
}

// ---------------------------------------------------------------------------
// Sino do fim da fase (mais suave que um bipe) e comemoração
// ---------------------------------------------------------------------------

export function sino() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [[660, 0], [990, 0], [880, 0.5], [1320, 0.5]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      vol.gain.exponentialRampToValueAtTime(freq > 1000 ? 0.06 : 0.18, ctx.currentTime + t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 1.8);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 1.9);
    });
    setTimeout(() => ctx.close().catch(() => {}), 3000);
  } catch {
    // sem som
  }
}

let conquista = null; // { titulo, texto, ate }

export function comemorar(titulo, texto) {
  conquista = { titulo, texto, ate: Date.now() + 7000 };
}

export function conquistaAtual() {
  return conquista && conquista.ate > Date.now() ? conquista : null;
}

// ---------------------------------------------------------------------------
// Ouvintes (uma vez só)
// ---------------------------------------------------------------------------

let ligado = false;
export function ligarPalco() {
  if (ligado) return;
  ligado = true;
  for (const tipo of ['pointermove', 'pointerdown', 'keydown']) {
    document.addEventListener(tipo, () => {
      if (!document.querySelector('[data-palco]')) return;
      destravarAudio();
      acordar();
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pedirTrava();
  });
  document.addEventListener('fullscreenchange', () => {
    document.querySelectorAll('[data-acao="foco-tela-cheia"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(emTelaCheia()));
      b.setAttribute('aria-label', emTelaCheia() ? 'Sair da tela cheia' : 'Tela cheia');
    });
  });
}
