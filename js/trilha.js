// Trilha do Spotify que continua tocando em qualquer tela: o player fica fora do #conteudo
// (que é redesenhado a cada clique), num cantinho que abre e recolhe. Recolhido, ele vira
// uma pílula "🎵 Trilha" e a música segue.

import { spotifyEmbed } from './dados-metas.js';

const CHAVE = 'bussola.trilha';
let caixa = null;
let srcAtual = '';

function lerEstado() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}

function guardarEstado(estado) {
  try {
    if (estado) sessionStorage.setItem(CHAVE, JSON.stringify(estado));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: vale até fechar
  }
}

function montarCaixa() {
  if (caixa) return caixa;
  caixa = document.createElement('section');
  caixa.className = 'trilha';
  caixa.id = 'trilha';
  caixa.setAttribute('aria-label', 'Trilha do Spotify');
  caixa.innerHTML = `
    <div class="trilha-barra">
      <button class="trilha-pilula" type="button" data-trilha="alternar" aria-expanded="true">🎵 <span>Trilha</span></button>
      <button class="trilha-botao" type="button" data-trilha="fechar" aria-label="Fechar a trilha (a música para)">×</button>
    </div>
    <div class="trilha-player"></div>`;
  caixa.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-trilha]');
    if (!alvo) return;
    if (alvo.dataset.trilha === 'fechar') fecharTrilha();
    else recolher(!caixa.classList.contains('recolhida'));
  });
  document.body.append(caixa);
  return caixa;
}

function recolher(sim) {
  if (!caixa) return;
  caixa.classList.toggle('recolhida', sim);
  caixa.querySelector('.trilha-pilula').setAttribute('aria-expanded', String(!sim));
  guardarEstado({ src: srcAtual, recolhida: sim });
}

// Abre o player com o link (playlist, álbum ou música). Se já está tocando o mesmo, só mostra.
export function tocarTrilha(link, { recolhida = false } = {}) {
  const src = spotifyEmbed(link);
  if (!src) return false;
  montarCaixa();
  if (src !== srcAtual) {
    srcAtual = src;
    caixa.querySelector('.trilha-player').innerHTML = `<iframe title="Trilha do Spotify" src="${src}" loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
  }
  caixa.hidden = false;
  recolher(recolhida);
  return true;
}

export function fecharTrilha() {
  if (!caixa) return;
  caixa.querySelector('.trilha-player').innerHTML = '';
  caixa.hidden = true;
  srcAtual = '';
  guardarEstado(null);
}

export const trilhaAberta = () => Boolean(caixa && !caixa.hidden && srcAtual);

// Depois de recarregar a página, a pílula volta (recolhida; tocar de novo é um toque).
export function retomarTrilha() {
  const e = lerEstado();
  if (e?.src) {
    const m = String(e.src).match(/embed\/(\w+)\/(\w+)/);
    if (m) tocarTrilha(`https://open.spotify.com/${m[1]}/${m[2]}`, { recolhida: true });
  }
}
