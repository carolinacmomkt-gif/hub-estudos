// Cliques e formulários do modo "Personalizar o Hoje".

import { obterEstado, atualizarEstado } from './estado.js';
import {
  moverBloco, mudarTamanho, adicionarProprio, editarProprio, removerProprio, marcarItem, voltarAoPadrao,
  blocosDoInicio, TIPOS_PROPRIOS, colocarBloco, redimensionar, removerBloco, adicionarBloco, ALTURA_MIN, ALTURA_MAX,
} from './inicio-layout.js';
import { renderFormProprio, lerFormProprio } from './views-inicio-proprios.js';
import { confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }

export function ligarInicio(funcoes) {
  app = funcoes;
  document.addEventListener('pointerdown', aoApertar);
  document.addEventListener('pointermove', aoMover, { passive: false });
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', aoCancelar);
}

// ---------------------------------------------------------------------------
// Arrastar (alça ⠿) e redimensionar (canto de baixo, à direita)
// ---------------------------------------------------------------------------

const COLUNAS = { '1/3': 4, metade: 6, '2/3': 8, inteiro: 12 };
let gesto = null;
let ultimoToqueCanto = { id: null, tempo: 0 };

function limparAlvos() {
  document.querySelectorAll('.bloco.alvo-antes, .bloco.alvo-depois').forEach((b) => b.classList.remove('alvo-antes', 'alvo-depois'));
}

function aoApertar(e) {
  if (!obterEstado().editandoInicio || e.button > 0) return;
  const alca = e.target.closest('[data-arrastar]');
  const canto = e.target.closest('[data-redimensionar]');
  if (!alca && !canto) return;
  const el = (alca || canto).closest('.bloco');
  if (!el) return;
  // No celular, com o dedo, só o ⠿ arrasta: deslizar no nome rola a página.
  if (alca && e.pointerType === 'touch' && window.matchMedia('(max-width: 700px)').matches && !e.target.closest('.bloco-alca-pontos')) return;
  e.preventDefault();
  try {
    (alca || canto).setPointerCapture(e.pointerId);
  } catch {
    // segue sem captura
  }
  const r = el.getBoundingClientRect();
  if (canto) {
    const id = canto.dataset.redimensionar;
    // Toque duplo no canto: a altura volta ao automático.
    if (ultimoToqueCanto.id === id && e.timeStamp - ultimoToqueCanto.tempo < 350) {
      ultimoToqueCanto = { id: null, tempo: 0 };
      redimensionar(id, el.dataset.tamanho, null).then(() => redesenhar());
      return;
    }
    ultimoToqueCanto = { id, tempo: e.timeStamp };
  }
  gesto = {
    tipo: alca ? 'arrastar' : 'redimensionar',
    id: el.dataset.bloco,
    el,
    ponteiro: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    largura0: r.width,
    altura0: r.height,
    painel: el.parentElement.getBoundingClientRect().width,
    tamanho: el.dataset.tamanho,
    altura: null,
    moveu: false,
    rolagem0: window.scrollY,
    x: e.clientX,
    y: e.clientY,
  };
  if (alca) rolarNaBorda();
  el.classList.add(alca ? 'arrastando' : 'redimensionando');
}

// Perto da borda de cima ou de baixo, a página rola sozinha enquanto o card estiver seguro.
function rolarNaBorda() {
  if (!gesto || gesto.tipo !== 'arrastar') return;
  const margem = 80;
  const passo = gesto.y < margem ? -12 : gesto.y > window.innerHeight - margem ? 12 : 0;
  if (passo) {
    window.scrollBy(0, passo);
    posicionarArraste();
  }
  requestAnimationFrame(rolarNaBorda);
}

function posicionarArraste() {
  const g = gesto;
  const dx = g.x - g.x0;
  const dy = g.y - g.y0 + (window.scrollY - g.rolagem0);
  g.el.style.transform = `translate(${dx}px, ${dy}px)`;
  limparAlvos();
  g.alvo = null;
  g.el.style.pointerEvents = 'none';
  const debaixo = document.elementFromPoint(g.x, g.y)?.closest('.bloco');
  g.el.style.pointerEvents = '';
  if (debaixo && debaixo !== g.el) {
    const r = debaixo.getBoundingClientRect();
    // Card estreito (na mesma linha de outro): decide pela metade horizontal; largo: pela vertical.
    const depois = r.width < g.painel * 0.9 ? g.x > r.left + r.width / 2 : g.y > r.top + r.height / 2;
    debaixo.classList.add(depois ? 'alvo-depois' : 'alvo-antes');
    g.alvo = { id: debaixo.dataset.bloco, depois };
  }
}

function aoMover(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  e.preventDefault();
  gesto.x = e.clientX;
  gesto.y = e.clientY;
  const dx = e.clientX - gesto.x0;
  const dy = e.clientY - gesto.y0;
  if (Math.abs(dx) + Math.abs(dy) > 4) gesto.moveu = true;

  if (gesto.tipo === 'arrastar') {
    posicionarArraste();
    return;
  }

  // Redimensionar: a largura encaixa em 1/3, metade, 2/3 ou inteiro; a altura é livre (de 20 em 20 px).
  const fracao = ((gesto.largura0 + dx) / gesto.painel) * 12;
  let melhor = gesto.tamanho;
  let menor = Infinity;
  for (const [tam, cols] of Object.entries(COLUNAS)) {
    if (Math.abs(cols - fracao) < menor) {
      menor = Math.abs(cols - fracao);
      melhor = tam;
    }
  }
  if (melhor !== gesto.tamanho) {
    gesto.el.classList.remove(`tam-${gesto.tamanho.replace('/', '-')}`);
    gesto.el.classList.add(`tam-${melhor.replace('/', '-')}`);
    gesto.tamanho = melhor;
  }
  if (Math.abs(dy) > 6) {
    gesto.altura = Math.round(Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, gesto.altura0 + dy)) / 20) * 20;
    gesto.el.classList.add('com-altura');
    gesto.el.style.setProperty('--altura', `${gesto.altura}px`);
  }
}

function aoSoltar(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  const g = gesto;
  gesto = null;
  g.el.classList.remove('arrastando', 'redimensionando');
  g.el.style.transform = '';
  limparAlvos();
  if (!g.moveu) return;
  if (g.tipo === 'arrastar') {
    if (g.alvo) colocarBloco(g.id, g.alvo.id, g.alvo.depois).then(() => redesenhar());
    return;
  }
  redimensionar(g.id, g.tamanho, g.altura ?? undefined).then(() => redesenhar());
}

function aoCancelar(e) {
  if (!gesto || e.pointerId !== gesto.ponteiro) return;
  gesto.el.classList.remove('arrastando', 'redimensionando');
  gesto.el.style.transform = '';
  gesto = null;
  limparAlvos();
}

// Redesenha e devolve o foco ao mesmo controle (as setas continuam na mão).
function redesenhar(seletor) {
  app.renderizar();
  if (seletor) document.querySelector(seletor)?.focus({ preventScroll: false });
}

function abrirFormulario(tipo, id = '') {
  const card = id ? blocosDoInicio(obterEstado()).proprios[id] : {};
  const nome = TIPOS_PROPRIOS.find((t) => t.id === tipo)?.nome || 'Card';
  document.getElementById('folha-evento-titulo').textContent = id ? `Editar: ${card?.titulo || nome}` : `Novo card: ${nome}`;
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormProprio(tipo, card || {}, id);
  document.getElementById('folha-evento').showModal();
}

export function cliqueInicio(alvo) {
  const id = alvo.dataset.id;
  switch (alvo.dataset.acao) {
    case 'inicio-personalizar':
      atualizarEstado({ editandoInicio: true });
      redesenhar('[data-acao="inicio-pronto"]');
      return true;
    case 'inicio-pronto':
      atualizarEstado({ editandoInicio: false });
      redesenhar();
      app.avisoCurto('Hoje salvo. Vale para todos os seus aparelhos.');
      return true;
    case 'inicio-mover': {
      const passo = alvo.dataset.passo;
      moverBloco(id, Number(passo)).then(() => redesenhar(`[data-acao="inicio-mover"][data-id="${id}"][data-passo="${passo}"]:not([disabled])`));
      return true;
    }
    case 'inicio-remover-bloco':
      removerBloco(id).then(() => {
        redesenhar();
        app.avisoCurto('Card tirado do Hoje. Para pôr de volta, use "Adicionar ao Hoje".');
      });
      return true;
    case 'inicio-adicionar':
      adicionarBloco(id).then(() => {
        redesenhar();
        window.scrollTo({ top: document.querySelector('.painel')?.offsetTop - 20 || 0, behavior: 'smooth' });
        app.avisoCurto('Card adicionado no topo. Arraste para onde quiser.');
      });
      return true;
    case 'inicio-novo':
      abrirFormulario(alvo.dataset.tipo);
      return true;
    case 'inicio-editar': {
      const card = blocosDoInicio(obterEstado()).proprios[id];
      if (card) abrirFormulario(card.tipo, id);
      return true;
    }
    case 'inicio-remover':
      confirmar('Excluir este card de vez? O conteúdo dele se perde.').then((ok) => ok && removerProprio(id).then(() => {
        document.getElementById('folha-evento')?.close();
        redesenhar();
      }));
      return true;
    case 'inicio-padrao':
      confirmar('Voltar o Hoje ao padrão? Seus cards próprios ficam guardados, só que ocultos.').then((ok) => ok && voltarAoPadrao().then(() => redesenhar()));
      return true;
    case 'inicio-marcar':
      marcarItem(id, Number(alvo.dataset.indice)).then(() => redesenhar());
      return true;
    default:
      return false;
  }
}

export function mudancaInicio(alvo) {
  if (alvo.dataset.acaoMudar !== 'inicio-tamanho') return false;
  const id = alvo.dataset.id;
  mudarTamanho(id, alvo.value).then(() => redesenhar(`#tam-${CSS.escape(id)}`));
  return true;
}

export function enviarInicio(form) {
  if (form.dataset.form !== 'inicio-proprio') return false;
  const { dados, erro } = lerFormProprio(form);
  const caixa = form.querySelector('[data-erro]');
  if (erro) {
    caixa.textContent = erro;
    caixa.hidden = false;
    return true;
  }
  const id = form.dataset.id;
  (id ? editarProprio(id, dados) : adicionarProprio(form.dataset.tipo, dados)).then(() => {
    document.getElementById('folha-evento').close();
    redesenhar();
    app.avisoCurto(id ? 'Card atualizado.' : 'Card adicionado no topo do Hoje.');
  });
  return true;
}
