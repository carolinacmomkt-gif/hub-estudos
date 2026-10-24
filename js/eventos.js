// Cliques e interações globais (delegação no documento).

import { definirTema } from './tema.js';

export function ligarEventos() {
  const folhaMais = document.getElementById('folha-mais');

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-tema-opcao], [data-acao], a[href^="#"]');
    if (!alvo) return;

    if (alvo.dataset.temaOpcao) {
      definirTema(alvo.dataset.temaOpcao);
      return;
    }

    switch (alvo.dataset.acao) {
      case 'abrir-mais':
        folhaMais.showModal();
        return;
      case 'fechar-mais':
        folhaMais.close();
        return;
    }

    // Um link escolhido dentro da folha "Mais" fecha a folha.
    if (folhaMais.open && folhaMais.contains(alvo)) folhaMais.close();
  });

  // Tocar fora da folha (no véu) também fecha.
  folhaMais.addEventListener('click', (evento) => {
    if (evento.target === folhaMais) folhaMais.close();
  });
}
