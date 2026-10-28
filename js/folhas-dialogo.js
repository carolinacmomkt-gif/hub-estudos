// Folhas que sobem de baixo (Mais, Criar, formulários): fecham como nos apps do celular.
// Arrastar para baixo, tocar fora (no véu) ou trocar de tela fecham; o botão Voltar do Android
// e o Esc já fecham pelo próprio <dialog>.

const LIMITE = 90; // px arrastados para baixo para fechar
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function fechar(folha) {
  if (!folha.open) return;
  if (reduzido()) {
    folha.close();
    return;
  }
  folha.classList.add('fechando');
  setTimeout(() => {
    folha.classList.remove('fechando');
    folha.style.transform = '';
    folha.close();
  }, 160);
}

export function ligarFolhas() {
  // Tocar no véu (fora da folha) fecha. O clique no véu chega com o próprio <dialog> como alvo.
  document.addEventListener('click', (e) => {
    const folha = e.target;
    if (!(folha instanceof HTMLDialogElement) || !folha.classList.contains('folha') || !folha.open) return;
    const r = folha.getBoundingClientRect();
    const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) fechar(folha);
  });

  // Mouse e caneta: arrastar pela alça ou pelo topo da folha.
  let arraste = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return; // o dedo é tratado pelos eventos de toque, abaixo
    const folha = e.target.closest?.('dialog.folha[open]');
    if (!folha || e.button > 0) return;
    const topo = e.target.closest('.folha-alca, .folha-titulo') || e.clientY - folha.getBoundingClientRect().top < 44;
    if (!topo || e.target.closest('input, textarea, select, button, a')) return;
    arraste = { folha, y: e.clientY, id: e.pointerId, dy: 0 };
    folha.style.transition = 'none';
  });
  document.addEventListener('pointermove', (e) => {
    if (!arraste || e.pointerId !== arraste.id) return;
    arraste.dy = Math.max(0, e.clientY - arraste.y);
    arraste.folha.style.transform = `translateY(${arraste.dy}px)`;
  });
  const soltar = (e) => {
    if (!arraste || e.pointerId !== arraste.id) return;
    const { folha, dy } = arraste;
    arraste = null;
    folha.style.transition = '';
    if (dy > LIMITE) fechar(folha);
    else folha.style.transform = '';
  };
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);

  // Dedo (iPhone e Android): arrastar para baixo de qualquer ponto da folha, quando ela está no
  // topo da rolagem, faz a folha descer junto com o dedo; soltando longe (ou rápido), ela fecha.
  // O Safari cancela os Pointer Events quando acha que é rolagem; os eventos de toque, não.
  let toque = null;
  document.addEventListener('touchstart', (e) => {
    const folha = e.target.closest?.('dialog.folha[open]');
    if (!folha || e.touches.length !== 1 || e.target.closest('input, textarea, select, [contenteditable]')) return;
    toque = { folha, y: e.touches[0].clientY, t: Date.now(), dy: 0, arrastando: false, rolava: folha.scrollTop > 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!toque) return;
    const y = e.touches[0].clientY;
    const dy = y - toque.y;
    if (!toque.arrastando) {
      // Subir o dedo (ou folha já rolada) é rolagem normal: o app sai da frente.
      if (toque.rolava || toque.folha.scrollTop > 0 || dy < 0) {
        toque = null;
        return;
      }
      // Na folha no topo, descer o dedo não tem o que rolar: o app assume o gesto já no começo
      // (senão o navegador decide que é rolagem e não deixa mais a folha acompanhar o dedo).
      if (e.cancelable) e.preventDefault();
      if (dy < 6) return;
      toque.arrastando = true;
      toque.folha.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault(); // a página não rola nem "quica" por trás
    toque.dy = Math.max(0, dy - 6);
    toque.vel = (y - (toque.ultimoY ?? toque.y)) / Math.max(1, Date.now() - (toque.ultimoT ?? toque.t));
    toque.ultimoY = y;
    toque.ultimoT = Date.now();
    toque.folha.style.transform = `translateY(${toque.dy}px)`;
  }, { passive: false });
  const fimDoToque = (e) => {
    if (!toque) return;
    const { folha, dy, arrastando, vel = 0, t } = toque;
    toque = null;
    if (!arrastando) return;
    if (e.cancelable) e.preventDefault(); // um arraste não vira toque no link onde o dedo parou
    folha.style.transition = '';
    // Puxão rápido também fecha (como nos apps do iPhone), mesmo sem chegar ao limite.
    const rapido = dy > 30 && Math.max(vel, dy / Math.max(1, Date.now() - t)) > 0.35;
    if (dy > LIMITE || rapido) fechar(folha);
    else folha.style.transform = '';
  };
  document.addEventListener('touchend', fimDoToque, { passive: false });
  document.addEventListener('touchcancel', fimDoToque, { passive: false });

  // Escolher uma tela (no Mais, por exemplo) fecha a folha que estava aberta.
  window.addEventListener('hashchange', () => {
    for (const folha of document.querySelectorAll('dialog.folha[open]')) folha.close();
  });
  // Ao fechar, a folha volta ao lugar (para abrir certinha da próxima vez).
  document.addEventListener('close', (e) => {
    if (!(e.target instanceof HTMLDialogElement)) return;
    e.target.style.transform = '';
    e.target.scrollTop = 0;
  }, true);
}
