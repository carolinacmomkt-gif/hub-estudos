// Tela do leitor de livros (#livro/<id>): o esqueleto. Quem preenche (página, sumário, ajustes,
// marcadores, destaques, busca e a IA) é js/leitor-livro.js.

import { esc } from './utilidades.js';
import { artigoPeloId } from './dados-biblioteca.js';
import { formatoDoLivro, FONTES_LEITOR, TEMAS_LEITOR, MARGENS_LEITOR, CORES_TINTA_LIVRO } from './dados-livros.js';
import { CORES_DESTAQUE } from './dados-biblioteca.js';

const botao = (acao, rotulo, simbolo, extra = '') => `<button class="lv-botao" type="button" data-leitor="${acao}" aria-label="${esc(rotulo)}" title="${esc(rotulo)}"${extra}>${simbolo}</button>`;

export function renderLivro(estado) {
  const a = artigoPeloId(estado, estado.parametro);
  if (!a || !a.pdf_path) {
    return `<section class="card"><p class="texto-suave" role="status">Procurando o livro… Se ele acabou de ser guardado em outro aparelho, aparece aqui assim que sincronizar. Se foi para a lixeira, ele não abre mais.</p>
      <a class="botao botao-secundario" href="#biblioteca">Voltar para a Biblioteca</a></section>`;
  }
  const pdf = formatoDoLivro(a) === 'pdf';
  return `
    <section class="lv${pdf ? ' lv-pdf-modo' : ''}" id="lv" aria-label="Leitor: ${esc(a.titulo)}">
      <header class="lv-topo">
        <a class="lv-botao" href="#biblioteca" aria-label="Voltar para a Biblioteca" title="Voltar">‹</a>
        <div class="lv-titulo"><strong>${esc(a.titulo)}</strong><small id="lv-onde"></small></div>
        ${botao('painel-sumario', 'Sumário', '☰')}
        ${botao('painel-busca', 'Buscar no livro', '⌕')}
        ${botao('painel-ajustes', 'Ajustes de leitura', 'Aa')}
        ${pdf ? botao('caneta', 'Rabiscar com a caneta', '✎', ' aria-pressed="false"') : ''}
        ${botao('marcador', 'Marcar esta página', '🔖', ' aria-pressed="false"')}
        ${botao('painel-mais', 'Marcadores, destaques e IA', '⋯')}
      </header>
      <div class="lv-palco" id="lv-palco">
        ${pdf
          ? '<div class="lv-pdf" id="lv-pdf"></div>'
          : '<div class="lv-janela" id="lv-janela"><div class="lv-texto" id="lv-livro-texto" lang="pt"></div></div>'}
        <p class="lv-carregando" id="lv-carregando" role="status">Abrindo o livro…</p>
        <div class="lv-brilho" id="lv-brilho" aria-hidden="true"></div>
      </div>
      ${pdf ? barraCaneta() : ''}
      <footer class="lv-base">
        ${botao('anterior', 'Página anterior', '‹')}
        <div class="lv-progresso">
          <label class="visualmente-oculto" for="lv-barra">Onde você está no livro</label>
          <input id="lv-barra" type="range" min="0" max="1000" value="0" data-leitor-barra>
          <small id="lv-tempo" aria-live="polite"></small>
        </div>
        ${botao('proxima', 'Próxima página', '›')}
      </footer>
      <aside class="lv-painel" id="lv-painel" hidden aria-labelledby="lv-painel-titulo">
        <div class="lv-painel-topo"><h2 id="lv-painel-titulo"></h2>${botao('fechar-painel', 'Fechar', '×')}</div>
        <div class="lv-painel-corpo" id="lv-painel-corpo"></div>
      </aside>
      <div class="lv-menu" id="lv-menu" role="toolbar" aria-label="Trecho selecionado" hidden>
        ${CORES_DESTAQUE.map((c) => `<button class="lv-cor destaque-${c.id}" type="button" data-leitor="destacar" data-cor="${c.id}" aria-label="Destacar em ${esc(c.nome.toLowerCase())}"></button>`).join('')}
        <button class="lv-menu-botao" type="button" data-leitor="nota-selecao">Nota</button>
        <button class="lv-menu-botao" type="button" data-leitor="copiar">Copiar</button>
        <button class="lv-menu-botao" type="button" data-leitor="explicar">Explicar</button>
        <button class="lv-menu-botao" type="button" data-leitor="tirar-destaque" hidden>Tirar</button>
      </div>
    </section>`;
}

function barraCaneta() {
  return `
    <div class="lv-caneta" id="lv-caneta" role="toolbar" aria-label="Caneta" hidden>
      <button class="lv-ferramenta" type="button" data-leitor="ferramenta" data-ferramenta="tinteiro" aria-pressed="true">Caneta</button>
      <button class="lv-ferramenta" type="button" data-leitor="ferramenta" data-ferramenta="marca-texto" aria-pressed="false">Marca-texto</button>
      <button class="lv-ferramenta" type="button" data-leitor="ferramenta" data-ferramenta="borracha" aria-pressed="false">Borracha</button>
      <span class="lv-cores">${CORES_TINTA_LIVRO.map((c, i) => `<button class="lv-tinta" type="button" data-leitor="tinta" data-tinta="${c.id}" style="--tinta: var(${c.variavel})" aria-label="${esc(c.nome)}" aria-pressed="${i === 0}"></button>`).join('')}</span>
      ${botao('desfazer', 'Desfazer', '↶')}
      ${botao('refazer', 'Refazer', '↷')}
      <label class="campo-marcar lv-dedo"><input type="checkbox" data-leitor-dedo><span>Dedo</span></label>
      <button class="botao botao-primario botao-pequeno" type="button" data-leitor="caneta">Pronto</button>
    </div>`;
}

// Painel de ajustes (EPUB e PDF).
export function painelAjustes(prefs, pdf, zoom = 1, ajuste = 'pagina') {
  const escolha = (campo, lista, atual) => `<div class="segmentado lv-escolha" role="group">${lista.map((x) => `<button type="button" data-leitor="pref" data-campo="${campo}" data-valor="${x.id}" aria-pressed="${String(atual) === String(x.id)}">${esc(x.nome)}</button>`).join('')}</div>`;
  const temas = [{ id: 'auto', nome: 'Como o app' }, ...TEMAS_LEITOR];
  if (pdf) {
    return `
      <p class="lv-rotulo">Tamanho</p>
      <div class="segmentado lv-escolha" role="group" aria-label="Encaixe da página">
        <button type="button" data-leitor="ajuste-pdf" data-valor="pagina" aria-pressed="${ajuste !== 'largura'}">Página inteira</button>
        <button type="button" data-leitor="ajuste-pdf" data-valor="largura" aria-pressed="${ajuste === 'largura'}">Largura</button>
      </div>
      <div class="lv-linha">${botaoPequeno('zoom', '-1', 'Diminuir', 'A−')}<span class="lv-valor">${Math.round(zoom * 100)}%</span>${botaoPequeno('zoom', '1', 'Aumentar', 'A+')}</div>
      <label class="campo-marcar"><input type="checkbox" data-leitor-pref="pdfNoite"${prefs.pdfNoite ? ' checked' : ''}><span>Modo noite (inverte as cores da página)</span></label>
      <p class="lv-rotulo">Fundo do leitor</p>${escolha('tema', temas, prefs.tema)}
      ${controleBrilho(prefs)}
      <p class="campo-ajuda">No PDF, para destacar um trecho use o marca-texto da caneta (✎).</p>`;
  }
  return `
    <p class="lv-rotulo">Letra</p>${escolha('fonte', FONTES_LEITOR, prefs.fonte)}
    <div class="lv-linha">${botaoPequeno('tamanho', '-1', 'Letra menor', 'A−')}<span class="lv-valor">${prefs.tamanho}</span>${botaoPequeno('tamanho', '1', 'Letra maior', 'A+')}</div>
    <label class="campo"><span class="campo-rotulo">Espaço entre linhas: ${prefs.linhas.toFixed(1)}</span>
      <input type="range" min="1.2" max="2.2" step="0.1" value="${prefs.linhas}" data-leitor-pref="linhas"></label>
    <p class="lv-rotulo">Margens</p>${escolha('margens', MARGENS_LEITOR, prefs.margens)}
    <label class="campo-marcar"><input type="checkbox" data-leitor-pref="justificado"${prefs.justificado ? ' checked' : ''}><span>Texto justificado</span></label>
    <p class="lv-rotulo">Fundo</p>${escolha('tema', temas, prefs.tema)}
    ${controleBrilho(prefs)}
    <p class="lv-rotulo">Jeito de ler</p>${escolha('modo', [{ id: 'paginas', nome: 'Virar páginas' }, { id: 'rolagem', nome: 'Rolar' }], prefs.modo)}`;
}

const botaoPequeno = (campo, passo, rotulo, texto) => `<button class="botao botao-secundario botao-pequeno" type="button" data-leitor="passo" data-campo="${campo}" data-passo="${passo}" aria-label="${esc(rotulo)}">${esc(texto)}</button>`;
const controleBrilho = (prefs) => `<label class="campo"><span class="campo-rotulo">Brilho: ${Math.round(prefs.brilho * 100)}%</span>
  <input type="range" min="0.4" max="1" step="0.05" value="${prefs.brilho}" data-leitor-pref="brilho"></label>`;
