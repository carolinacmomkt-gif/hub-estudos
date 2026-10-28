// Jeito de tablet (Galaxy Tab com S Pen): só vale quando o aparelho é um tablet.
// - marca o <body> com data-aparelho (o CSS usa para toques de 48px e a folha lateral em paisagem);
// - atalhos do ícone do app (segurar o ícone) abrem já no lugar certo;
// - passar a S Pen por cima de um botão de ícone mostra o nome dele;
// - teclado físico (capa com teclado): letras de atalho, "?" mostra a lista.

import { aparelhoDoInicio, blocosDoInicio, adicionarBloco } from './inicio-layout.js';
import { obterEstado } from './estado.js';
import { esc } from './utilidades.js';

const ehTablet = () => document.body.dataset.aparelho === 'tablet';

export function marcarAparelho() {
  const atualizar = () => { document.body.dataset.aparelho = aparelhoDoInicio(); };
  atualizar();
  window.addEventListener('resize', atualizar);
}

// Atalhos do ícone e do teclado: depois de desenhar a tela, vai até o ponto certo dela.
// O app pode redesenhar logo depois (os dados chegam do banco), então o alvo fica guardado por
// uns instantes e o foco volta para ele se o redesenho o trocar.
const ALVOS = {
  'inicio/planejar': '[data-bloco="meudia"] [data-acao="dia-planejar"], [data-bloco="meudia"] .meu-dia',
  'tarefas/nova': '#tarefa-rapida-geral',
  'financas/lancar': '#fin-rapido',
  'configuracoes/demandas': '#demandas-config',
};
let pendente = null;

function focarPendente() {
  if (!pendente) return;
  if (Date.now() > pendente.ate) { pendente = null; return; }
  const el = document.querySelector(pendente.seletor);
  if (!el && pendente.bloco && !pendente.reexibiu) {
    // O card foi tirado do Hoje neste aparelho: o atalho traz ele de volta (no topo).
    const bloco = blocosDoInicio(obterEstado()).blocos.find((b) => b.id === pendente.bloco);
    if (bloco && !bloco.visivel) { pendente.reexibiu = true; adicionarBloco(pendente.bloco); }
  }
  if (!el || el.contains(document.activeElement)) return;
  if (!el.matches('button, input, select, textarea, a[href]')) el.setAttribute('tabindex', '-1');
  if (!pendente.rolou) {
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    pendente.rolou = true;
  }
  el.focus({ preventScroll: true });
}

export function irAoPontoDaRota(rota, parametro) {
  const seletor = ALVOS[`${rota}/${parametro}`];
  if (seletor) pendente = { seletor, bloco: rota === 'inicio' ? 'meudia' : null, ate: Date.now() + 2500, rolou: false };
  requestAnimationFrame(focarPendente);
}

// Chamado depois de cada desenho da tela (também os que vêm de fora).
export function depoisDeDesenhar() {
  if (pendente) requestAnimationFrame(focarPendente);
}

// ---------------------------------------------------------------------------
// Dica da S Pen: o nome do botão aparece ao passar a caneta por cima (sem encostar)
// ---------------------------------------------------------------------------

let dica = null;
let alvoDaDica = null;

function nomeDoBotao(el) {
  const texto = el.textContent.replace(/\s+/g, ' ').trim();
  const nome = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  // Só para botões sem texto visível (ícones) ou com texto bem curto (‹ › + ×).
  return nome && texto.length <= 2 ? nome : '';
}

function mostrarDica(el, nome) {
  if (!dica) {
    dica = document.createElement('div');
    dica.className = 'dica-caneta';
    dica.setAttribute('role', 'tooltip');
    document.body.append(dica);
  }
  dica.textContent = nome;
  const r = el.getBoundingClientRect();
  dica.hidden = false;
  const larg = dica.offsetWidth;
  dica.style.left = `${Math.max(8, Math.min(innerWidth - larg - 8, r.left + r.width / 2 - larg / 2))}px`;
  dica.style.top = `${r.top > 48 ? r.top - 40 : r.bottom + 8}px`;
  alvoDaDica = el;
}

function esconderDica() {
  if (dica) dica.hidden = true;
  alvoDaDica = null;
}

function ligarDicaDaCaneta() {
  document.addEventListener('pointermove', (e) => {
    if (!ehTablet() || e.pointerType !== 'pen' || e.buttons !== 0) return;
    const el = e.target.closest?.('button, a, [role="button"]');
    if (el === alvoDaDica) return;
    const nome = el ? nomeDoBotao(el) : '';
    if (nome) mostrarDica(el, nome);
    else esconderDica();
  }, { passive: true });
  for (const t of ['pointerdown', 'scroll', 'hashchange', 'pointerleave']) window.addEventListener(t, esconderDica, { passive: true, capture: true });
}

// ---------------------------------------------------------------------------
// Teclado físico
// ---------------------------------------------------------------------------

export const ATALHOS_TECLADO = [
  { tecla: 'h', nome: 'Hoje', hash: '#inicio' },
  { tecla: 'p', nome: 'Planejar meu dia', hash: '#inicio/planejar' },
  { tecla: 't', nome: 'Tarefas', hash: '#tarefas' },
  { tecla: 'n', nome: 'Nova tarefa', hash: '#tarefas/nova' },
  { tecla: 'c', nome: 'Calendário', hash: '#calendario' },
  { tecla: 'f', nome: 'Finanças', hash: '#financas' },
  { tecla: 'l', nome: 'Lançar um gasto', hash: '#financas/lancar' },
  { tecla: 'k', nome: 'Cadernos', hash: '#cadernos' },
  { tecla: 'm', nome: 'Metas e lazer', hash: '#metas' },
  { tecla: '/', nome: 'Buscar nesta tela' },
  { tecla: '?', nome: 'Ver estes atalhos' },
];

function digitando(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function mostrarAtalhos() {
  document.getElementById('folha-evento-titulo').textContent = 'Atalhos do teclado';
  document.getElementById('folha-evento-conteudo').innerHTML = `
    <ul class="lista-simples atalhos-teclado">${ATALHOS_TECLADO.map((a) => `<li><span>${esc(a.nome)}</span><kbd>${esc(a.tecla.toUpperCase())}</kbd></li>`).join('')}</ul>
    <p class="campo-ajuda">Os atalhos funcionam com o teclado da capa (ou outro teclado) quando você não está digitando num campo.</p>`;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}

function ligarTeclado() {
  document.addEventListener('keydown', (e) => {
    if (!ehTablet() || e.ctrlKey || e.metaKey || e.altKey || digitando(document.activeElement)) return;
    if (document.querySelector('dialog[open]') && e.key !== 'Escape') return;
    if (document.body.classList.contains('modo-editor')) return; // no caderno à mão, as teclas são do editor
    if (e.key === '?') {
      e.preventDefault();
      mostrarAtalhos();
      return;
    }
    if (e.key === '/') {
      const busca = document.querySelector('#conteudo input[type="search"], #conteudo input[name="busca"], #conteudo [id$="busca"]');
      if (busca) {
        e.preventDefault();
        busca.focus();
      }
      return;
    }
    const atalho = ATALHOS_TECLADO.find((a) => a.hash && a.tecla === e.key.toLowerCase());
    if (!atalho) return;
    e.preventDefault();
    if (location.hash === atalho.hash) {
      const [rota, parametro] = atalho.hash.slice(1).split('/');
      irAoPontoDaRota(rota, parametro);
    } else location.hash = atalho.hash;
  });
}

export function ligarTablet() {
  marcarAparelho();
  // Tocou ou digitou em outro lugar: o atalho não puxa mais o foco.
  for (const t of ['pointerdown', 'input']) document.addEventListener(t, () => { pendente = null; }, { capture: true, passive: true });
  ligarDicaDaCaneta();
  ligarTeclado();
}
