// "Pergunte à Bússola": busca ao digitar (só a lista muda, o teclado não fecha) e a pergunta
// para a IA, que só sai quando a Carol toca em "Perguntar".

import { obterEstado, atualizarEstado } from './estado.js';
import { listar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { itensBuscaveis, contextoDaPergunta } from './dados-busca.js';
import { htmlResultados, htmlResposta, guardarPergunta } from './views-busca.js';
import { dataLocal } from './views-dia.js';

let paginas = []; // páginas de caderno (pesadas: só carregam quando a busca abre)
let carregadas = false;
let tempo = null;

export function dadosDaBusca(estado) {
  return { paginas, porId: new Map(itensBuscaveis(estado, { paginas }).map((i) => [i.id, i])) };
}

function atualizarResultados() {
  const el = document.getElementById('busca-resultados');
  if (el) el.innerHTML = htmlResultados(obterEstado(), obterEstado().buscaTermo || '', paginas);
}

function atualizarResposta() {
  const el = document.getElementById('busca-resposta');
  if (el) el.innerHTML = htmlResposta(obterEstado(), dadosDaBusca(obterEstado()).porId);
  const botao = document.querySelector('[data-form="busca"] [type="submit"]');
  if (botao) botao.disabled = Boolean(obterEstado().buscaPensando);
}

export function montarBusca() {
  if (!carregadas) {
    listar('paginas').then((l) => { paginas = l; carregadas = true; atualizarResultados(); }).catch(() => {});
  }
  // No computador e no tablet com teclado o campo já vem pronto; no celular, o teclado só abre no toque.
  // (depois do quadro: a troca de tela foca o título primeiro)
  if (!matchMedia('(pointer: coarse)').matches) requestAnimationFrame(() => document.getElementById('busca-termo')?.focus());
}

async function perguntar(texto) {
  const pergunta = String(texto || '').trim();
  if (!pergunta) {
    document.getElementById('busca-termo')?.focus();
    return;
  }
  if (obterEstado().buscaPensando) return;
  // A lista acompanha o que foi perguntado (sem esperar a pausa da digitação).
  clearTimeout(tempo);
  atualizarEstado({ buscaTermo: pergunta });
  atualizarResultados();
  guardarPergunta(pergunta);
  document.getElementById('busca-termo')?.blur(); // no celular, o teclado sai e a resposta aparece
  if (!navigator.onLine) {
    atualizarEstado({ buscaResposta: { pergunta, erro: 'Sem internet agora: a IA não responde, mas a busca abaixo funciona.' } });
    atualizarResposta();
    return;
  }
  atualizarEstado({ buscaPensando: true });
  atualizarResposta();
  const contexto = contextoDaPergunta(obterEstado(), pergunta, { hoje: dataLocal(), paginas });
  const r = await chamar('perguntar', { contexto });
  atualizarEstado({ buscaPensando: false, buscaResposta: r.ok ? { pergunta, resposta: r.resposta, itens: r.itens } : { pergunta, erro: r.erro || 'A IA não respondeu agora.' } });
  atualizarResposta();
  document.getElementById('busca-resposta')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function mudancaBusca(alvo, tipo) {
  if (alvo.id !== 'busca-termo') return false;
  if (tipo !== 'input') return true;
  atualizarEstado({ buscaTermo: alvo.value });
  clearTimeout(tempo);
  tempo = setTimeout(atualizarResultados, 120);
  return true;
}

export function enviarBusca(form) {
  if (form.dataset.form !== 'busca') return false;
  perguntar(form.elements.termo.value);
  return true;
}

export function cliqueBusca(alvo) {
  if (alvo.dataset.acao !== 'busca-sugestao') return false;
  const campo = document.getElementById('busca-termo');
  if (campo) campo.value = alvo.dataset.texto;
  atualizarEstado({ buscaTermo: alvo.dataset.texto });
  atualizarResultados();
  perguntar(alvo.dataset.texto);
  return true;
}
