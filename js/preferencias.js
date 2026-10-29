// Preferências deste aparelho que não são o tema: o tamanho do texto e o vidro (barras e folhas
// translúcidas; desligado fica tudo opaco, como com "reduzir transparência" no sistema).

const CHAVE_TEXTO = 'hub.texto';
const CHAVE_VIDRO = 'hub.vidro';

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

export const OPCOES_VIDRO = [
  { id: 'sim', rotulo: 'Ligado', descricao: 'barras e folhas translúcidas' },
  { id: 'nao', rotulo: 'Desligado', descricao: 'tudo opaco, gasta menos bateria' },
];

export function lerVidro() {
  try {
    return localStorage.getItem(CHAVE_VIDRO) === 'nao' ? 'nao' : 'sim';
  } catch {
    return 'sim';
  }
}

export function definirVidro(valor) {
  try {
    localStorage.setItem(CHAVE_VIDRO, valor);
  } catch {
    // vale só nesta sessão
  }
  document.documentElement.dataset.vidro = valor;
  document.querySelectorAll('[data-vidro-opcao]').forEach((botao) => {
    botao.setAttribute('aria-pressed', String(botao.dataset.vidroOpcao === valor));
  });
}
