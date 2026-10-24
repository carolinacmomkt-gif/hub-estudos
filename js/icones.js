// Ícones de traço, sempre na cor do texto (currentColor).

const CAMINHOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  faculdade: 'M2 9.5 12 5l10 4.5-10 4.5z M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5 M22 9.5V15',
  estudos: 'M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z',
  substack: 'M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z M14 7l3 3 M13 20h7',
  biblioteca: 'M4 4h4v16H4z M10 4h4v16h-4z M16 5.2l3.8-1.1 3.6 14.6-3.8 1.1z',
  cadernos: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z M3 7h3 M3 12h3 M3 17h3 M10 8h5 M10 12h5',
  questoes: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9.2a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.7v.6 M12 17h.01',
  calendario: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M4 10h16 M8 3v4 M16 3v4',
  configuracoes: 'M4 6h9 M17 6h3 M15 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h11 M19 18h1 M17 16v4',
  mais: 'M5 12h.01 M12 12h.01 M19 12h.01',
  claro: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  escuro: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  auto: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 3v18',
  marca: 'M3 5h6a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H3z M21 5h-6a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H21z',
};

export function icone(nome) {
  const espessura = nome === 'mais' ? 3 : 1.8;
  // O ícone "auto" pinta a metade direita, como um meio círculo.
  const preenchimento = nome === 'auto'
    ? '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'
    : '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${CAMINHOS[nome]}"/>${preenchimento}</svg>`;
}
