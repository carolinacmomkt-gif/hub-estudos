// Partes da barra do editor de caderno: camadas, inserir (imagem, câmera, adesivos),
// opções da caixa de texto, tipo de linha e a barra da seleção do laço.
// Só monta o HTML; quem age é o editor-caderno.js (atributos data-ed).

import { esc } from './utilidades.js';
import { ADESIVOS_SIMPLES, FONTES_TEXTO } from './editor-tinta.js';

export const TAMANHOS_TEXTO = [{ id: 18, nome: 'P' }, { id: 26, nome: 'M' }, { id: 40, nome: 'G' }, { id: 60, nome: 'GG' }];
export const FUNDOS_TEXTO = [{ id: 'nenhum', nome: 'Sem fundo' }, { id: 'amarelo', nome: 'Amarelo' }, { id: 'rosa', nome: 'Rosa' }, { id: 'ciano', nome: 'Azul-claro' }];
export const LINHAS = [{ id: 'continua', nome: 'Contínua' }, { id: 'tracejada', nome: 'Tracejada' }, { id: 'pontilhada', nome: 'Pontilhada' }];
export const FILTROS_LACO = [{ id: 'tudo', nome: 'Tudo' }, { id: 'escrita', nome: 'Escrita' }, { id: 'formas', nome: 'Formas' }, { id: 'imagens', nome: 'Imagens e adesivos' }, { id: 'texto', nome: 'Texto' }];

const botao = (acao, valor, rotulo, ativo, extra = '') => `<button type="button" class="ferramenta-botao" data-ed="${acao}" data-valor="${esc(valor)}" aria-pressed="${ativo}" ${extra}>${rotulo}</button>`;

export function grupoLinha(atual) {
  return `<div class="ferramenta-grupo" role="group" aria-label="Tipo de linha">${LINHAS.map((l) => botao('linha', l.id, esc(l.nome), atual === l.id)).join('')}</div>`;
}

export function grupoTexto(prefs, cores) {
  return `
    <div class="ferramenta-grupo" role="group" aria-label="Fonte">
      <label class="ferramenta-select"><span class="visualmente-oculto">Fonte</span>
        <select data-ed="texto-fonte">${Object.entries(FONTES_TEXTO).map(([id, f]) => `<option value="${id}"${prefs.fonteTexto === id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      ${TAMANHOS_TEXTO.map((t) => botao('texto-tamanho', t.id, t.nome, Number(prefs.tamTexto) === t.id, `aria-label="Tamanho ${t.nome}"`)).join('')}
      ${botao('texto-negrito', '', '<strong>N</strong>', Boolean(prefs.negritoTexto), 'aria-label="Negrito"')}
    </div>
    ${cores}
    <div class="ferramenta-grupo" role="group" aria-label="Fundo do texto">
      ${FUNDOS_TEXTO.map((f) => `<button type="button" class="ferramenta-cor${f.id === 'nenhum' ? ' sem-cor' : ''}" data-ed="texto-fundo" data-valor="${f.id}" aria-pressed="${prefs.fundoTexto === f.id}" aria-label="Fundo: ${esc(f.nome)}" title="Fundo: ${esc(f.nome)}" style="--cor: ${f.id === 'nenhum' ? 'transparent' : `var(--tinta-${f.id})`}"></button>`).join('')}
    </div>
    <span class="campo-ajuda">Toque na página para escrever; toque num texto para editar.</span>`;
}

export function grupoLaco(filtro, temCopia) {
  return `
    <div class="ferramenta-grupo">
      <label class="ferramenta-select"><span>Selecionar</span>
        <select data-ed="filtro-laco">${FILTROS_LACO.map((f) => `<option value="${f.id}"${filtro === f.id ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      ${botao('colar', '', 'Colar', false, temCopia ? '' : 'disabled')}
    </div>`;
}

export function painelInserir(adesivosProprios) {
  return `
    <details class="ferramenta-mais" data-painel="inserir">
      <summary class="ferramenta-botao">Inserir</summary>
      <div class="ferramenta-painel">
        <div class="ferramenta-grupo">
          <label class="botao botao-secundario botao-pequeno">Imagem da galeria
            <input type="file" class="visualmente-oculto" accept="image/*" data-ed="inserir-imagem"></label>
          <label class="botao botao-secundario botao-pequeno">Foto da câmera
            <input type="file" class="visualmente-oculto" accept="image/*" capture="environment" data-ed="inserir-imagem"></label>
        </div>
        <p class="campo-rotulo">Adesivos</p>
        <div class="adesivos">${ADESIVOS_SIMPLES.map((a, i) => `<button type="button" class="adesivo-botao${a.length > 2 ? ' adesivo-palavra' : ''}" data-ed="inserir-adesivo" data-valor="${i}" aria-label="Adesivo ${esc(a)}">${esc(a)}</button>`).join('')}</div>
        <p class="campo-rotulo">Meus adesivos</p>
        ${adesivosProprios.length ? `<div class="adesivos">${adesivosProprios.map((a) => `
          <span class="adesivo-proprio">
            <button type="button" class="adesivo-botao adesivo-imagem" data-ed="inserir-meu-adesivo" data-valor="${esc(a.id)}" aria-label="Inserir ${esc(a.nome)}">${a.previa ? `<img src="${esc(a.previa)}" alt="">` : esc(a.nome)}</button>
            <button type="button" class="botao-icone botao-icone-p" data-ed="excluir-meu-adesivo" data-valor="${esc(a.id)}" aria-label="Excluir o adesivo ${esc(a.nome)}">×</button>
          </span>`).join('')}</div>` : '<p class="campo-ajuda">Selecione algo com o laço e toque em "Virar adesivo".</p>'}
        <button type="button" class="botao botao-secundario botao-pequeno" data-ed="painel-pronto">Pronto</button>
      </div>
    </details>`;
}

export function painelCamadas(camadas, ativaId, { todas, marcaPropria }) {
  // A lista aparece de cima para baixo (a de cima é desenhada por cima das outras).
  const desenho = camadas.filter((c) => c.tipo === 'desenho');
  const ativa = desenho.find((c) => c.id === ativaId && !c.bloqueada && c.visivel !== false)?.id
    || desenho.find((c) => !c.bloqueada && c.visivel !== false)?.id;
  const lista = [...desenho].reverse();
  return `
    <details class="ferramenta-mais" data-painel="camadas">
      <summary class="ferramenta-botao">Camadas <span class="selo">${desenho.length}</span></summary>
      <div class="ferramenta-painel painel-camadas">
        <ul class="camadas">${lista.map((c, i) => `
          <li class="camada${c.id === ativa ? ' ativa' : ''}">
            <label class="camada-escolha"><input type="radio" name="camada-ativa" data-ed="camada-ativa" value="${esc(c.id)}"${c.id === ativa ? ' checked' : ''}${c.bloqueada || c.visivel === false ? ' disabled' : ''}>
              <span class="visualmente-oculto">Escrever na camada ${esc(c.nome)}</span></label>
            <input type="text" class="camada-nome" maxlength="40" value="${esc(c.nome)}" data-ed="camada-nome" data-valor="${esc(c.id)}" aria-label="Nome da camada">
            <span class="camada-botoes">
              ${botao('camada-ver', c.id, c.visivel === false ? '🙈' : '👁', c.visivel !== false, `aria-label="${c.visivel === false ? 'Mostrar' : 'Esconder'} ${esc(c.nome)}" title="${c.visivel === false ? 'Mostrar' : 'Esconder'}"`)}
              ${botao('camada-travar', c.id, c.bloqueada ? '🔒' : '🔓', Boolean(c.bloqueada), `aria-label="${c.bloqueada ? 'Destravar' : 'Travar'} ${esc(c.nome)}" title="${c.bloqueada ? 'Destravar' : 'Travar'}"`)}
              ${botao('camada-subir', c.id, '↑', false, `aria-label="Subir ${esc(c.nome)}"${i === 0 ? ' disabled' : ''}`)}
              ${botao('camada-descer', c.id, '↓', false, `aria-label="Descer ${esc(c.nome)}"${i === lista.length - 1 ? ' disabled' : ''}`)}
              ${botao('camada-mesclar', c.id, 'Mesclar', false, `aria-label="Mesclar ${esc(c.nome)} com a camada de baixo" title="Juntar com a de baixo"${i === lista.length - 1 ? ' disabled' : ''}`)}
              ${botao('camada-excluir', c.id, '×', false, `aria-label="Excluir ${esc(c.nome)}"${desenho.length <= 1 ? ' disabled' : ''}`)}
            </span>
            <label class="camada-opacidade"><span>Opacidade</span>
              <input type="range" min="10" max="100" step="5" value="${Math.round((c.opacidade ?? 1) * 100)}" data-ed="camada-opacidade" data-valor="${esc(c.id)}"></label>
          </li>`).join('')}
          <li class="camada camada-fundo"><span>Fundo (folha)</span> <span class="campo-ajuda">sempre travado</span></li>
        </ul>
        ${botao('camada-nova', '', '+ Camada', false)}
        <label class="campo-marcar"><input type="checkbox" data-ed="camadas-todas"${todas ? ' checked' : ''}><span>Laço e borracha em todas as camadas</span></label>
        <label class="campo-marcar"><input type="checkbox" data-ed="marca-propria"${marcaPropria ? ' checked' : ''}><span>Marca-texto numa camada só dele</span></label>
        <button type="button" class="botao botao-secundario botao-pequeno" data-ed="painel-pronto">Pronto</button>
      </div>
    </details>`;
}

export function barraDaSelecao({ quantos, cores, temTraco }) {
  return `
    <span>${quantos} ${quantos === 1 ? 'item selecionado' : 'itens selecionados'}</span>
    <div class="ferramenta-grupo">${cores}</div>
    ${temTraco ? `<div class="ferramenta-grupo" role="group" aria-label="Espessura">
      ${[[1.6, 'Extrafina'], [2.5, 'Fina'], [4, 'Média'], [7, 'Grossa']].map(([v, n]) => botao('selecao-espessura', v, n, false)).join('')}
    </div>` : ''}
    <div class="ferramenta-grupo">
      ${botao('selecao-girar', '-15', '↺ 15°', false, 'aria-label="Girar 15 graus para a esquerda"')}
      ${botao('selecao-girar', '15', '↻ 15°', false, 'aria-label="Girar 15 graus para a direita"')}
      ${botao('selecao-duplicar', '', 'Duplicar', false)}
      ${botao('selecao-copiar', '', 'Copiar', false)}
      ${botao('selecao-recortar', '', 'Recortar', false)}
      ${botao('selecao-imagem', '', 'Capturar imagem', false)}
      ${botao('selecao-adesivo', '', 'Virar adesivo', false)}
      ${botao('selecao-excluir', '', 'Excluir', false)}
      ${botao('selecao-pronto', '', 'Pronto', false)}
    </div>
    <span class="campo-ajuda">Arraste para mover; o quadradinho do canto muda o tamanho; a bolinha de cima gira.</span>`;
}
