// Pedaços de interface repetidos em várias telas.

import { icone } from './icones.js';
import { OPCOES_TEMA, lerPreferenciaTema } from './tema.js';
import { esc } from './utilidades.js';

export function seletorTema() {
  const atual = lerPreferenciaTema();
  const botoes = OPCOES_TEMA.map((opcao) => `
    <button type="button" data-tema-opcao="${opcao.id}" aria-pressed="${opcao.id === atual}"
      aria-label="Tema ${opcao.rotulo.toLowerCase()}" title="Tema ${opcao.rotulo.toLowerCase()}">
      ${icone(opcao.id)}
    </button>`).join('');
  return `<div class="seletor-tema" role="group" aria-label="Tema">${botoes}</div>`;
}

// titulo: texto simples; subtitulo: HTML já escapado; acao: HTML do botão principal da tela, que
// fica no topo ao lado da lupa (decisão da Carol, 03/11/2026, como no iPhone e no Android). O tema
// (claro, escuro, automático) saiu do topo: fica em Configurações → Geral.
export function cabecalho(titulo, subtitulo = '', acao = '') {
  return `
    <header class="cabecalho">
      <div>
        <h1 tabindex="-1">${esc(titulo)}</h1>
        ${subtitulo ? `<p class="cabecalho-sub">${subtitulo}</p>` : ''}
      </div>
      ${acao ? `<div class="cabecalho-principal">${acao}</div>` : ''}
      <div class="cabecalho-acoes">
        ${location.hash.startsWith('#buscar') ? '' : `<a class="cabecalho-busca" href="#buscar" aria-label="Pergunte à Bússola: buscar ou perguntar" title="Buscar">${icone('buscar')}</a>`}
      </div>
    </header>`;
}

// Fileira de números do topo das telas (design de 18/11/2026): cada um com o valor grande,
// o que ele conta e, se tiver, a barra e o link para a tela. Itens vazios ficam de fora.
export function numeros(itens, rotulo = 'Resumo em números') {
  const lista = itens.filter(Boolean);
  if (!lista.length) return '';
  return `<div class="numeros" role="list" aria-label="${esc(rotulo)}" style="--n: ${lista.length}">${lista.map((n) => {
    const pct = n.fracao == null ? null : Math.round(Math.min(1, Math.max(0, n.fracao)) * 100);
    const tag = n.href ? 'a' : 'div';
    return `<${tag} class="numero${n.tom ? ` numero-${esc(n.tom)}` : ''}" role="listitem"${n.href ? ` href="${esc(n.href)}"` : ''}>
      <strong class="numero-valor">${esc(n.valor)}</strong>
      <span class="numero-rotulo">${esc(n.rotulo)}</span>
      ${pct == null ? '' : `<span class="numero-barra" aria-hidden="true"><i style="width:${pct}%"></i></span>`}
    </${tag}>`;
  }).join('')}</div>`;
}

export function barraProgresso(fracao, rotulo) {
  const pct = Math.round(Math.min(1, Math.max(0, fracao)) * 100);
  return `
    <div class="progresso">
      <div class="progresso-trilho" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${pct}" aria-label="${esc(rotulo)}">
        <div class="progresso-barra" style="width: ${pct}%"></div>
      </div>
      <span class="progresso-valor">${pct}%</span>
    </div>`;
}
