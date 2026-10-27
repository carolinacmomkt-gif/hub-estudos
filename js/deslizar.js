// Deslizar o dedo num item da lista (como no Todoist e no Things): para a direita faz uma coisa,
// para a esquerda outra. Vale só para toque; no mouse e na caneta os botões continuam.
// Uso: <li data-deslizar="tarefa" data-id="..."> e registrarDeslize('tarefa', { direita, esquerda }).

const tipos = new Map(); // tipo → { direita: { rotulo, fn }, esquerda: { rotulo, fn } }
let gesto = null;
let semCliqueAte = 0; // logo depois de um deslize, o toque não vira clique no item

export function registrarDeslize(tipo, acoes) {
  tipos.set(tipo, acoes);
}

function voltar(el) {
  el.classList.add('voltando');
  el.style.setProperty('--dx', '0px');
  delete el.dataset.lado;
  setTimeout(() => el.classList.remove('voltando', 'deslizando', 'passou-do-ponto'), 220);
}

function aoApertar(e) {
  if (e.pointerType !== 'touch' || gesto) return;
  const el = e.target.closest('[data-deslizar]');
  if (!el || el.closest('[inert]')) return;
  gesto = { el, id: el.dataset.id, tipo: el.dataset.deslizar, x0: e.clientX, y0: e.clientY, ponteiro: e.pointerId, modo: null, dx: 0 };
}

function aoMover(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  const dx = e.clientX - gesto.x0;
  const dy = e.clientY - gesto.y0;
  if (!gesto.modo) {
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gesto.modo = 'lado';
      gesto.el.classList.add('deslizando');
      try {
        gesto.el.setPointerCapture(e.pointerId);
      } catch {
        // segue sem captura
      }
    } else if (Math.abs(dy) > 10) {
      gesto = null; // é rolagem
      return;
    } else return;
  }
  e.preventDefault();
  const acoes = tipos.get(gesto.tipo) || {};
  const lado = dx > 0 ? 'direita' : 'esquerda';
  // Sem ação para esse lado: o item mal se mexe (sinal de que não dá).
  const livre = acoes[lado] ? dx : dx * 0.15;
  gesto.dx = livre;
  gesto.el.style.setProperty('--dx', `${Math.round(livre)}px`);
  gesto.el.dataset.lado = lado;
  const ponto = Math.min(120, gesto.el.offsetWidth * 0.3);
  gesto.el.classList.toggle('passou-do-ponto', Boolean(acoes[lado]) && Math.abs(livre) >= ponto);
}

function aoSoltar(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  const g = gesto;
  gesto = null;
  if (g.modo !== 'lado') return;
  semCliqueAte = Date.now() + 400;
  const acoes = tipos.get(g.tipo) || {};
  const lado = g.dx > 0 ? 'direita' : 'esquerda';
  const ponto = Math.min(120, g.el.offsetWidth * 0.3);
  if (acoes[lado] && Math.abs(g.dx) >= ponto) {
    g.el.classList.add('voltando');
    g.el.style.setProperty('--dx', `${lado === 'direita' ? g.el.offsetWidth : -g.el.offsetWidth}px`);
    navigator.vibrate?.(12);
    setTimeout(() => acoes[lado].fn(g.id, g.el), 180);
  } else voltar(g.el);
}

function aoCancelar(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  const g = gesto;
  gesto = null;
  if (g.modo === 'lado') voltar(g.el);
}

let ligado = false;
export function ligarDeslizar() {
  if (ligado) return;
  ligado = true;
  document.addEventListener('pointerdown', aoApertar, { passive: true });
  document.addEventListener('pointermove', aoMover, { passive: false });
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', aoCancelar);
  document.addEventListener('click', (ev) => {
    if (Date.now() < semCliqueAte && ev.target.closest?.('[data-deslizar]')) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }, { capture: true });
}
