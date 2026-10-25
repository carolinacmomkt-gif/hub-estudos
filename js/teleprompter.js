// Teleprompter: o roteiro em letra grande rolando sozinho, para gravar olhando a tela.
// Tocar pausa ou continua; dá para mudar a velocidade, o tamanho da letra e espelhar.

const CHAVE = 'hub.teleprompter';
let estado = null;

function lerPrefs() {
  try {
    return { velocidade: 40, letra: 44, espelhar: false, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
  } catch {
    return { velocidade: 40, letra: 44, espelhar: false };
  }
}

function guardarPrefs(p) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // vale só nesta sessão
  }
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function abrirTeleprompter(texto, titulo = '') {
  fecharTeleprompter();
  const prefs = lerPrefs();
  const tela = document.createElement('div');
  tela.className = 'teleprompter';
  tela.setAttribute('role', 'dialog');
  tela.setAttribute('aria-label', `Teleprompter${titulo ? `: ${titulo}` : ''}`);
  tela.innerHTML = `
    <div class="teleprompter-barra">
      <button type="button" class="botao botao-primario botao-pequeno" data-tp="tocar">Começar</button>
      <label>Velocidade <input type="range" min="10" max="120" step="5" value="${prefs.velocidade}" data-tp="velocidade"></label>
      <label>Letra <input type="range" min="24" max="96" step="2" value="${prefs.letra}" data-tp="letra"></label>
      <label class="campo-marcar"><input type="checkbox" data-tp="espelhar"${prefs.espelhar ? ' checked' : ''}><span>Espelhar</span></label>
      <button type="button" class="botao botao-secundario botao-pequeno" data-tp="inicio">Voltar ao início</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-tp="fechar">Fechar</button>
    </div>
    <div class="teleprompter-area" data-tp="area">
      <div class="teleprompter-texto${prefs.espelhar ? ' espelhado' : ''}" style="font-size: ${prefs.letra}px">${texto
        ? texto.split(/\n{2,}/).map((p) => `<p>${escapar(p).replace(/\n/g, '<br>')}</p>`).join('')
        : '<p>O roteiro ainda está vazio. Escreva os blocos e volte aqui.</p>'}</div>
    </div>
    <div class="teleprompter-guia" aria-hidden="true"></div>`;
  document.body.append(tela);
  document.body.classList.add('com-teleprompter');
  const area = tela.querySelector('[data-tp="area"]');
  estado = { tela, area, prefs, rodando: false, ultimo: 0, sobra: 0 };

  const passo = (agora) => {
    if (!estado?.rodando) return;
    const dt = estado.ultimo ? (agora - estado.ultimo) / 1000 : 0;
    estado.ultimo = agora;
    estado.sobra += dt * estado.prefs.velocidade;
    const inteiro = Math.floor(estado.sobra);
    if (inteiro) {
      area.scrollTop += inteiro;
      estado.sobra -= inteiro;
    }
    if (area.scrollTop + area.clientHeight >= area.scrollHeight - 1) alternar(false);
    else requestAnimationFrame(passo);
  };
  const alternar = (ligar = !estado.rodando) => {
    estado.rodando = ligar;
    estado.ultimo = 0;
    tela.querySelector('[data-tp="tocar"]').textContent = ligar ? 'Pausar' : 'Continuar';
    if (ligar) requestAnimationFrame(passo);
  };
  estado.alternar = alternar;

  tela.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-tp]');
    const acao = alvo?.dataset.tp;
    if (acao === 'tocar' || acao === 'area' || e.target.closest('.teleprompter-texto')) alternar();
    else if (acao === 'inicio') { area.scrollTop = 0; alternar(false); }
    else if (acao === 'fechar') fecharTeleprompter();
  });
  tela.addEventListener('input', (e) => {
    const acao = e.target.dataset.tp;
    if (acao === 'velocidade') estado.prefs.velocidade = Number(e.target.value);
    if (acao === 'letra') {
      estado.prefs.letra = Number(e.target.value);
      tela.querySelector('.teleprompter-texto').style.fontSize = `${estado.prefs.letra}px`;
    }
    if (acao === 'espelhar') {
      estado.prefs.espelhar = e.target.checked;
      tela.querySelector('.teleprompter-texto').classList.toggle('espelhado', e.target.checked);
    }
    guardarPrefs(estado.prefs);
  });
  estado.teclas = (e) => {
    if (e.key === 'Escape') fecharTeleprompter();
    if (e.key === ' ' && !/^(INPUT|BUTTON)$/.test(document.activeElement?.tagName)) { e.preventDefault(); alternar(); }
  };
  document.addEventListener('keydown', estado.teclas);
  tela.querySelector('[data-tp="tocar"]').focus();
}

export function fecharTeleprompter() {
  if (!estado) return;
  estado.rodando = false;
  document.removeEventListener('keydown', estado.teclas);
  estado.tela.remove();
  document.body.classList.remove('com-teleprompter');
  estado = null;
}
