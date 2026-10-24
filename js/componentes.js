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

// titulo: texto simples; subtitulo: HTML já escapado.
export function cabecalho(titulo, subtitulo = '') {
  return `
    <header class="cabecalho">
      <div>
        <h1 tabindex="-1">${esc(titulo)}</h1>
        ${subtitulo ? `<p class="cabecalho-sub">${subtitulo}</p>` : ''}
      </div>
      ${seletorTema()}
    </header>`;
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

export function emConstrucao({ icone: nomeIcone, titulo, texto, itens = [], etapa, acao }) {
  return `
    <section class="card vazio">
      <div class="vazio-icone">${icone(nomeIcone)}</div>
      <h2>${esc(titulo)}</h2>
      <p class="texto-suave">${esc(texto)}</p>
      ${itens.length ? `<ul class="vazio-lista">${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${etapa ? `<span class="selo">Chega na etapa ${esc(etapa)}</span>` : ''}
      ${acao ? `<a class="botao botao-primario" href="${esc(acao.href)}">${esc(acao.rotulo)}</a>` : ''}
    </section>`;
}
