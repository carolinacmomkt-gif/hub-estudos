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

  // Arrastar para baixo pela alça ou pelo topo da folha (sem atrapalhar a rolagem do conteúdo).
  let arraste = null;
  document.addEventListener('pointerdown', (e) => {
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

  // Escolher uma tela (no Mais, por exemplo) fecha a folha que estava aberta.
  window.addEventListener('hashchange', () => {
    for (const folha of document.querySelectorAll('dialog.folha[open]')) folha.close();
  });
  // Ao fechar, a folha volta ao lugar (para abrir certinha da próxima vez).
  document.addEventListener('close', (e) => {
    if (e.target instanceof HTMLDialogElement) e.target.style.transform = '';
  }, true);
}
