// iPhone (app adicionado à Tela de Início): depois que o teclado fecha, o Safari às vezes guarda o
// tamanho antigo da tela e a barra de baixo fica "flutuando" no meio. Aqui a barra acompanha a
// área que está visível de verdade (visualViewport), e some enquanto o teclado está aberto.

const TECLADO_MIN = 150; // px a menos na tela que já querem dizer teclado aberto

export function ligarAjusteDaTela() {
  const vv = window.visualViewport;
  if (!vv) return;
  const raiz = document.documentElement;
  let quadro = 0;
  const ajustar = () => {
    quadro = 0;
    const falta = window.innerHeight - vv.height; // o que o teclado (ou a barra do Safari) cobre
    const teclado = falta > TECLADO_MIN && document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
    if (teclado) document.body.dataset.teclado = 'aberto';
    else delete document.body.dataset.teclado;
    // Diferença entre o fim da área visível e o fim da área em que o "fixed" se apoia.
    const desvio = teclado ? 0 : Math.round(vv.offsetTop + vv.height - window.innerHeight);
    raiz.style.setProperty('--ajuste-base', `${Math.abs(desvio) > 1 ? desvio : 0}px`);
  };
  const agendar = () => { if (!quadro) quadro = requestAnimationFrame(ajustar); };
  vv.addEventListener('resize', agendar);
  vv.addEventListener('scroll', agendar);
  window.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('orientationchange', agendar);
  // Teclado fechando: o Safari recalcula a tela quando a página "rola" um nada.
  document.addEventListener('focusout', (e) => {
    // Só quando sai de um campo (o teclado fechando); senão atrapalharia a rolagem suave.
    if (!e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    setTimeout(() => {
      if (!document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) window.scrollTo(window.scrollX, window.scrollY);
      agendar();
    }, 80);
  });
  document.addEventListener('focusin', agendar);
  ajustar();
}
