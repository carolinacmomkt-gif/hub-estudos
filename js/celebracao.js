// Comemorações curtas, reaproveitadas no app todo: o "+10" que sobe do botão e o cartão de
// conquista no meio da tela. Somem sozinhos; com "reduzir animações", só aparecem e somem.

import { esc } from './utilidades.js';

export function flutuar(el, texto) {
  if (!el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  const bolha = document.createElement('span');
  bolha.className = 'ponto-flutuante';
  bolha.textContent = texto;
  bolha.style.left = `${Math.round(r.left + r.width / 2)}px`;
  bolha.style.top = `${Math.round(r.top)}px`;
  bolha.setAttribute('aria-hidden', 'true');
  document.body.append(bolha);
  setTimeout(() => bolha.remove(), 1100);
}

export function celebrar(emoji, titulo, texto = '') {
  document.querySelector('.celebracao')?.remove();
  const cartao = document.createElement('div');
  cartao.className = 'celebracao';
  cartao.setAttribute('role', 'status');
  cartao.innerHTML = `<span class="celebracao-emoji" aria-hidden="true">${esc(emoji)}</span><strong>${esc(titulo)}</strong>${texto ? `<span>${esc(texto)}</span>` : ''}`;
  document.body.append(cartao);
  try {
    navigator.vibrate?.([30, 60, 30]);
  } catch {
    // sem vibração
  }
  setTimeout(() => cartao.remove(), 4200);
}
