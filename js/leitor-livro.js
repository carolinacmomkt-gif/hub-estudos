// Leitor de livros (#livro/<id>), estilo Kindle, para EPUB e PDF.
// EPUB: o texto é nosso (letra, tamanho, linhas, margens, fundo e brilho da Carol), em páginas
// que viram (colunas do CSS) ou rolando; destaques em 4 cores com nota, explicar com a IA.
// PDF: a página desenhada pelo pdf.js, com zoom, modo noite e a caneta dos Cadernos por cima
// (a tinta fica em livro_paginas). Nos dois: sumário, busca, marcadores, tempo que falta e onde
// parou (artigos.dados.posicao), que segue para os outros aparelhos.

import { atualizarEstado } from './estado.js';
import { obter, listar, salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { esc } from './utilidades.js';
import { arquivoGuardado, abrirPdf } from './fundos.js';
import { abrirEpub } from './epub.js';
import { EditorDeTinta, novaPaginaVazia } from './editor-tinta.js';
import { painelAjustes } from './views-livro.js';
import { CORES_DESTAQUE } from './dados-biblioteca.js';
import { notarLivro } from './continuar.js';
import {
  prefsLeitor, formatoDoLivro, FONTES_LEITOR, MARGENS_LEITOR, porcentagemEpub, posicaoDaPorcentagem, porcentagemPdf,
  textoPct, tempoRestanteEpub, textoTempo, marcadorAqui, alternarMarcador, posicaoDaChave,
  novoDestaque, destaquesDoCapitulo, buscarNoTexto,
} from './dados-livros.js';

const CHAVE_PREFS = 'hub.leitor.prefs';
const MIN_POR_PAGINA_PDF = 1.6;
const ZOOM_PDF = [0.75, 1, 1.25, 1.5, 2, 2.5];

let L = null; // o livro aberto (tudo deste módulo fica aqui, para desmontar limpo)
let app = null;

export function ligarLeitor(funcoes) {
  app = funcoes;
}

const el = (id) => document.getElementById(id);
const aviso = (t, acao) => app?.avisoCurto(t, acao);

function lerPrefs() {
  try {
    return prefsLeitor(JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}'));
  } catch {
    return prefsLeitor({});
  }
}
function guardarPrefs() {
  try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(L.prefs)); } catch { /* vale nesta aba */ }
}

// ---------------------------------------------------------------------------
// Montar e desmontar
// ---------------------------------------------------------------------------

export async function montarLeitor(id) {
  desmontarLeitor();
  const montagem = Symbol('livro');
  const artigo = await obter('artigos', id);
  if (!artigo || artigo.excluido_em || !artigo.pdf_path) return;
  document.body.classList.add('modo-editor', 'modo-leitor');
  L = {
    montagem, artigo, formato: formatoDoLivro(artigo), prefs: lerPrefs(), marcadores: artigo.dados?.marcadores || [],
    ouvintes: [], salvarPosicao: null, zoom: 1,
  };
  aplicarPrefs();
  ouvir(document, 'click', aoClicar);
  ouvir(document, 'input', aoMudar);
  ouvir(document, 'change', aoMudar);
  ouvir(document, 'keydown', aoTeclar);
  ouvir(document, 'selectionchange', aoSelecionar);
  ouvir(window, 'resize', () => { clearTimeout(L.tempoResize); L.tempoResize = setTimeout(() => { aplicarPrefs(); relayout(); }, 150); });
  ouvir(window, 'pagehide', gravarPosicaoAgora);
  ouvir(document, 'visibilitychange', () => { if (document.hidden) gravarPosicaoAgora(); });
  ligarGestos();
  try {
    const blob = await arquivoGuardado(artigo.pdf_path);
    if (L?.montagem !== montagem) return;
    if (L.formato === 'epub') await abrirLivroEpub(blob, montagem);
    else await abrirLivroPdf(blob, montagem);
    if (L?.montagem !== montagem) return;
    el('lv-carregando')?.remove();
    if (artigo.status === 'ler') mudarArtigo({ status: 'lendo' });
  } catch (erro) {
    console.warn('Leitor:', erro);
    const c = el('lv-carregando');
    if (c) c.textContent = navigator.onLine ? (erro.message || 'Não consegui abrir este livro.') : 'Sem internet, e este livro ainda não foi aberto neste aparelho. Abra uma vez com internet para ler offline depois.';
  }
}

export function desmontarLeitor() {
  if (!L) return;
  gravarPosicaoAgora();
  gravarTintaAgora();
  for (const [alvo, tipo, fn] of L.ouvintes) alvo.removeEventListener(tipo, fn);
  L.epub?.fechar();
  L.pdf?.destroy?.();
  L.editor?.destruir();
  clearTimeout(L.tempoResize);
  document.body.classList.remove('modo-editor', 'modo-leitor');
  L = null;
}

function ouvir(alvo, tipo, fn, opcoes) {
  alvo.addEventListener(tipo, fn, opcoes);
  L.ouvintes.push([alvo, tipo, fn]);
}

async function mudarArtigo(campos) {
  const atual = await obter('artigos', L.artigo.id);
  if (!atual) return;
  const novo = { ...atual, ...campos, dados: { ...(atual.dados || {}), ...(campos.dados || {}) } };
  L.artigo = await salvar('artigos', novo);
}

// ---------------------------------------------------------------------------
// Aparência
// ---------------------------------------------------------------------------

function temaEfetivo() {
  if (L.prefs.tema !== 'auto') return L.prefs.tema;
  return document.documentElement.dataset.tema === 'claro' || (!document.documentElement.dataset.tema && matchMedia('(prefers-color-scheme: light)').matches) ? 'claro' : 'escuro';
}

function aplicarPrefs() {
  const leitor = el('lv');
  if (!leitor) return;
  const p = L.prefs;
  for (const t of ['claro', 'sepia', 'escuro', 'preto']) leitor.classList.toggle(`lv-tema-${t}`, temaEfetivo() === t);
  leitor.classList.toggle('lv-rolagem', p.modo === 'rolagem');
  leitor.classList.toggle('lv-pdf-noite', p.pdfNoite);
  leitor.style.setProperty('--leitor-fonte', FONTES_LEITOR.find((f) => f.id === p.fonte).css);
  leitor.style.setProperty('--leitor-tamanho', `${p.tamanho}px`);
  leitor.style.setProperty('--leitor-linhas', String(p.linhas));
  leitor.style.setProperty('--leitor-margem', `${MARGENS_LEITOR.find((m) => m.id === p.margens).px}px`);
  leitor.style.setProperty('--leitor-alinhamento', p.justificado ? 'justify' : 'left');
  el('lv-brilho').style.opacity = String(Math.round((1 - p.brilho) * 100) / 100);
  const topo = leitor.querySelector('.lv-topo');
  if (topo) leitor.style.setProperty('--lv-topo', `${topo.offsetHeight}px`);
}

// ---------------------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------------------

async function abrirLivroEpub(blob, montagem) {
  L.epub = await abrirEpub(blob);
  if (L?.montagem !== montagem) return;
  const pos = L.artigo.dados?.posicao;
  await abrirCapitulo(Math.min(L.epub.capitulos.length - 1, Number(pos?.capitulo) || 0), { fracao: Number(pos?.fracao) || 0 });
}

async function abrirCapitulo(i, { fracao = 0, fim = false, ancora = '', offset = null } = {}) {
  const c = await L.epub.capitulo(i);
  if (!c || !L) return;
  L.capitulo = i;
  L.textoCapitulo = c.texto;
  const texto = el('lv-livro-texto');
  texto.replaceChildren(...c.elemento.childNodes);
  marcarDestaques();
  // As imagens mudam o tamanho das páginas quando terminam de carregar.
  for (const img of texto.querySelectorAll('img')) if (!img.complete) img.addEventListener('load', () => relayout(), { once: true });
  layoutEpub();
  if (offset !== null) irParaOffset(offset);
  else if (ancora && texto.querySelector(`#l-${CSS.escape(ancora.replace(/[^\w-]/g, '_'))}`)) irParaElemento(texto.querySelector(`#l-${CSS.escape(ancora.replace(/[^\w-]/g, '_'))}`));
  else if (fim) irParaPaginaEpub(L.paginas - 1);
  else irParaFracao(fracao);
}

// Páginas: o texto corre em colunas da largura da janela; virar é deslocar uma coluna.
function layoutEpub() {
  const janela = el('lv-janela');
  const texto = el('lv-livro-texto');
  if (!janela || !texto) return;
  if (L.prefs.modo === 'rolagem') {
    texto.style.columnWidth = '';
    texto.style.height = '';
    texto.style.transform = '';
    texto.style.width = '';
    texto.style.paddingLeft = '';
    texto.style.paddingRight = '';
    L.largura = janela.clientWidth;
    L.paginas = 1;
    return;
  }
  const largura = janela.clientWidth;
  const altura = janela.clientHeight;
  // Linha boa de ler: até ~70 letras. Tela larga (tablet deitado, computador) mostra duas
  // páginas lado a lado, como o Kindle; a sobra vira margem.
  // Conta: cada página tem exatamente a largura da janela (margem + colunas + vãos + margem),
  // então o vão entre colunas é o dobro da margem e virar é deslocar uma largura inteira.
  const colunas = largura >= 1000 ? 2 : 1;
  const preferida = MARGENS_LEITOR.find((m) => m.id === L.prefs.margens).px;
  const maxColuna = L.prefs.tamanho * 36;
  const coluna = Math.min(maxColuna, (largura - preferida * 2 * colunas) / colunas);
  const margem = (largura - coluna * colunas) / (2 * colunas);
  const vao = margem * 2;
  L.largura = largura;
  texto.style.width = `${largura}px`;
  texto.style.height = `${altura}px`;
  texto.style.paddingLeft = `${margem}px`;
  texto.style.paddingRight = `${margem}px`;
  texto.style.columnWidth = `${coluna}px`;
  // O vão entre a última coluna de uma página e a primeira da outra é a soma das margens.
  texto.style.columnGap = `${vao}px`;
  texto.classList.toggle('lv-duas', colunas === 2);
  texto.style.setProperty('--leitor-img-max', `${Math.max(120, altura - 80)}px`);
  L.paginas = Math.max(1, Math.round(texto.scrollWidth / largura));
}

function relayout() {
  if (!L) return;
  if (L.formato === 'pdf') return mostrarPaginaPdf(L.pagina);
  const fracao = fracaoAtual();
  aplicarPrefs();
  layoutEpub();
  irParaFracao(fracao);
  return null;
}

function fracaoAtual() {
  if (L.prefs.modo === 'rolagem') {
    const j = el('lv-janela');
    return j && j.scrollHeight > j.clientHeight ? j.scrollTop / (j.scrollHeight - j.clientHeight) : 0;
  }
  return L.paginas > 1 ? (L.pagina || 0) / L.paginas : 0;
}

function irParaFracao(fracao) {
  if (L.prefs.modo === 'rolagem') {
    const j = el('lv-janela');
    j.scrollTop = fracao * (j.scrollHeight - j.clientHeight);
    depoisDeAndar();
    return;
  }
  irParaPaginaEpub(Math.min(L.paginas - 1, Math.floor(fracao * L.paginas + 0.0001)));
}

function irParaPaginaEpub(n) {
  L.pagina = Math.max(0, Math.min(L.paginas - 1, n));
  el('lv-livro-texto').style.transform = `translateX(${-L.pagina * L.largura}px)`;
  depoisDeAndar();
}

// Em que página (coluna) está um elemento ou um ponto do texto.
function paginaDoRetangulo(r) {
  const base = el('lv-janela').getBoundingClientRect().left;
  return Math.max(0, Math.floor((r.left - base + 2) / L.largura) + (L.pagina || 0));
}

function irParaElemento(alvo) {
  if (L.prefs.modo === 'rolagem') {
    alvo.scrollIntoView({ block: 'start' });
    depoisDeAndar();
    return;
  }
  irParaPaginaEpub(paginaDoRetangulo(alvo.getBoundingClientRect()));
}

function irParaOffset(offset) {
  const r = rangeDoOffset(offset, offset + 1);
  const rect = r?.getClientRects()[0];
  if (!rect) return irParaFracao(0);
  if (L.prefs.modo === 'rolagem') {
    const j = el('lv-janela');
    j.scrollTop += rect.top - j.getBoundingClientRect().top - 80;
    depoisDeAndar();
    return null;
  }
  irParaPaginaEpub(paginaDoRetangulo(rect));
  return null;
}

async function proxima() {
  if (L.formato === 'pdf') return irParaPaginaPdf(L.pagina + 1);
  if (L.prefs.modo === 'rolagem') {
    const j = el('lv-janela');
    if (j.scrollTop + j.clientHeight < j.scrollHeight - 4) { j.scrollBy({ top: j.clientHeight * 0.9, behavior: movimento() }); return null; }
  } else if (L.pagina < L.paginas - 1) return irParaPaginaEpub(L.pagina + 1);
  if (L.capitulo < L.epub.capitulos.length - 1) await abrirCapitulo(L.capitulo + 1);
  else aviso('Fim do livro. 🎉 Quer marcar como lido? Está no ⋯.');
  return null;
}

async function anterior() {
  if (L.formato === 'pdf') return irParaPaginaPdf(L.pagina - 1);
  if (L.prefs.modo === 'rolagem') {
    const j = el('lv-janela');
    if (j.scrollTop > 4) { j.scrollBy({ top: -j.clientHeight * 0.9, behavior: movimento() }); return null; }
  } else if (L.pagina > 0) return irParaPaginaEpub(L.pagina - 1);
  if (L.capitulo > 0) await abrirCapitulo(L.capitulo - 1, { fim: true });
  return null;
}

const movimento = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// ---------------------------------------------------------------------------
// Destaques (EPUB): posições no texto do capítulo, marcadas por cima
// ---------------------------------------------------------------------------

function nosDeTexto() {
  const raiz = el('lv-livro-texto');
  const lista = [];
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (andar.nextNode()) {
    const n = andar.currentNode;
    lista.push({ n, ini: total, fim: total + n.length });
    total += n.length;
  }
  return lista;
}

function rangeDoOffset(ini, fim) {
  const nos = nosDeTexto();
  const a = nos.find((x) => ini >= x.ini && ini < x.fim) || nos[nos.length - 1];
  const b = nos.find((x) => fim > x.ini && fim <= x.fim) || nos[nos.length - 1];
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.n, Math.max(0, Math.min(a.n.length, ini - a.ini)));
  r.setEnd(b.n, Math.max(0, Math.min(b.n.length, fim - b.ini)));
  return r;
}

function offsetDe(no, deslocamento) {
  const nos = nosDeTexto();
  if (no.nodeType !== 3) {
    // Seleção que termina num elemento: conta o texto até o filho indicado.
    const filho = no.childNodes[deslocamento];
    const prox = filho ? nos.find((x) => filho.contains(x.n) || filho === x.n) : null;
    if (prox) return prox.ini;
    const dentro = nos.filter((x) => no.contains(x.n));
    return dentro.length ? dentro[dentro.length - 1].fim : 0;
  }
  const x = nos.find((y) => y.n === no);
  return x ? x.ini + deslocamento : 0;
}

function marcarDestaques() {
  const lista = destaquesDoCapitulo(L.artigo.destaques, L.capitulo).sort((a, b) => b.inicio - a.inicio);
  for (const d of lista) {
    const nos = nosDeTexto().filter((x) => x.fim > d.inicio && x.ini < d.fim);
    for (const x of nos.reverse()) {
      const r = document.createRange();
      r.setStart(x.n, Math.max(0, d.inicio - x.ini));
      r.setEnd(x.n, Math.min(x.n.length, d.fim - x.ini));
      if (r.collapsed || !r.toString().trim()) continue;
      const marca = document.createElement('mark');
      marca.className = `destaque destaque-${CORES_DESTAQUE.some((c) => c.id === d.cor) ? d.cor : 'amarelo'}${d.nota ? ' com-nota' : ''}`;
      marca.dataset.destaque = d.id;
      try { r.surroundContents(marca); } catch { /* pedaço que não dá para embrulhar: segue */ }
    }
  }
}

// Redesenha o capítulo com as marcas novas sem sair da página.
function remarcar() {
  const texto = el('lv-livro-texto');
  for (const m of [...texto.querySelectorAll('mark[data-destaque]')]) m.replaceWith(...m.childNodes);
  texto.normalize();
  marcarDestaques();
}

function selecaoNoTexto() {
  const s = document.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const r = s.getRangeAt(0);
  const texto = el('lv-livro-texto');
  if (!texto || !texto.contains(r.commonAncestorContainer)) return null;
  const inicio = offsetDe(r.startContainer, r.startOffset);
  const fim = offsetDe(r.endContainer, r.endOffset);
  const trecho = r.toString().replace(/\s+/g, ' ').trim();
  return fim > inicio && trecho ? { inicio, fim, trecho, rect: r.getBoundingClientRect() } : null;
}

function aoSelecionar() {
  if (!L || L.formato !== 'epub') return;
  clearTimeout(L.tempoSelecao);
  L.tempoSelecao = setTimeout(() => {
    const s = selecaoNoTexto();
    if (s) mostrarMenu(s.rect, { selecao: s });
    else if (!L.menuDestaque) esconderMenu();
  }, 180);
}

function mostrarMenu(rect, { selecao = null, destaque = null } = {}) {
  const menu = el('lv-menu');
  L.selecao = selecao;
  L.menuDestaque = destaque;
  menu.querySelector('[data-leitor="tirar-destaque"]').hidden = !destaque;
  menu.querySelector('[data-leitor="copiar"]').hidden = Boolean(destaque);
  menu.hidden = false;
  const palco = el('lv').getBoundingClientRect();
  const largura = menu.offsetWidth;
  const x = Math.max(8, Math.min(palco.width - largura - 8, rect.left - palco.left + rect.width / 2 - largura / 2));
  const acima = rect.top - palco.top - menu.offsetHeight - 10;
  menu.style.left = `${x}px`;
  menu.style.top = `${acima > 60 ? acima : rect.bottom - palco.top + 10}px`;
}

function esconderMenu() {
  const menu = el('lv-menu');
  if (menu) menu.hidden = true;
  if (L) { L.selecao = null; L.menuDestaque = null; }
}

function rotuloDoLugar() {
  if (L.formato === 'pdf') return `página ${L.pagina}`;
  return `${tituloDoCapitulo()} · ${textoPct(porcentagemEpub(L.epub.capitulos, { capitulo: L.capitulo, fracao: fracaoAtual() }))}`;
}

async function destacar(cor) {
  if (L.menuDestaque) {
    await mudarArtigo({ destaques: (L.artigo.destaques || []).map((d) => (d.id === L.menuDestaque ? { ...d, cor } : d)) });
    remarcar();
    esconderMenu();
    return null;
  }
  const s = L.selecao || selecaoNoTexto();
  if (!s) return null;
  const d = novoDestaque({ texto: s.trecho, cor, capitulo: L.capitulo, inicio: s.inicio, fim: s.fim, rotulo: rotuloDoLugar() });
  await mudarArtigo({ destaques: [...(L.artigo.destaques || []), d] });
  document.getSelection()?.removeAllRanges();
  esconderMenu();
  remarcar();
  return d;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function abrirLivroPdf(blob, montagem) {
  L.pdf = await abrirPdf(blob);
  if (L?.montagem !== montagem) return;
  L.total = L.pdf.numPages;
  L.zoom = Number(L.artigo.dados?.zoom) || 1;
  L.ajuste = L.artigo.dados?.ajuste === 'largura' ? 'largura' : 'pagina';
  L.editor = new EditorDeTinta(el('lv-pdf'), { aoMudar: () => agendarTinta() });
  L.editor.tinta = 'livro-preto';
  L.editor.tintaMarca = 'amarelo';
  L.editor.tamanho = 3;
  L.tintas = new Map((await listar('livro_paginas')).filter((p) => p.artigo_id === L.artigo.id).map((p) => [p.pagina, p]));
  await irParaPaginaPdf(Math.min(L.total, Math.max(1, Number(L.artigo.dados?.posicao?.pagina) || 1)));
}

async function irParaPaginaPdf(n) {
  if (n < 1 || n > L.total) {
    if (n > L.total) aviso('Fim do livro. 🎉 Quer marcar como lido? Está no ⋯.');
    return;
  }
  gravarTintaAgora();
  L.pagina = n;
  await mostrarPaginaPdf(n);
  el('lv-pdf').scrollTop = 0;
  depoisDeAndar();
  // A próxima página já fica pronta (virar sem esperar).
  if (n < L.total) imagemDaPagina(n + 1).catch(() => {});
}

const imagensPdf = new Map();
function imagemDaPagina(n) {
  const largura = Math.min(2000, Math.round((el('lv-pdf')?.clientWidth || 900) * (window.devicePixelRatio || 1) * (L.zoom || 1)));
  const chave = `${L.artigo.id}:${n}:${largura}`;
  if (!imagensPdf.has(chave)) {
    imagensPdf.set(chave, (async () => {
      const pagina = await L.pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: largura / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vista.width);
      canvas.height = Math.round(vista.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
      return { imagem: await createImageBitmap(canvas), proporcao: base.height / base.width };
    })());
    // Guarda poucas páginas na memória do tablet.
    if (imagensPdf.size > 6) imagensPdf.delete(imagensPdf.keys().next().value);
  }
  return imagensPdf.get(chave);
}

async function mostrarPaginaPdf(n) {
  if (!L?.editor) return;
  const { imagem, proporcao } = await imagemDaPagina(n);
  if (!L || L.pagina !== n) return;
  const dim = { largura: 1000, altura: Math.round(1000 * proporcao), mm: 1000 / 210 };
  const guardada = L.tintas.get(n);
  const json = guardada?.tracos_json?.camadas ? guardada.tracos_json : novaPaginaVazia('pdf');
  json.modelo = 'pdf';
  // Página inteira na tela (padrão, bom no tablet deitado) ou na largura; o zoom multiplica.
  const area = el('lv-pdf');
  const base = Math.min(area.clientWidth - 2, 900) / dim.largura;
  const cabe = (area.clientHeight - 36) / (dim.altura * base);
  L.editor.zoom = (L.ajuste === 'largura' ? 1 : Math.min(1, Math.max(0.3, cabe))) * L.zoom;
  el('lv')?.classList.toggle('lv-pdf-zoom', L.zoom > 1);
  L.editor.carregar(json, dim);
  L.editor.definirImagemDeFundo(imagem);
}

function agendarTinta() {
  clearTimeout(L.tempoTinta);
  L.tintaPendente = L.pagina;
  L.tempoTinta = setTimeout(gravarTintaAgora, 900);
}

function gravarTintaAgora() {
  if (!L?.editor || L.tintaPendente == null) return;
  clearTimeout(L.tempoTinta);
  const pagina = L.tintaPendente;
  L.tintaPendente = null;
  const atual = L.tintas.get(pagina);
  const registro = { ...(atual || {}), artigo_id: L.artigo.id, pagina, tracos_json: L.editor.pagina };
  const tintas = L.tintas;
  salvar('livro_paginas', registro).then((r) => tintas.set(pagina, r)).catch((e) => console.warn('Tinta não salva:', e));
}

function alternarCaneta() {
  const leitor = el('lv');
  const ligada = !leitor.classList.contains('com-caneta');
  leitor.classList.toggle('com-caneta', ligada);
  el('lv-caneta').hidden = !ligada;
  document.querySelector('[data-leitor="caneta"][aria-pressed]')?.setAttribute('aria-pressed', String(ligada));
  if (ligada) fecharPainel();
  else gravarTintaAgora();
  aviso(ligada ? 'Caneta ligada: escreva com a S Pen. O dedo continua virando a página.' : 'Caneta guardada.');
}

// ---------------------------------------------------------------------------
// Andar, progresso e onde parou
// ---------------------------------------------------------------------------

function posicaoAtual() {
  return L.formato === 'pdf' ? { pagina: L.pagina } : { capitulo: L.capitulo, fracao: Math.round(fracaoAtual() * 1000) / 1000 };
}

function pctAtual() {
  return L.formato === 'pdf' ? porcentagemPdf(L.pagina, L.total) : porcentagemEpub(L.epub.capitulos, posicaoAtual());
}

function tituloDoCapitulo() {
  if (L.formato === 'pdf') return L.sumarioPdf?.filter((s) => s.pagina <= L.pagina).pop()?.titulo || '';
  const item = L.epub.sumario.filter((s) => s.capitulo <= L.capitulo).pop();
  return item?.titulo || `Parte ${L.capitulo + 1}`;
}

function depoisDeAndar() {
  if (!L) return;
  esconderMenu();
  const pct = pctAtual();
  const barra = el('lv-barra');
  if (barra && document.activeElement !== barra) barra.value = String(Math.round(pct * 1000));
  let tempo;
  if (L.formato === 'pdf') {
    const fimCap = L.sumarioPdf?.find((s) => s.pagina > L.pagina)?.pagina;
    const capitulo = fimCap ? Math.round((fimCap - L.pagina) * MIN_POR_PAGINA_PDF) : null;
    const livro = Math.round((L.total - L.pagina) * MIN_POR_PAGINA_PDF);
    tempo = innerWidth < 520
      ? `Página ${L.pagina} de ${L.total} · ${textoTempo(capitulo ?? livro)} ${capitulo !== null ? 'no capítulo' : 'no livro'}`
      : `Página ${L.pagina} de ${L.total} · ${capitulo !== null ? `${textoTempo(capitulo)} para acabar o capítulo · ` : ''}${textoTempo(livro)} para acabar o livro`;
  } else {
    const t = tempoRestanteEpub(L.epub.capitulos, posicaoAtual(), L.textoCapitulo.length);
    tempo = innerWidth < 520
      ? `${textoTempo(t.capitulo)} no capítulo · ${textoPct(pct)}`
      : `${textoTempo(t.capitulo)} para acabar o capítulo · ${textoTempo(t.livro)} para acabar o livro · ${textoPct(pct)}`;
  }
  const t = el('lv-tempo');
  if (t) t.textContent = tempo;
  const onde = el('lv-onde');
  if (onde) onde.textContent = tituloDoCapitulo();
  const marcado = Boolean(marcadorAqui(L.marcadores, L.formato, posicaoAtual(), 1 / Math.max(2, L.paginas || 2)));
  document.querySelector('[data-leitor="marcador"]')?.setAttribute('aria-pressed', String(marcado));
  clearTimeout(L.salvarPosicao);
  L.salvarPosicao = setTimeout(gravarPosicaoAgora, 1500);
}

function gravarPosicaoAgora() {
  if (!L || L.capitulo === undefined && L.pagina === undefined) return;
  clearTimeout(L.salvarPosicao);
  const posicao = posicaoAtual();
  const pct = pctAtual();
  const antes = L.artigo.dados?.posicao;
  if (antes && JSON.stringify(antes) === JSON.stringify(posicao)) return;
  mudarArtigo({ dados: { posicao, pct, ultima_leitura: new Date().toISOString(), ...(L.formato === 'pdf' ? { zoom: L.zoom, ajuste: L.ajuste } : {}) } }).catch(() => {});
  notarLivro(L.artigo, `${textoPct(pct)} lido`);
}

// ---------------------------------------------------------------------------
// Painéis: sumário, busca, ajustes, marcadores e destaques, IA, nota
// ---------------------------------------------------------------------------

function abrirPainel(titulo, html) {
  el('lv-painel-titulo').textContent = titulo;
  el('lv-painel-corpo').innerHTML = html;
  el('lv-painel').hidden = false;
  el('lv').classList.add('com-painel');
  esconderMenu();
}

function fecharPainel() {
  el('lv-painel').hidden = true;
  el('lv')?.classList.remove('com-painel');
  L.painel = null;
}

async function painelSumario() {
  L.painel = 'sumario';
  let itens;
  if (L.formato === 'pdf') {
    await carregarSumarioPdf();
    itens = L.sumarioPdf.map((s) => ({ titulo: s.titulo, nivel: s.nivel, attrs: `data-pagina="${s.pagina}"`, atual: s === L.sumarioPdf.filter((x) => x.pagina <= L.pagina).pop(), extra: `p. ${s.pagina}` }));
  } else {
    const atual = L.epub.sumario.filter((s) => s.capitulo <= L.capitulo).pop();
    itens = L.epub.sumario.map((s, i) => ({ titulo: s.titulo, nivel: s.nivel, attrs: `data-sumario="${i}"`, atual: s === atual, extra: '' }));
  }
  abrirPainel('Sumário', itens.length
    ? `<ol class="lv-lista">${itens.map((s) => `<li><button type="button" class="lv-item nivel-${Math.min(3, s.nivel)}" data-leitor="ir" ${s.attrs}${s.atual ? ' aria-current="true"' : ''}><span>${esc(s.titulo)}</span>${s.extra ? `<small>${esc(s.extra)}</small>` : ''}</button></li>`).join('')}</ol>`
    : '<p class="texto-suave">Este livro não tem sumário.</p>');
  el('lv-painel-corpo').querySelector('[aria-current]')?.scrollIntoView({ block: 'center' });
}

async function carregarSumarioPdf() {
  if (L.sumarioPdf) return;
  const lista = [];
  try {
    const andar = async (itens, nivel) => {
      for (const it of itens || []) {
        let pagina = null;
        try {
          const destino = typeof it.dest === 'string' ? await L.pdf.getDestination(it.dest) : it.dest;
          if (destino?.[0]) pagina = (await L.pdf.getPageIndex(destino[0])) + 1;
        } catch { /* item sem página */ }
        if (pagina) lista.push({ titulo: String(it.title || '').trim() || 'Sem título', pagina, nivel });
        if (lista.length < 300) await andar(it.items, nivel + 1);
      }
    };
    await andar(await L.pdf.getOutline(), 0);
  } catch { /* PDF sem sumário */ }
  L.sumarioPdf = lista;
}

function painelBusca() {
  L.painel = 'busca';
  abrirPainel('Buscar no livro', `
    <form class="lv-busca" data-form="lv-busca" novalidate>
      <label class="visualmente-oculto" for="lv-busca-termo">Palavra ou trecho</label>
      <input id="lv-busca-termo" type="search" placeholder="Palavra ou trecho" value="${esc(L.ultimaBusca || '')}" autocomplete="off">
      <button class="botao botao-primario botao-pequeno" type="submit">Buscar</button>
    </form>
    <div id="lv-busca-resultado" aria-live="polite"></div>`);
  el('lv-busca-termo').focus();
}

async function buscar(termo) {
  L.ultimaBusca = termo;
  const saida = el('lv-busca-resultado');
  saida.innerHTML = '<p class="texto-suave">Procurando…</p>';
  const minha = Symbol('busca');
  L.busca = minha;
  const achados = [];
  const total = L.formato === 'pdf' ? L.total : L.epub.capitulos.length;
  L.textosPdf ||= new Map();
  for (let i = 0; i < total && achados.length < 60; i += 1) {
    if (L?.busca !== minha) return;
    let texto;
    if (L.formato === 'pdf') {
      if (!L.textosPdf.has(i + 1)) {
        const pagina = await L.pdf.getPage(i + 1);
        L.textosPdf.set(i + 1, (await pagina.getTextContent()).items.map((x) => x.str).join(' '));
      }
      texto = L.textosPdf.get(i + 1);
    } else {
      texto = i === L.capitulo ? textoDoDom() : (await L.epub.capitulo(i))?.elemento.textContent || '';
    }
    for (const a of buscarNoTexto(texto, termo, 60 - achados.length)) achados.push({ ...a, lugar: i });
    if (i % 5 === 4) saida.innerHTML = `<p class="texto-suave">Procurando… ${Math.round(((i + 1) / total) * 100)}%</p>`;
  }
  if (L?.busca !== minha) return;
  saida.innerHTML = achados.length
    ? `<p class="campo-ajuda">${achados.length >= 60 ? 'Os primeiros 60 resultados' : `${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'}`}.</p>
       <ol class="lv-lista">${achados.map((a) => `<li><button type="button" class="lv-item" data-leitor="ir" ${L.formato === 'pdf' ? `data-pagina="${a.lugar + 1}"` : `data-capitulo="${a.lugar}" data-offset="${a.inicio}"`}><span>${esc(a.trecho)}</span><small>${L.formato === 'pdf' ? `p. ${a.lugar + 1}` : esc(nomeDoCapitulo(a.lugar))}</small></button></li>`).join('')}</ol>`
    : '<p class="texto-suave">Nada com esse termo.</p>';
}

const textoDoDom = () => el('lv-livro-texto')?.textContent || '';
const nomeDoCapitulo = (i) => L.epub.sumario.filter((s) => s.capitulo <= i).pop()?.titulo || `Parte ${i + 1}`;

function painelAjustesAbrir() {
  L.painel = 'ajustes';
  abrirPainel('Ajustes de leitura', painelAjustes(L.prefs, L.formato === 'pdf', L.zoom, L.ajuste));
}

function painelMais() {
  L.painel = 'mais';
  const marcadores = L.marcadores;
  const destaques = (L.artigo.destaques || []).filter((d) => L.formato === 'pdf' || Number.isFinite(d.capitulo));
  const anotadas = L.formato === 'pdf' ? [...(L.tintas?.values() || [])].filter((p) => !p.excluido_em && p.tracos_json?.camadas?.some((c) => c.itens?.length)).map((p) => p.pagina).sort((a, b) => a - b) : [];
  abrirPainel('Marcadores e destaques', `
    <h3 class="lv-subtitulo">Marcadores</h3>
    ${marcadores.length ? `<ol class="lv-lista">${marcadores.map((m) => `<li class="lv-linha-item"><button type="button" class="lv-item" data-leitor="ir-marcador" data-chave="${esc(m.chave)}"><span>${esc(m.rotulo || 'Marcador')}</span></button>
      <button class="lv-botao" type="button" data-leitor="tirar-marcador" data-id="${esc(m.id)}" aria-label="Tirar marcador">×</button></li>`).join('')}</ol>` : '<p class="texto-suave">Toque em 🔖 para marcar a página em que está.</p>'}
    ${L.formato === 'pdf' ? `<h3 class="lv-subtitulo">Páginas com anotações</h3>
      ${anotadas.length ? `<div class="lv-paginas">${anotadas.map((n) => `<button class="botao botao-secundario botao-pequeno" type="button" data-leitor="ir" data-pagina="${n}">p. ${n}</button>`).join('')}</div>` : '<p class="texto-suave">Com a caneta (✎) você rabisca, destaca e anota em cima das páginas.</p>'}` : `
    <h3 class="lv-subtitulo">Destaques</h3>
    ${destaques.length ? `<ol class="lv-lista">${destaques.map((d) => `<li><button type="button" class="lv-item" data-leitor="ir" data-capitulo="${d.capitulo}" data-offset="${d.inicio}"><span class="lv-trecho destaque-${esc(d.cor || 'amarelo')}">${esc(d.texto)}</span>${d.nota ? `<small>Nota: ${esc(d.nota)}</small>` : ''}<small>${esc(d.onde || '')}</small></button></li>`).join('')}</ol>
      <p class="campo-ajuda">Os destaques também ficam na Biblioteca, em "Destaques e notas", e dá para levar para o fichamento.</p>` : '<p class="texto-suave">Selecione um trecho e escolha uma cor.</p>'}`}
    <div class="acoes lv-so-celular"><button class="botao botao-secundario botao-pequeno" type="button" data-leitor="painel-busca">Buscar no livro</button></div>
    <h3 class="lv-subtitulo">IA</h3>
    <div class="acoes">
      ${L.formato === 'epub' ? '<button class="botao botao-secundario botao-pequeno" type="button" data-leitor="resumir">Resumo deste capítulo</button>' : ''}
      <button class="botao botao-secundario botao-pequeno" type="button" data-leitor="questoes">Gerar questões ${L.formato === 'epub' ? 'deste capítulo' : 'destas páginas'}</button>
    </div>
    <h3 class="lv-subtitulo">Livro</h3>
    <div class="acoes">
      ${L.artigo.status === 'lido' || L.artigo.status === 'fichado' ? '' : '<button class="botao botao-secundario botao-pequeno" type="button" data-leitor="lido">Marcar como lido</button>'}
      <a class="botao botao-secundario botao-pequeno" href="#biblioteca/${esc(L.artigo.id)}">Notas e fichamento</a>
    </div>`);
}

function painelNota(destaqueId) {
  const d = (L.artigo.destaques || []).find((x) => x.id === destaqueId);
  if (!d) return;
  L.painel = 'nota';
  abrirPainel('Nota do destaque', `
    <blockquote class="lv-trecho destaque-${esc(d.cor || 'amarelo')}">${esc(d.texto)}</blockquote>
    <label class="campo"><span class="campo-rotulo">Sua nota</span>
      <textarea rows="5" maxlength="2000" data-leitor-nota="${esc(d.id)}" placeholder="O que esse trecho significa para você?">${esc(d.nota || '')}</textarea></label>
    <p class="campo-ajuda">Salva sozinha.</p>`);
  el('lv-painel-corpo').querySelector('textarea').focus();
}

async function explicar() {
  const s = L.selecao || selecaoNoTexto();
  const destaque = L.menuDestaque && (L.artigo.destaques || []).find((d) => d.id === L.menuDestaque);
  const trecho = s?.trecho || destaque?.texto;
  if (!trecho) return;
  const centro = s?.inicio ?? destaque?.inicio ?? 0;
  const contexto = textoDoDom().slice(Math.max(0, centro - 1500), centro + 1500);
  esconderMenu();
  L.painel = 'ia';
  abrirPainel('Explicar o trecho', `<blockquote class="lv-trecho">${esc(trecho)}</blockquote><p class="texto-suave" role="status">A IA está lendo…</p>`);
  const r = await chamar('livro-ia', { acao: 'explicar', trecho, contexto, livro: `${L.artigo.titulo}${L.artigo.autor ? `, de ${L.artigo.autor}` : ''}` });
  if (L?.painel !== 'ia') return;
  el('lv-painel-corpo').innerHTML = `<blockquote class="lv-trecho">${esc(trecho)}</blockquote>
    ${r.ok ? `<p>${esc(r.explicacao)}</p>${r.exemplo ? `<p class="campo-ajuda"><strong>Exemplo:</strong> ${esc(r.exemplo)}</p>` : ''}
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-leitor="guardar-ia">Guardar nas notas do livro</button></div>`
    : `<p class="ava-alerta" role="alert">${esc(r.erro || 'A IA não respondeu.')}</p>`}`;
  L.ultimaIa = r.ok ? `"${trecho}"\n${r.explicacao}${r.exemplo ? `\nExemplo: ${r.exemplo}` : ''}` : null;
}

async function resumir() {
  L.painel = 'ia';
  const capitulo = tituloDoCapitulo();
  abrirPainel('Resumo do capítulo', '<p class="texto-suave" role="status">A IA está lendo o capítulo…</p>');
  const r = await chamar('livro-ia', { acao: 'resumir', texto: textoDoDom().slice(0, 80000), capitulo, livro: L.artigo.titulo });
  if (L?.painel !== 'ia') return;
  el('lv-painel-corpo').innerHTML = r.ok
    ? `<p><strong>${esc(capitulo)}</strong></p><p>${esc(r.resumo)}</p>${r.pontos.length ? `<ul>${r.pontos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
       <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-leitor="guardar-ia">Guardar nas notas do livro</button></div>`
    : `<p class="ava-alerta" role="alert">${esc(r.erro || 'A IA não respondeu.')}</p>`;
  L.ultimaIa = r.ok ? `Resumo de ${capitulo}:\n${r.resumo}\n${r.pontos.map((p) => `• ${p}`).join('\n')}` : null;
}

async function textoParaQuestoes() {
  if (L.formato === 'epub') return textoDoDom();
  const partes = [];
  for (let n = L.pagina; n <= Math.min(L.total, L.pagina + 9); n += 1) {
    const pagina = await L.pdf.getPage(n);
    partes.push((await pagina.getTextContent()).items.map((x) => x.str).join(' '));
  }
  return partes.join('\n\n');
}

// ---------------------------------------------------------------------------
// Toques, gestos e teclado
// ---------------------------------------------------------------------------

function ligarGestos() {
  const palco = el('lv-palco');
  if (!palco) return;
  let inicio = null;
  ouvir(palco, 'pointerdown', (e) => {
    if (e.target.closest('a, button, mark, input')) { inicio = null; return; }
    if (el('lv').classList.contains('com-caneta') && (e.pointerType === 'pen' || L.editor?.dedoDesenha)) { inicio = null; return; }
    inicio = { x: e.clientX, y: e.clientY, t: Date.now(), tipo: e.pointerType };
  });
  ouvir(palco, 'pointercancel', () => { inicio = null; });
  ouvir(palco, 'pointerup', (e) => {
    if (!inicio || !L) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    const rapido = Date.now() - inicio.t < 600;
    const s = inicio;
    inicio = null;
    if (!document.getSelection()?.isCollapsed) return; // selecionando texto
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && rapido && L.prefs.modo !== 'rolagem') {
      if (dx < 0) proxima(); else anterior();
      return;
    }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || !rapido || s.tipo === 'pen' && el('lv').classList.contains('com-caneta')) return;
    if (!el('lv-menu').hidden) { esconderMenu(); return; }
    if (!el('lv-painel').hidden && innerWidth < 1000) { fecharPainel(); return; }
    const r = palco.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.25) anterior();
    else if (x > 0.75) proxima();
    else el('lv').classList.toggle('lv-calmo');
  });
  // Toque numa palavra destacada: muda a cor, nota, explicar ou tirar.
  ouvir(palco, 'click', (e) => {
    const marca = e.target.closest('mark[data-destaque]');
    if (marca && document.getSelection()?.isCollapsed) mostrarMenu(marca.getBoundingClientRect(), { destaque: marca.dataset.destaque });
    const link = e.target.closest('a[data-livro-link]');
    if (link) {
      e.preventDefault();
      const [caminho, frag] = link.dataset.livroLink.split('#');
      const i = L.epub.indiceDe(caminho);
      if (i === L.capitulo && frag) {
        const alvo = el('lv-livro-texto').querySelector(`#l-${CSS.escape(frag.replace(/[^\w-]/g, '_'))}`);
        if (alvo) irParaElemento(alvo);
      } else if (i >= 0) abrirCapitulo(i, { ancora: frag });
    }
  });
  const janela = el('lv-janela');
  if (janela) ouvir(janela, 'scroll', () => { if (L?.prefs.modo === 'rolagem') { clearTimeout(L.tempoRolar); L.tempoRolar = setTimeout(depoisDeAndar, 200); } }, { passive: true });
}

function aoTeclar(e) {
  if (!L || e.target.closest?.('input, textarea, select')) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); proxima(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); anterior(); }
  else if (e.key === 'Escape') { if (!el('lv-menu').hidden) esconderMenu(); else if (!el('lv-painel').hidden) fecharPainel(); }
}

// ---------------------------------------------------------------------------
// Cliques e campos
// ---------------------------------------------------------------------------

function aoClicar(e) {
  if (!L) return;
  const alvo = e.target.closest('[data-leitor]');
  if (!alvo || !el('lv')?.contains(alvo)) return;
  const acao = alvo.dataset.leitor;
  switch (acao) {
    case 'anterior': anterior(); break;
    case 'proxima': proxima(); break;
    case 'painel-sumario': painelSumario(); break;
    case 'painel-busca': painelBusca(); break;
    case 'painel-ajustes': painelAjustesAbrir(); break;
    case 'painel-mais': painelMais(); break;
    case 'fechar-painel': fecharPainel(); break;
    case 'caneta': alternarCaneta(); break;
    case 'marcador': {
      const antes = L.marcadores.length;
      L.marcadores = alternarMarcador(L.marcadores, L.formato, posicaoAtual(), rotuloDoLugar(), 1 / Math.max(2, L.paginas || 2));
      mudarArtigo({ dados: { marcadores: L.marcadores } });
      aviso(L.marcadores.length > antes ? 'Página marcada.' : 'Marcador tirado.');
      depoisDeAndar();
      break;
    }
    case 'ir-marcador': {
      const p = posicaoDaChave(alvo.dataset.chave);
      if (!p) break;
      if (L.formato === 'pdf') irParaPaginaPdf(p.pagina);
      else if (p.capitulo === L.capitulo) irParaFracao(p.fracao);
      else abrirCapitulo(p.capitulo, { fracao: p.fracao });
      if (innerWidth < 1000) fecharPainel();
      break;
    }
    case 'tirar-marcador':
      L.marcadores = L.marcadores.filter((m) => m.id !== alvo.dataset.id);
      mudarArtigo({ dados: { marcadores: L.marcadores } }).then(painelMais);
      depoisDeAndar();
      break;
    case 'ir': {
      if (alvo.dataset.pagina) irParaPaginaPdf(Number(alvo.dataset.pagina));
      else if (alvo.dataset.sumario !== undefined) {
        const s = L.epub.sumario[Number(alvo.dataset.sumario)];
        if (s) abrirCapitulo(s.capitulo, { ancora: s.frag });
      } else if (alvo.dataset.capitulo !== undefined) {
        const i = Number(alvo.dataset.capitulo);
        const offset = Number(alvo.dataset.offset) || 0;
        if (i === L.capitulo) irParaOffset(offset);
        else abrirCapitulo(i, { offset });
      }
      if (innerWidth < 1000) fecharPainel();
      break;
    }
    case 'pref': {
      const { campo, valor } = alvo.dataset;
      L.prefs = prefsLeitor({ ...L.prefs, [campo]: valor });
      guardarPrefs();
      relayout();
      painelAjustesAbrir();
      break;
    }
    case 'passo': {
      const passo = Number(alvo.dataset.passo);
      if (alvo.dataset.campo === 'tamanho') {
        L.prefs = prefsLeitor({ ...L.prefs, tamanho: L.prefs.tamanho + passo });
        guardarPrefs();
        relayout();
      } else {
        const i = ZOOM_PDF.indexOf(L.zoom);
        L.zoom = ZOOM_PDF[Math.max(0, Math.min(ZOOM_PDF.length - 1, (i < 0 ? 1 : i) + passo))];
        mostrarPaginaPdf(L.pagina);
        mudarArtigo({ dados: { zoom: L.zoom, ajuste: L.ajuste } });
      }
      painelAjustesAbrir();
      break;
    }
    case 'ajuste-pdf':
      L.ajuste = alvo.dataset.valor === 'largura' ? 'largura' : 'pagina';
      L.zoom = 1;
      mostrarPaginaPdf(L.pagina);
      mudarArtigo({ dados: { zoom: L.zoom, ajuste: L.ajuste } });
      painelAjustesAbrir();
      break;
    case 'destacar': destacar(alvo.dataset.cor); break;
    case 'nota-selecao': {
      if (L.menuDestaque) { painelNota(L.menuDestaque); esconderMenu(); break; }
      destacar('amarelo').then((d) => d && painelNota(d.id));
      break;
    }
    case 'tirar-destaque': {
      const id = L.menuDestaque;
      const antes = L.artigo.destaques || [];
      mudarArtigo({ destaques: antes.filter((d) => d.id !== id) }).then(() => {
        remarcar();
        aviso('Destaque tirado.', { rotulo: 'Desfazer', fn: () => mudarArtigo({ destaques: antes }).then(remarcar) });
      });
      esconderMenu();
      break;
    }
    case 'copiar': {
      const s = L.selecao || selecaoNoTexto();
      if (s) navigator.clipboard?.writeText(`"${s.trecho}" (${L.artigo.titulo})`).then(() => aviso('Trecho copiado.'), () => {});
      esconderMenu();
      break;
    }
    case 'explicar': explicar(); break;
    case 'resumir': resumir(); break;
    case 'guardar-ia':
      if (L.ultimaIa) {
        mudarArtigo({ notas: [L.artigo.notas, L.ultimaIa].filter(Boolean).join('\n\n') }).then(() => aviso('Guardado nas notas do livro.'));
        alvo.disabled = true;
      }
      break;
    case 'questoes':
      textoParaQuestoes().then((texto) => {
        if (texto.trim().length < 80) return aviso('Esta parte tem pouco texto para gerar questões.');
        atualizarEstado({ questoesPreset: { fonte: 'texto', texto: texto.slice(0, 100000), disciplina: L.artigo.disciplina_id || '', area: L.artigo.area_id || '' }, qFonte: 'texto' });
        location.hash = '#questoes/gerar';
        return null;
      });
      break;
    case 'lido':
      mudarArtigo({ status: 'lido', lido_em: new Date().toISOString() }).then(() => { aviso('Marcado como lido. Que bom!'); painelMais(); });
      break;
    case 'ferramenta': {
      L.editor.ferramenta = alvo.dataset.ferramenta;
      document.querySelectorAll('[data-leitor="ferramenta"]').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
      break;
    }
    case 'tinta':
      L.editor.tinta = alvo.dataset.tinta;
      if (L.editor.ferramenta !== 'tinteiro') {
        L.editor.ferramenta = 'tinteiro';
        document.querySelectorAll('[data-leitor="ferramenta"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ferramenta === 'tinteiro')));
      }
      document.querySelectorAll('[data-leitor="tinta"]').forEach((b) => b.setAttribute('aria-pressed', String(b === alvo)));
      break;
    case 'desfazer': L.editor?.voltar(); break;
    case 'refazer': L.editor?.avancar(); break;
    default:
  }
}

function aoMudar(e) {
  if (!L) return;
  const alvo = e.target;
  if (alvo.matches?.('[data-leitor-barra]')) {
    if (e.type !== 'change') return;
    const pct = Number(alvo.value) / 1000;
    if (L.formato === 'pdf') irParaPaginaPdf(Math.max(1, Math.round(pct * (L.total - 1)) + 1));
    else {
      const p = posicaoDaPorcentagem(L.epub.capitulos, pct);
      if (p.capitulo === L.capitulo) irParaFracao(p.fracao);
      else abrirCapitulo(p.capitulo, { fracao: p.fracao });
    }
    return;
  }
  if (alvo.matches?.('[data-leitor-pref]')) {
    const campo = alvo.dataset.leitorPref;
    L.prefs = prefsLeitor({ ...L.prefs, [campo]: alvo.type === 'checkbox' ? alvo.checked : Number(alvo.value) });
    guardarPrefs();
    if (campo === 'brilho' || campo === 'pdfNoite') aplicarPrefs();
    else if (e.type === 'change' || campo !== 'linhas') relayout();
    const rotulo = alvo.closest('.campo')?.querySelector('.campo-rotulo');
    if (rotulo && campo === 'linhas') rotulo.textContent = `Espaço entre linhas: ${L.prefs.linhas.toFixed(1)}`;
    if (rotulo && campo === 'brilho') rotulo.textContent = `Brilho: ${Math.round(L.prefs.brilho * 100)}%`;
    return;
  }
  if (alvo.matches?.('[data-leitor-dedo]') && L.editor) {
    L.editor.dedoDesenha = alvo.checked;
    return;
  }
  if (alvo.matches?.('[data-leitor-nota]') && e.type === 'input') {
    const id = alvo.dataset.leitorNota;
    const nota = alvo.value;
    clearTimeout(L.tempoNota);
    L.tempoNota = setTimeout(() => mudarArtigo({ destaques: (L.artigo.destaques || []).map((d) => (d.id === id ? { ...d, nota } : d)) }).then(remarcar), 600);
  }
}

// Formulário de busca (o main.js chama enviarLeitor antes dos outros).
export function enviarLeitor(form) {
  if (form.dataset.form !== 'lv-busca') return false;
  if (!L) return true;
  const termo = form.querySelector('input').value.trim();
  if (termo.length >= 2) buscar(termo);
  return true;
}
