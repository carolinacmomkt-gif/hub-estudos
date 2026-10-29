// Caderno digitado (#cadernos/<id> no formato Documento ou Notas): no computador, um documento
// com folhas, barra de formatação e índice; no celular, notas rápidas, uma por página.
// O texto fica na própria página (tracos_json.texto), então a tinta do tablet continua junto.

import { listar, obter, salvar } from './persistencia.js';
import { esc } from './utilidades.js';
import { dimensoes } from './folhas.js';
import { novaPaginaVazia, desenharPaginaEm, coresDoPapel, carregarImagensDaPagina } from './editor-tinta.js';
import { imagemDoFundo } from './fundos.js';
import {
  FORMATOS, soTinta, escolherFormato, temTexto, temTinta, editavelComoTexto, htmlDaPagina, tituloDaPagina, resumoDaPagina,
  contarPalavras, limparHtml, comTexto,
} from './dados-texto.js';
import { imagemDoTexto, alturaDoTexto, corDoTextoNoPapel } from './texto-imagem.js';
import { reduzirImagem, guardarImagemLocal, carregarThumbsDaTela } from './thumbs-youtube.js';
import { enviarArquivo, idDaUsuaria } from './nuvem.js';
import { perguntarTexto } from './confirmar.js';

let caderno = null;
let formato = 'documento';
let paginas = [];
let secoes = [];
let notaAberta = null; // id da nota aberta (formato Notas)
let montagem = 0;
let faltaSalvar = new Map(); // id da página → elemento editável
let tempoSalvar = null;
let tempoIndice = null;
let ultimaSelecao = null; // { editavel, range }
let desfazerExclusao = null;

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const dimDoCaderno = () => dimensoes(caderno?.tamanho || 'A4', caderno?.orientacao || 'retrato');
const pagina = (id) => paginas.find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Casca da tela (sem esperar os dados)
// ---------------------------------------------------------------------------

export function renderEditorTexto(cad, fmt) {
  return `
    <div class="editor-texto formato-${esc(fmt)}">
      <header class="texto-topo">
        <a class="botao botao-secundario botao-pequeno" href="#cadernos" aria-label="Voltar para os cadernos">←</a>
        <h1 tabindex="-1" id="editor-titulo">${esc(cad?.titulo || 'Caderno')}</h1>
        <span class="texto-salvo" id="texto-salvo" aria-live="polite"></span>
        ${seletorDeFormato(cad, fmt)}
      </header>
      <div id="texto-conteudo"><p class="texto-suave">Abrindo o caderno…</p></div>
    </div>`;
}

// Os três jeitos de abrir o caderno (também aparece no editor de tinta).
export function seletorDeFormato(cad, fmt) {
  if (!cad || soTinta(cad)) return '';
  return `<div class="segmentado texto-formatos" role="group" aria-label="Abrir este caderno como">
    ${FORMATOS.map((f) => `<button type="button" data-tx="formato" data-valor="${f.id}" aria-pressed="${f.id === fmt}" title="${esc(f.descricao)}">${esc(f.nome)}</button>`).join('')}
  </div>`;
}

export function trocarFormato(cadernoId, fmt) {
  escolherFormato(cadernoId, fmt);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ---------------------------------------------------------------------------
// Partes da tela
// ---------------------------------------------------------------------------

const BOTOES_DOC = [
  ['bold', 'B', 'Negrito (Ctrl+B)'], ['italic', 'I', 'Itálico (Ctrl+I)'], ['underline', 'U', 'Sublinhado (Ctrl+U)'], ['strikeThrough', 'S', 'Riscado'],
  ['mark', '🖍', 'Marca-texto'], '|',
  ['insertUnorderedList', '•', 'Lista'], ['insertOrderedList', '1.', 'Lista numerada'], ['check', '☑', 'Checklist'], ['quote', '❝', 'Citação'], '|',
  ['hr', '—', 'Linha divisória'], ['table', '▦', 'Tabela'], ['link', '🔗', 'Link'], ['imagem', '🖼', 'Imagem'], '|',
  ['undo', '↶', 'Desfazer (Ctrl+Z)'], ['redo', '↷', 'Refazer'], ['limpar', 'Tx', 'Tirar a formatação'],
];
const BOTOES_NOTA = [['check', '☑', 'Checklist'], ['insertUnorderedList', '•', 'Lista'], ['titulo', 'T', 'Título'], ['bold', 'B', 'Negrito'], ['italic', 'I', 'Itálico'], ['mark', '🖍', 'Marca-texto'], ['imagem', '🖼', 'Imagem'], ['undo', '↶', 'Desfazer']];

function botaoCmd([cmd, rotulo, dica]) {
  if (cmd === 'imagem') {
    return `<label class="ferramenta-botao" title="${esc(dica)}" aria-label="${esc(dica)}">${rotulo}<input type="file" accept="image/*" hidden data-tx-imagem></label>`;
  }
  return `<button type="button" class="ferramenta-botao" data-cmd="${cmd}" title="${esc(dica)}" aria-label="${esc(dica)}">${rotulo}</button>`;
}

function barraDoDocumento() {
  return `
    <div class="texto-barra" role="toolbar" aria-label="Formatação">
      <select data-tx-estilo aria-label="Estilo do parágrafo">
        <option value="p">Texto</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option>
      </select>
      ${BOTOES_DOC.map((b) => (b === '|' ? '<span class="separador" aria-hidden="true"></span>' : botaoCmd(b))).join('')}
    </div>`;
}

function editavel(p, extra = '') {
  return `<div class="folha-texto${htmlDaPagina(p) ? '' : ' vazia'}" contenteditable="true" spellcheck="true" lang="pt-BR" data-pagina="${esc(p.id)}"
    data-vazio="${esc(extra || 'Comece a escrever…')}" role="textbox" aria-multiline="true" aria-label="Texto da página">${htmlDaPagina(p) || '<p><br></p>'}</div>`;
}

function folhaDoDocumento(p, n) {
  const secao = secoes.find((s) => s.id === p.secao_id);
  if (!editavelComoTexto(p)) {
    return `<article class="doc-folha doc-tinta" data-pagina-folha="${esc(p.id)}">
      ${p.miniatura_url ? `<img src="${esc(p.miniatura_url)}" alt="Página ${n} escrita à mão">` : ''}
      <p class="campo-ajuda">Página ${n} escrita à mão${secao ? ` · ${esc(secao.titulo)}` : ''}.
        <button class="card-link" type="button" data-tx="formato" data-valor="tinta">Abrir à mão</button></p>
    </article>`;
  }
  return `<article class="doc-folha" data-pagina-folha="${esc(p.id)}">
    ${temTinta(p) ? '<span class="doc-selo" title="A escrita à mão aparece no formato À mão">✍️ com escrita à mão</span>' : ''}
    ${editavel(p, n === 1 ? 'Comece a escrever… (dica: "# " vira título, "- " vira lista, "[] " vira checklist)' : 'Continue aqui…')}
    <footer class="doc-rodape">${secao ? `${esc(secao.titulo)} · ` : ''}${n}</footer>
  </article>`;
}

function conteudoDocumento() {
  return `
    ${barraDoDocumento()}
    <div class="texto-corpo">
      <nav class="texto-indice" id="texto-indice" aria-label="Índice do documento"></nav>
      <div class="doc-paginas" id="doc-paginas">
        ${paginas.map((p, i) => folhaDoDocumento(p, i + 1)).join('')}
        <button class="doc-nova" type="button" data-tx="nova-pagina">+ Nova página</button>
      </div>
    </div>`;
}

function cartaoNota(p) {
  const titulo = tituloDaPagina(p);
  const tinta = !editavelComoTexto(p);
  const data = p.tracos_json?.texto?.atualizado_em || p.atualizado_em;
  return `<li class="nota-item" data-nota="${esc(p.id)}" data-busca="${esc(`${p.tracos_json?.texto?.plano || ''}`.toLowerCase())}">
    <button class="nota-cartao" type="button" data-tx="abrir-nota" data-id="${esc(p.id)}">
      ${tinta && p.miniatura_url ? `<img src="${esc(p.miniatura_url)}" alt="">` : ''}
      <strong>${esc(tinta ? 'Página à mão' : titulo || 'Nota sem título')}</strong>
      ${!tinta && resumoDaPagina(p) ? `<span class="resumo">${esc(resumoDaPagina(p))}</span>` : ''}
      <small class="campo-ajuda">${data ? esc(fmtData.format(new Date(data)).replace('.', '')) : ''}${temTinta(p) && !tinta ? ' · ✍️' : ''}</small>
    </button>
    <button class="nota-fixar" type="button" data-tx="fixar" data-id="${esc(p.id)}" aria-pressed="${Boolean(p.marcador)}" aria-label="${p.marcador ? 'Desafixar' : 'Fixar no topo'}">📌</button>
  </li>`;
}

function conteudoNotas() {
  const vivas = paginas.filter((p) => editavelComoTexto(p) ? temTexto(p) || p.id === notaAberta : true);
  const ordem = (a, b) => String(b.tracos_json?.texto?.atualizado_em || b.atualizado_em).localeCompare(String(a.tracos_json?.texto?.atualizado_em || a.atualizado_em));
  const fixadas = vivas.filter((p) => p.marcador).sort(ordem);
  const outras = vivas.filter((p) => !p.marcador).sort(ordem);
  return `
    <div class="notas-topo">
      <label class="visualmente-oculto" for="notas-busca">Buscar nas notas</label>
      <input id="notas-busca" type="search" placeholder="Buscar nas notas" autocomplete="off">
      <button class="botao botao-primario" type="button" data-tx="nova-nota">Nova nota</button>
    </div>
    ${!vivas.length ? '<p class="texto-suave">Nenhuma nota ainda. Toque em "Nova nota" e já sai escrevendo.</p>' : ''}
    ${fixadas.length ? `<h2 class="notas-grupo">Fixadas</h2><ul class="notas">${fixadas.map(cartaoNota).join('')}</ul>` : ''}
    ${outras.length ? `${fixadas.length ? '<h2 class="notas-grupo">Outras</h2>' : ''}<ul class="notas">${outras.map(cartaoNota).join('')}</ul>` : ''}`;
}

function conteudoNotaAberta(p) {
  return `
    <div class="nota-aberta-topo">
      <button class="botao botao-secundario botao-pequeno" type="button" data-tx="voltar-notas">← Notas</button>
      <span class="espaco"></span>
      <button class="botao botao-secundario botao-pequeno" type="button" data-tx="fixar" data-id="${esc(p.id)}" aria-pressed="${Boolean(p.marcador)}">${p.marcador ? '📌 Fixada' : '📌 Fixar'}</button>
      <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-tx="excluir-nota" data-id="${esc(p.id)}">Excluir</button>
    </div>
    ${temTinta(p) ? '<p class="nota-tinta-aviso">✍️ Esta página também tem escrita à mão. Ela aparece no formato "À mão".</p>' : ''}
    <div class="nota-editor">${editavel(p, 'Escreva aqui…')}</div>
    <div class="nota-barra" role="toolbar" aria-label="Formatação">${BOTOES_NOTA.map(botaoCmd).join('')}</div>`;
}

function desenhar({ focar = null } = {}) {
  const area = document.getElementById('texto-conteudo');
  if (!area) return;
  document.body.classList.toggle('nota-aberta', formato === 'notas' && Boolean(notaAberta));
  if (formato === 'notas') area.innerHTML = notaAberta && pagina(notaAberta) ? conteudoNotaAberta(pagina(notaAberta)) : conteudoNotas();
  else area.innerHTML = conteudoDocumento();
  carregarThumbsDaTela(area);
  atualizarIndice();
  atualizarContagem();
  if (focar) {
    const el = area.querySelector(`.folha-texto[data-pagina="${CSS.escape(focar)}"]`);
    if (el) {
      el.focus({ preventScroll: formato !== 'documento' });
      if (formato === 'documento') el.closest('.doc-folha')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      colocarCursorNoFim(el);
    }
  }
}

function colocarCursorNoFim(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function atualizarIndice() {
  const nav = document.getElementById('texto-indice');
  if (!nav) return;
  const titulos = [...document.querySelectorAll('#doc-paginas .folha-texto :is(h1, h2, h3)')].filter((h) => h.textContent.trim());
  nav.closest('.texto-corpo')?.classList.toggle('sem-indice', !titulos.length);
  nav.innerHTML = titulos.length ? `<h2>Índice</h2><ol>${titulos.map((h, i) => `<li><button type="button" class="nivel-${h.tagName[1]}" data-tx="ir" data-i="${i}">${esc(h.textContent.trim().slice(0, 80))}</button></li>`).join('')}</ol>` : '';
}

function atualizarContagem() {
  const el = document.getElementById('texto-salvo');
  if (!el || el.dataset.estado === 'salvando') return;
  const total = [...document.querySelectorAll('#texto-conteudo .folha-texto')].reduce((t, e) => t + contarPalavras(e.innerText), 0)
    + paginas.filter((p) => !document.querySelector(`.folha-texto[data-pagina="${CSS.escape(p.id)}"]`)).reduce((t, p) => t + contarPalavras(p.tracos_json?.texto?.plano), 0);
  el.textContent = `${total.toLocaleString('pt-BR')} ${total === 1 ? 'palavra' : 'palavras'}${el.dataset.estado === 'salvo' ? ' · Salvo' : ''}`;
}

function mostrarSalvo(estado) {
  const el = document.getElementById('texto-salvo');
  if (!el) return;
  el.dataset.estado = estado;
  if (estado === 'salvando') el.textContent = 'Salvando…';
  else atualizarContagem();
}

function avisar(texto, desfazer = null) {
  const aviso = document.getElementById('aviso');
  if (!aviso) return;
  desfazerExclusao = desfazer;
  aviso.innerHTML = `<span>${esc(texto)}</span>${desfazer ? '<button class="aviso-acao" type="button" data-tx="desfazer">Desfazer</button>' : ''}`;
  aviso.hidden = false;
  clearTimeout(avisar.tempo);
  avisar.tempo = setTimeout(() => { aviso.hidden = true; desfazerExclusao = null; }, desfazer ? 6000 : 3000);
}

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

// O HTML do editor sem as URLs locais das fotos (elas abrem de novo pelo caminho no Storage).
function htmlDoEditavel(el) {
  const copia = el.cloneNode(true);
  for (const img of copia.querySelectorAll('img[data-thumb]')) img.removeAttribute('src');
  const vazio = !copia.textContent.trim() && !copia.querySelector('img, hr, table');
  return vazio ? '' : limparHtml(copia.innerHTML);
}

async function miniaturaDe(p, dim) {
  const largura = 220;
  const escala = largura / dim.largura;
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = Math.round(dim.altura * escala);
  const x = c.getContext('2d');
  x.setTransform(escala, 0, 0, escala, 0, 0);
  const json = { ...(p.tracos_json || {}), modelo: p.modelo_folha };
  await carregarImagensDaPagina(json);
  const texto = await imagemDoTexto(htmlDaPagina(p), dim, corDoTextoNoPapel());
  desenharPaginaEm(x, json, dim, { imagem: await imagemDoFundo(p), texto: texto?.imagem, cores: coresDoPapel() });
  return c.toDataURL('image/jpeg', 0.7);
}

function marcarParaSalvar(el) {
  faltaSalvar.set(el.dataset.pagina, el);
  mostrarSalvo('salvando');
  clearTimeout(tempoSalvar);
  tempoSalvar = setTimeout(salvarTudo, 800);
}

async function salvarTudo() {
  clearTimeout(tempoSalvar);
  tempoSalvar = null;
  if (!faltaSalvar.size) return;
  const lote = [...faltaSalvar.entries()];
  faltaSalvar = new Map();
  const minha = montagem;
  const base = dimDoCaderno();
  for (const [id, el] of lote) {
    const p = pagina(id);
    if (!p) continue;
    const html = htmlDoEditavel(el);
    const nova = comTexto(p, html);
    if (!html) delete nova.tracos_json.texto;
    if (!nova.tracos_json.camadas?.length) nova.tracos_json.camadas = novaPaginaVazia(p.modelo_folha || 'branco').camadas;
    // A folha cresce quando o texto passa do fim (no tablet a tinta acompanha).
    const precisa = html ? Math.ceil(alturaDoTexto(nova.tracos_json.texto.html, base) / 100) * 100 : 0;
    nova.altura = Math.max(base.altura, precisa, temTinta(p) ? Number(p.altura) || 0 : 0);
    try {
      nova.miniatura_url = await miniaturaDe(nova, { ...base, altura: nova.altura });
    } catch {
      // sem miniatura nova: fica a anterior
    }
    const salva = await salvar('paginas', nova);
    const i = paginas.findIndex((x) => x.id === id);
    if (i >= 0) paginas[i] = salva;
  }
  if (caderno && minha === montagem) caderno = await salvar('cadernos', { ...caderno });
  if (!faltaSalvar.size) mostrarSalvo('salvo');
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function editavelAtual() {
  const ativo = document.activeElement?.closest?.('.folha-texto[contenteditable]');
  return ativo || ultimaSelecao?.editavel || document.querySelector('#texto-conteudo .folha-texto[contenteditable]');
}

function voltarSelecao() {
  const el = editavelAtual();
  if (!el) return null;
  if (document.activeElement !== el) el.focus({ preventScroll: true });
  const s = getSelection();
  if (ultimaSelecao?.editavel === el && ultimaSelecao.range && (!s.rangeCount || !el.contains(s.anchorNode))) {
    s.removeAllRanges();
    s.addRange(ultimaSelecao.range);
  } else if (!s.rangeCount || !el.contains(s.anchorNode)) {
    colocarCursorNoFim(el);
  }
  return el;
}

function blocoDoCursor(el) {
  const s = getSelection();
  let no = s.anchorNode;
  while (no && no !== el && !(no.nodeType === 1 && /^(P|DIV|H1|H2|H3|LI|BLOCKQUOTE|PRE)$/.test(no.tagName))) no = no.parentNode;
  return no && no !== el ? no : null;
}

function listaDoCursor(el) {
  const b = blocoDoCursor(el);
  return b?.closest?.('ul, ol') && el.contains(b.closest('ul, ol')) ? b.closest('ul, ol') : null;
}

function colocarCursorEm(no) {
  const r = document.createRange();
  r.selectNodeContents(no);
  r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

// Checklist feito à mão (o comando de lista do navegador juntaria com a lista de cima).
function alternarChecklist(el) {
  const lista = listaDoCursor(el);
  if (lista?.tagName === 'UL' && lista.hasAttribute('data-check')) {
    document.execCommand('insertUnorderedList');
    return;
  }
  if (lista) {
    if (lista.tagName === 'OL') {
      const ul = document.createElement('ul');
      ul.append(...lista.childNodes);
      lista.replaceWith(ul);
      ul.setAttribute('data-check', '');
    } else {
      lista.setAttribute('data-check', '');
    }
    return;
  }
  const bloco = blocoDoCursor(el);
  const li = document.createElement('li');
  if (bloco) li.append(...bloco.childNodes);
  if (!li.textContent.trim() && !li.querySelector('br')) li.innerHTML = '<br>';
  const anterior = bloco?.previousElementSibling;
  if (anterior?.matches('ul[data-check]')) {
    anterior.append(li);
    bloco.remove();
  } else {
    const ul = document.createElement('ul');
    ul.setAttribute('data-check', '');
    ul.append(li);
    if (bloco) bloco.replaceWith(ul);
    else el.append(ul);
  }
  colocarCursorEm(li);
}

// Título ou citação num item de lista: primeiro sai da lista (senão a lista inteira vira título).
function formatarBloco(el, tag) {
  const lista = listaDoCursor(el);
  if (lista && tag !== 'li') document.execCommand(lista.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
  document.execCommand('formatBlock', false, tag);
}

function marcarTexto() {
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) return;
  const r = s.getRangeAt(0);
  const dentro = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
  const marca = dentro.closest('mark');
  if (marca) {
    marca.replaceWith(...marca.childNodes);
    return;
  }
  const mark = document.createElement('mark');
  mark.append(r.extractContents());
  r.insertNode(mark);
  s.removeAllRanges();
  const novo = document.createRange();
  novo.selectNodeContents(mark);
  s.addRange(novo);
}

function estiloDoBloco(el, tag) {
  const atual = blocoDoCursor(el)?.tagName?.toLowerCase();
  formatarBloco(el, atual === tag && tag !== 'p' ? 'p' : tag);
}

function comando(cmd) {
  const el = voltarSelecao();
  if (!el) return;
  switch (cmd) {
    case 'check': alternarChecklist(el); break;
    case 'mark': marcarTexto(); break;
    case 'quote': estiloDoBloco(el, 'blockquote'); break;
    case 'titulo': {
      const atual = blocoDoCursor(el)?.tagName;
      formatarBloco(el, atual === 'H1' ? 'h2' : atual === 'H2' ? 'p' : 'h1');
      break;
    }
    case 'hr': document.execCommand('insertHTML', false, '<hr><p><br></p>'); break;
    case 'table': {
      const cel = (t) => `<${t}><br></${t}>`;
      document.execCommand('insertHTML', false, `<table><tbody><tr>${cel('th').repeat(3)}</tr><tr>${cel('td').repeat(3)}</tr><tr>${cel('td').repeat(3)}</tr></tbody></table><p><br></p>`);
      break;
    }
    case 'link': {
      if (endereco === undefined) {
        perguntarTexto('Endereço do link (https://…)').then((e) => { if (e) comando('link', e); });
        return;
      }
      if (!endereco) break;
      const url = /^https?:\/\//i.test(endereco.trim()) ? endereco.trim() : `https://${endereco.trim()}`;
      if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>`);
      else document.execCommand('createLink', false, url);
      break;
    }
    case 'limpar':
      document.execCommand('removeFormat');
      document.execCommand('formatBlock', false, 'p');
      break;
    default:
      document.execCommand(cmd);
  }
  marcarParaSalvar(el);
  atualizarBarraDeEstilo();
}

function atualizarBarraDeEstilo() {
  const sel = document.querySelector('[data-tx-estilo]');
  const el = ultimaSelecao?.editavel;
  if (!sel || !el) return;
  const tag = blocoDoCursor(el)?.tagName?.toLowerCase();
  sel.value = ['h1', 'h2', 'h3'].includes(tag) ? tag : 'p';
  for (const b of document.querySelectorAll('[data-cmd]')) {
    const cmd = b.dataset.cmd;
    if (['bold', 'italic', 'underline', 'strikeThrough'].includes(cmd)) b.setAttribute('aria-pressed', String(document.queryCommandState(cmd)));
  }
}

async function inserirImagem(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  const el = voltarSelecao();
  if (!el) return;
  const usuaria = idDaUsuaria();
  if (!usuaria) {
    avisar('Entre no app para colocar imagens.');
    return;
  }
  try {
    mostrarSalvo('salvando');
    const blob = await reduzirImagem(arquivo);
    const caminho = `${usuaria}/cadernos/${caderno.id}/${crypto.randomUUID()}.jpg`;
    guardarImagemLocal(caminho, blob);
    await enviarArquivo(caminho, new File([blob], 'imagem.jpg', { type: 'image/jpeg' }));
    voltarSelecao();
    document.execCommand('insertHTML', false, `<img data-thumb="${esc(caminho)}" alt=""><p><br></p>`);
    carregarThumbsDaTela(el);
    marcarParaSalvar(el);
  } catch (e) {
    mostrarSalvo('salvo');
    avisar(e.message || 'Não deu para enviar a imagem agora.');
  }
}

// "# " vira título, "- " lista, "1. " numerada, "[] " checklist e "> " citação (como no Notion e no Docs).
const ATALHOS = { '#': ['formatBlock', 'h1'], '##': ['formatBlock', 'h2'], '###': ['formatBlock', 'h3'], '-': ['insertUnorderedList'], '*': ['insertUnorderedList'], '1.': ['insertOrderedList'], '[]': ['check'], '>': ['formatBlock', 'blockquote'] };

function atalhoDeMarkdown(evento, el) {
  const bloco = blocoDoCursor(el);
  if (!bloco || !['P', 'DIV'].includes(bloco.tagName)) return false;
  const s = getSelection();
  if (!s.isCollapsed) return false;
  const antes = document.createRange();
  antes.selectNodeContents(bloco);
  antes.setEnd(s.anchorNode, s.anchorOffset);
  const token = antes.toString();
  const atalho = ATALHOS[token];
  if (!atalho || bloco.textContent !== token) return false;
  evento.preventDefault();
  bloco.innerHTML = '<br>';
  const r = document.createRange();
  r.setStart(bloco, 0);
  r.collapse(true);
  s.removeAllRanges();
  s.addRange(r);
  if (atalho[0] === 'check') alternarChecklist(el);
  else if (atalho[0] === 'formatBlock') formatarBloco(el, atalho[1]);
  else document.execCommand(atalho[0], false, atalho[1]);
  marcarParaSalvar(el);
  return true;
}

// ---------------------------------------------------------------------------
// Páginas e notas
// ---------------------------------------------------------------------------

async function novaPaginaDigitada() {
  await salvarTudo();
  const dim = dimDoCaderno();
  const ultima = paginas[paginas.length - 1];
  const nova = await salvar('paginas', {
    caderno_id: caderno.id, ordem: paginas.length, modelo_folha: 'branco', tracos_json: novaPaginaVazia('branco'),
    largura: dim.largura, altura: dim.altura, secao_id: ultima?.secao_id || null,
  });
  paginas.push(nova);
  return nova;
}

async function alternarFixar(id) {
  const p = pagina(id);
  if (!p) return;
  const i = paginas.indexOf(p);
  paginas[i] = await salvar('paginas', { ...p, marcador: !p.marcador });
  navigator.vibrate?.(10);
  desenhar();
}

async function excluirNota(id) {
  await salvarTudo();
  const p = pagina(id);
  if (!p) return;
  await salvar('paginas', { ...p, excluido_em: new Date().toISOString() });
  paginas = paginas.filter((x) => x.id !== id);
  notaAberta = null;
  desenhar();
  avisar('Nota excluída.', async () => {
    const volta = await salvar('paginas', { ...p, excluido_em: null });
    paginas.push(volta);
    paginas.sort((a, b) => a.ordem - b.ordem);
    desenhar();
  });
}

function filtrarNotas(valor) {
  const termo = String(valor || '').trim().toLowerCase();
  for (const li of document.querySelectorAll('.nota-item')) li.hidden = Boolean(termo) && !li.dataset.busca.includes(termo);
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function aoClicar(evento) {
  const alvo = evento.target.closest('[data-tx], [data-cmd]');
  // Checklist: tocar no quadradinho marca e desmarca.
  const item = evento.target.closest?.('.folha-texto[contenteditable] ul[data-check] > li');
  if (item && evento.clientX < item.getBoundingClientRect().left) {
    if (item.getAttribute('data-feito') === '1') item.removeAttribute('data-feito');
    else item.setAttribute('data-feito', '1');
    navigator.vibrate?.(10);
    marcarParaSalvar(item.closest('.folha-texto'));
    return;
  }
  // Ctrl+clique abre o link (clicar sozinho só põe o cursor, para editar).
  const link = evento.target.closest?.('.folha-texto a[href]');
  if (link && (evento.ctrlKey || evento.metaKey)) {
    window.open(link.href, '_blank', 'noopener');
    return;
  }
  if (!alvo || !document.querySelector('.editor-texto')?.contains(alvo) && alvo.dataset.tx !== 'desfazer') return;
  if (alvo.dataset.cmd) {
    comando(alvo.dataset.cmd);
    return;
  }
  const { tx, id, valor } = alvo.dataset;
  if (tx === 'formato') {
    salvarTudo().then(() => trocarFormato(caderno.id, valor));
  } else if (tx === 'nova-pagina') {
    novaPaginaDigitada().then((p) => desenhar({ focar: p.id }));
  } else if (tx === 'nova-nota') {
    novaPaginaDigitada().then((p) => {
      notaAberta = p.id;
      desenhar({ focar: p.id });
    });
  } else if (tx === 'abrir-nota') {
    const p = pagina(id);
    if (p && !editavelComoTexto(p)) {
      trocarFormato(caderno.id, 'tinta');
      return;
    }
    notaAberta = id;
    desenhar({ focar: id });
    window.scrollTo(0, 0);
  } else if (tx === 'voltar-notas') {
    salvarTudo().then(() => {
      notaAberta = null;
      desenhar();
    });
  } else if (tx === 'fixar') {
    alternarFixar(id);
  } else if (tx === 'excluir-nota') {
    excluirNota(id);
  } else if (tx === 'ir') {
    const titulos = [...document.querySelectorAll('#doc-paginas .folha-texto :is(h1, h2, h3)')].filter((h) => h.textContent.trim());
    titulos[Number(alvo.dataset.i)]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else if (tx === 'desfazer') {
    const fn = desfazerExclusao;
    desfazerExclusao = null;
    document.getElementById('aviso').hidden = true;
    fn?.();
  }
}

function aoApertar(evento) {
  // Os botões da barra não tiram o cursor do texto.
  if (evento.target.closest('.texto-barra [data-cmd], .nota-barra [data-cmd]')) evento.preventDefault();
}

function aoDigitar(evento) {
  const el = evento.target.closest?.('.folha-texto[contenteditable]');
  if (el) {
    el.classList.toggle('vazia', !el.textContent.trim() && !el.querySelector('img, hr, table'));
    // Item novo de checklist nasce desmarcado.
    for (const li of el.querySelectorAll('li[data-feito]')) if (!li.textContent.trim()) li.removeAttribute('data-feito');
    marcarParaSalvar(el);
    clearTimeout(tempoIndice);
    tempoIndice = setTimeout(atualizarIndice, 600);
    return;
  }
  if (evento.target.id === 'notas-busca') filtrarNotas(evento.target.value);
}

function aoMudar(evento) {
  if (evento.target.matches('[data-tx-estilo]')) {
    const el = voltarSelecao();
    if (!el) return;
    formatarBloco(el, evento.target.value);
    marcarParaSalvar(el);
    atualizarIndice();
  } else if (evento.target.matches('[data-tx-imagem]')) {
    inserirImagem(evento.target);
  }
}

function aoTeclar(evento) {
  const el = evento.target.closest?.('.folha-texto[contenteditable]');
  if (!el) return;
  if (evento.key === ' ' && atalhoDeMarkdown(evento, el)) return;
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
    evento.preventDefault();
    salvarTudo();
  }
}

function aoColar(evento) {
  const el = evento.target.closest?.('.folha-texto[contenteditable]');
  if (!el) return;
  const dados = evento.clipboardData;
  const arquivo = [...(dados?.files || [])].find((f) => f.type.startsWith('image/'));
  evento.preventDefault();
  if (arquivo) {
    const falso = { files: [arquivo], value: '' };
    inserirImagem(falso);
    return;
  }
  const html = dados?.getData('text/html');
  const texto = dados?.getData('text/plain') || '';
  const limpo = html ? limparHtml(html) : texto.split(/\r?\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
  document.execCommand('insertHTML', false, limpo);
  marcarParaSalvar(el);
}

function aoSelecionar() {
  const s = getSelection();
  if (!s.rangeCount) return;
  const el = (s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentNode)?.closest?.('.folha-texto[contenteditable]');
  if (!el) return;
  ultimaSelecao = { editavel: el, range: s.getRangeAt(0).cloneRange() };
  atualizarBarraDeEstilo();
}

const sairDaPagina = () => { salvarTudo(); };

// ---------------------------------------------------------------------------
// Montar e desmontar
// ---------------------------------------------------------------------------

export async function montarEditorTexto(id, fmt) {
  const minha = ++montagem;
  formato = fmt;
  notaAberta = null;
  const encontrado = await obter('cadernos', id);
  if (minha !== montagem) return;
  caderno = encontrado;
  const area = document.getElementById('texto-conteudo');
  if (!area) return;
  if (!caderno || caderno.excluido_em) {
    area.innerHTML = '<p class="texto-suave">Este caderno não foi encontrado. Ele pode ter sido excluído.</p>';
    return;
  }
  document.title = `${caderno.titulo} · Bússola`;
  const [todas, todasSecoes] = await Promise.all([listar('paginas'), listar('secoes')]);
  if (minha !== montagem) return;
  secoes = todasSecoes.filter((s) => s.caderno_id === caderno.id && !s.excluido_em).sort((a, b) => a.ordem - b.ordem);
  paginas = todas.filter((p) => p.caderno_id === caderno.id && !p.excluido_em).sort((a, b) => a.ordem - b.ordem);
  if (secoes.length) {
    const posicao = new Map(secoes.map((s, i) => [s.id, i]));
    paginas = paginas.map((p, i) => ({ p, i })).sort((a, b) => (posicao.get(a.p.secao_id) ?? secoes.length) - (posicao.get(b.p.secao_id) ?? secoes.length) || a.i - b.i).map((x) => x.p);
  }
  if (!paginas.length && formato === 'documento') await novaPaginaDigitada();
  if (minha !== montagem) return;
  document.addEventListener('click', aoClicar);
  document.addEventListener('pointerdown', aoApertar);
  document.addEventListener('mousedown', aoApertar);
  document.addEventListener('input', aoDigitar);
  document.addEventListener('change', aoMudar);
  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('paste', aoColar);
  document.addEventListener('selectionchange', aoSelecionar);
  window.addEventListener('pagehide', sairDaPagina);
  // Enter cria parágrafo (<p>), não <div>: é o que os atalhos e o banco esperam.
  document.execCommand('defaultParagraphSeparator', false, 'p');
  desenhar();
  mostrarSalvo('salvo');
}

export function desmontarEditorTexto() {
  montagem += 1;
  salvarTudo();
  document.body.classList.remove('nota-aberta');
  document.removeEventListener('click', aoClicar);
  document.removeEventListener('pointerdown', aoApertar);
  document.removeEventListener('mousedown', aoApertar);
  document.removeEventListener('input', aoDigitar);
  document.removeEventListener('change', aoMudar);
  document.removeEventListener('keydown', aoTeclar);
  document.removeEventListener('paste', aoColar);
  document.removeEventListener('selectionchange', aoSelecionar);
  window.removeEventListener('pagehide', sairDaPagina);
  ultimaSelecao = null;
}
