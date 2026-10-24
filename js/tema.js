// Tema claro / escuro / automático, com a escolha salva no aparelho.

const CHAVE = 'hub.tema';
const PADRAO = 'escuro';
const consultaClaro = window.matchMedia('(prefers-color-scheme: light)');

export const OPCOES_TEMA = [
  { id: 'claro', rotulo: 'Claro', descricao: 'Fundo creme' },
  { id: 'escuro', rotulo: 'Escuro', descricao: 'Padrão da Central' },
  { id: 'auto', rotulo: 'Automático', descricao: 'Segue o aparelho' },
];

export function lerPreferenciaTema() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return OPCOES_TEMA.some((o) => o.id === salvo) ? salvo : PADRAO;
  } catch {
    return PADRAO;
  }
}

function aplicarTema(preferencia) {
  const claro = preferencia === 'claro' || (preferencia === 'auto' && consultaClaro.matches);
  const raiz = document.documentElement;
  raiz.dataset.tema = claro ? 'claro' : 'escuro';

  // A barra do navegador/app instalado acompanha o fundo do tema.
  const cor = getComputedStyle(raiz).getPropertyValue('--cor-fundo').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);

  document.querySelectorAll('[data-tema-opcao]').forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.temaOpcao === preferencia));
  });
}

export function definirTema(preferencia) {
  try {
    localStorage.setItem(CHAVE, preferencia);
  } catch {
    // Sem armazenamento (aba privada): o tema vale só nesta sessão.
  }
  aplicarTema(preferencia);
}

export function atualizarBotoesTema() {
  aplicarTema(lerPreferenciaTema());
}

export function iniciarTema() {
  aplicarTema(lerPreferenciaTema());
  consultaClaro.addEventListener('change', () => {
    if (lerPreferenciaTema() === 'auto') aplicarTema('auto');
  });
}
