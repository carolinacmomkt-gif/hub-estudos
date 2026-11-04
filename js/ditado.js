// Ditado por voz para qualquer campo: o microfone do navegador (quando existe). Sem ele, o
// microfone do teclado continua valendo. Uso: botaoDitado('#id-do-campo') e o clique "ditar".

let ouvindo = null;
let avisar = () => {};

export const temDitado = () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export function botaoDitado(alvo, rotulo = 'Falar') {
  if (!temDitado()) return '';
  return `<button class="botao botao-secundario botao-pequeno ditado" type="button" data-acao="ditar" data-alvo="${alvo}" aria-pressed="false" aria-label="${rotulo} em vez de escrever">🎙️ ${rotulo}</button>`;
}

export function pararDitado() {
  ouvindo?.stop();
}

function ditar(botao) {
  const Reconhecer = window.SpeechRecognition || window.webkitSpeechRecognition;
  const campo = document.querySelector(botao.dataset.alvo);
  if (!Reconhecer || !campo) return;
  if (ouvindo) {
    ouvindo.stop();
    return;
  }
  const rotulo = botao.textContent;
  const rec = new Reconhecer();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  const antes = campo.value.trim();
  let final = '';
  rec.onresult = (e) => {
    let agora = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      if (e.results[i].isFinal) final += `${e.results[i][0].transcript} `;
      else agora += e.results[i][0].transcript;
    }
    campo.value = [antes, `${final}${agora}`.trim()].filter(Boolean).join(campo.tagName === 'TEXTAREA' && antes ? '\n' : ' ');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') avisar('Libere o microfone para a Bússola nas configurações do aparelho, ou use o microfone do teclado.');
    else if (e.error === 'network') avisar('O ditado precisa de internet. Use o microfone do teclado.');
  };
  rec.onend = () => {
    ouvindo = null;
    botao.setAttribute('aria-pressed', 'false');
    botao.textContent = rotulo;
    botao.classList.remove('ouvindo');
  };
  try {
    rec.start();
  } catch {
    return;
  }
  ouvindo = rec;
  botao.setAttribute('aria-pressed', 'true');
  botao.textContent = '■ Parar';
  botao.classList.add('ouvindo');
}

export function ligarDitado(funcoes) {
  avisar = funcoes?.avisoCurto || avisar;
}

export function cliqueDitado(alvo) {
  if (alvo.dataset.acao !== 'ditar') return false;
  ditar(alvo);
  return true;
}
