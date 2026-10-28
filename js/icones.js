// Ícones de traço, sempre na cor do texto (currentColor).

const CAMINHOS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  recolher: 'M15 6l-6 6 6 6',
  seta: 'M6 9l6 6 6-6',
  estrela: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  foco: 'M12 8v5l3 2M9 2h6M12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  tarefas: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  habitos: 'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  saude: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  financas: 'M3 7h18v12H3zM3 11h18M16 15h2M7 3h10',
  diario: 'M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 8h8M8 12h6',
  casa: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  consultoria: 'M3 8h18v12H3zM8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 13h18',
  metas: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  faculdade: 'M2 9.5 12 5l10 4.5-10 4.5z M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5 M22 9.5V15',
  estudos: 'M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z',
  youtube: 'M3 7.5A3.5 3.5 0 0 1 6.5 4h11A3.5 3.5 0 0 1 21 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5z M10 9l5 3-5 3z',
  substack: 'M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z M14 7l3 3 M13 20h7',
  biblioteca: 'M4 4h4v16H4z M10 4h4v16h-4z M16 5.2l3.8-1.1 3.6 14.6-3.8 1.1z',
  cadernos: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z M3 7h3 M3 12h3 M3 17h3 M10 8h5 M10 12h5',
  questoes: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9.2a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.7v.6 M12 17h.01',
  calendario: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M4 10h16 M8 3v4 M16 3v4',
  configuracoes: 'M4 6h9 M17 6h3 M15 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h11 M19 18h1 M17 16v4',
  mais: 'M5 12h.01 M12 12h.01 M19 12h.01',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  claro: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  escuro: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  auto: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 3v18',
  marca: 'M12 2.8l2.1 7.1 7.1 2.1-7.1 2.1L12 21.2l-2.1-7.1L2.8 12l7.1-2.1z',
};

export function icone(nome) {
  const espessura = nome === 'mais' ? 3 : 1.8;
  // O ícone "auto" pinta a metade direita, como um meio círculo.
  const preenchimento = nome === 'auto'
    ? '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'
    : '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${CAMINHOS[nome]}"/>${preenchimento}</svg>`;
}
