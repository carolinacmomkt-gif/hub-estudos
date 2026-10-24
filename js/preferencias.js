// Preferências deste aparelho que não são o tema: por enquanto, o tamanho do texto.

const CHAVE_TEXTO = 'hub.texto';

export const OPCOES_TEXTO = [
  { id: 'normal', rotulo: 'Normal' },
  { id: 'grande', rotulo: 'Grande' },
  { id: 'maior', rotulo: 'Maior' },
];

export function lerTamanhoTexto() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEXTO);
    return OPCOES_TEXTO.some((o) => o.id === salvo) ? salvo : 'normal';
  } catch {
    return 'normal';
  }
}

export function definirTamanhoTexto(tamanho) {
  try {
    localStorage.setItem(CHAVE_TEXTO, tamanho);
  } catch {
    // vale só nesta sessão
  }
  document.documentElement.dataset.texto = tamanho;
  document.querySelectorAll('[data-texto-opcao]').forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.textoOpcao === tamanho));
  });
}
