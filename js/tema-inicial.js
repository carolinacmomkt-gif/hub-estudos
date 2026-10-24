// Roda no <head>, antes do CSS, para a tela já abrir no tema e no tamanho de texto certos.
// A lógica completa fica em tema.js e preferencias.js.
(function () {
  var preferencia = 'escuro';
  try {
    preferencia = localStorage.getItem('hub.tema') || 'escuro';
  } catch (e) {}
  var claro = preferencia === 'claro' ||
    (preferencia === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.tema = claro ? 'claro' : 'escuro';

  var texto = 'normal';
  try {
    texto = localStorage.getItem('hub.texto') || 'normal';
  } catch (e) {}
  document.documentElement.dataset.texto = texto;
})();
