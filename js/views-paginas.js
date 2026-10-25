// Painel de páginas do editor de caderno: miniaturas, ordem, divisórias, lixeira e exportação.
// Só monta o HTML; quem age é o editor-caderno.js (atributos data-ed).

import { esc } from './utilidades.js';
import { nomeDoModelo } from './folhas.js';

function miniatura(p, i, { atual, total, secoes }) {
  const img = p.miniatura_url && /^data:image\//.test(p.miniatura_url)
    ? `<img src="${esc(p.miniatura_url)}" alt="" loading="lazy">`
    : '<span class="miniatura-vazia"></span>';
  return `
    <li class="miniatura" data-pagina="${esc(p.id)}">
      <button type="button" class="miniatura-ir${i === atual ? ' atual' : ''}" data-ed="ir-pagina" data-valor="${i}" aria-label="Abrir a página ${i + 1} (${esc(nomeDoModelo(p.modelo_folha))})"${i === atual ? ' aria-current="page"' : ''}>
        ${img}<span class="miniatura-num">${i + 1}</span>
      </button>
      <div class="miniatura-acoes">
        <button type="button" class="botao-icone" data-ed="pagina-subir" data-valor="${i}" aria-label="Subir a página ${i + 1}"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="botao-icone" data-ed="pagina-descer" data-valor="${i}" aria-label="Descer a página ${i + 1}"${i === total - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="botao-icone" data-ed="pagina-duplicar" data-valor="${i}" aria-label="Duplicar a página ${i + 1}" title="Duplicar">⧉</button>
        <button type="button" class="botao-icone" data-ed="pagina-excluir" data-valor="${i}" aria-label="Mandar a página ${i + 1} para a lixeira" title="Excluir">×</button>
      </div>
      ${secoes.length ? `<label class="visualmente-oculto" for="secao-p-${esc(p.id)}">Divisória da página ${i + 1}</label>
        <select id="secao-p-${esc(p.id)}" data-ed="pagina-secao" data-valor="${i}">
          <option value="">Sem divisória</option>${secoes.map((s) => `<option value="${esc(s.id)}"${s.id === p.secao_id ? ' selected' : ''}>${esc(s.titulo)}</option>`).join('')}
        </select>` : ''}
    </li>`;
}

export function renderPainelPaginas({ caderno, paginas, indice, secoes, lixeira = null }) {
  const usaSecoes = caderno.tipo === 'materia' || secoes.length > 0;
  const grupos = usaSecoes
    ? [...secoes.map((s) => ({ s, itens: paginas.map((p, i) => ({ p, i })).filter(({ p }) => p.secao_id === s.id) })),
      { s: null, itens: paginas.map((p, i) => ({ p, i })).filter(({ p }) => !p.secao_id || !secoes.some((s) => s.id === p.secao_id)) }]
      .filter((g) => g.s || g.itens.length)
    : [{ s: null, itens: paginas.map((p, i) => ({ p, i })) }];
  const ctx = { atual: indice, total: paginas.length, secoes };
  return `
    <div class="editor-painel-topo">
      <h2>Páginas <span class="selo">${paginas.length}</span></h2>
      <button type="button" class="botao-icone" data-ed="painel-fechar" aria-label="Fechar o painel de páginas">×</button>
    </div>
    <button type="button" class="botao botao-secundario botao-pequeno" data-ed="pagina-nova">+ Página depois da atual</button>
    ${grupos.map((g) => `
      ${usaSecoes ? `<h3>${esc(g.s ? g.s.titulo : 'Sem divisória')}</h3>` : ''}
      ${g.itens.length ? `<ol class="miniaturas">${g.itens.map(({ p, i }) => miniatura(p, i, ctx)).join('')}</ol>` : '<p class="campo-ajuda">Nenhuma página nesta divisória.</p>'}`).join('')}
    ${usaSecoes ? `
      <h3>Divisórias</h3>
      <ul class="lista-marcar">${secoes.map((s, i) => `
        <li class="secao-linha">
          <label class="visualmente-oculto" for="secao-nome-${esc(s.id)}">Nome da divisória ${i + 1}</label>
          <input id="secao-nome-${esc(s.id)}" type="text" maxlength="60" value="${esc(s.titulo)}" data-ed="secao-nome" data-valor="${esc(s.id)}">
          <button type="button" class="botao-icone botao-icone-p" data-ed="secao-subir" data-valor="${esc(s.id)}" aria-label="Subir ${esc(s.titulo)}"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="botao-icone botao-icone-p" data-ed="secao-excluir" data-valor="${esc(s.id)}" aria-label="Excluir a divisória ${esc(s.titulo)}">×</button>
        </li>`).join('')}</ul>
      <button type="button" class="botao botao-secundario botao-pequeno" data-ed="secao-nova">+ Divisória</button>` : ''}
    <h3>Exportar</h3>
    <div class="editor-exportar">
      <button type="button" class="botao botao-secundario botao-pequeno" data-ed="exportar" data-valor="png">Esta página em PNG</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-ed="exportar" data-valor="pdf-pagina">Esta página em PDF</button>
      <button type="button" class="botao botao-secundario botao-pequeno" data-ed="exportar" data-valor="pdf">Caderno inteiro em PDF</button>
    </div>
    <h3>Lixeira de páginas</h3>
    ${lixeira === null ? '<button type="button" class="botao botao-secundario botao-pequeno" data-ed="lixeira-abrir">Ver páginas excluídas</button>'
      : lixeira.length ? `<ul class="lista-simples">${lixeira.map((p) => `
        <li><span>${esc(nomeDoModelo(p.modelo_folha))}</span>
          <button type="button" class="botao botao-secundario botao-pequeno" data-ed="pagina-restaurar" data-valor="${esc(p.id)}">Restaurar</button></li>`).join('')}</ul>`
        : '<p class="campo-ajuda">Nenhuma página excluída.</p>'}`;
}

export function renderAbasSecoes(secoes, secaoAtual) {
  if (!secoes.length) return '';
  return secoes.map((s, i) => `
    <button type="button" class="secao-aba capa-${(Number(s.cor) || (i % 6) + 1)}" data-ed="ir-secao" data-valor="${esc(s.id)}" aria-pressed="${s.id === secaoAtual}">${esc(s.titulo)}</button>`).join('');
}
