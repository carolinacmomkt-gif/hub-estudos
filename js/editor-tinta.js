// Motor de escrita à mão: Pointer Events + perfect-freehand sobre canvas.
//
// - Três canvas empilhados: papel (fundo), tinta (traços prontos) e ao vivo (traço em andamento,
//   laço e seleção). O traço em andamento usa eventos agrupados e previstos.
// - Coordenadas em unidades da página (1000 de largura; a altura vem do papel), iguais em qualquer tela.
// - Formato salvo (JSON vetorial, já com camadas):
//   { versao: 1, modelo, camadas: [{ id, nome, tipo: 'fundo'|'desenho', visivel, bloqueada, opacidade, itens: [traço] }] }
//   traço: { id, tipo: 'traco', ferramenta, tinta, tamanho, pressaoReal, suavizacao, forma?, pontos: [[x, y, p], ...] }
//   ferramenta: 'tinteiro' | 'esferografica' | 'pincel' | 'lapis' | 'marca-texto' ('caneta' = tinteiro, dos rascunhos antigos)
//   tinta: nome de uma tinta do tema ("azul") ou cor própria ("#1f6feb").
// - Rejeição da palma: o dedo não risca (a não ser que "dedo" esteja ligado); ele rola a página.
//   Enquanto a caneta escreve, qualquer toque é ignorado.
// - Gestos: pinça dá zoom, dois dedos arrastam, toque com dois dedos desfaz e com três refaz.
// - Segurar a caneta parada no fim do traço transforma o rabisco em linha ou forma.
// - Botão da S Pen (buttons & 32) vira borracha enquanto estiver apertado.

import { getStroke } from './vendor/perfect-freehand.js';
import { reconhecerForma } from './formas.js';
import { dimensoes, desenharFolha } from './folhas.js';

export const LARGURA = 1000;
export const ALTURA = dimensoes('A4').altura;

export const SUAVIZACAO = {
  desligado: { streamline: 0.2, smoothing: 0.45 },
  leve: { streamline: 0.4, smoothing: 0.55 },
  medio: { streamline: 0.6, smoothing: 0.65 },
  forte: { streamline: 0.78, smoothing: 0.78 },
};

const CANETAS = ['tinteiro', 'esferografica', 'pincel', 'lapis'];
const BOTAO_BORRACHA_SPEN = 32;
const SEGURAR_MS = 550; // caneta parada por este tempo = forma
const TOQUE_RAPIDO_MS = 300;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

export function novaPaginaVazia(modelo = 'pautada-media') {
  return {
    versao: 1,
    modelo,
    camadas: [
      { id: 'fundo', nome: 'Fundo', tipo: 'fundo', visivel: true, bloqueada: true },
      { id: crypto.randomUUID(), nome: 'Camada 1', tipo: 'desenho', visivel: true, bloqueada: false, opacidade: 1, itens: [] },
    ],
  };
}

// Contorno do perfect-freehand → Path2D (curvas quadráticas, como no exemplo da biblioteca).
function caminhoDoContorno(contorno) {
  if (contorno.length < 2) return null;
  let d = `M ${contorno[0][0].toFixed(2)} ${contorno[0][1].toFixed(2)} Q`;
  for (let i = 0; i < contorno.length; i += 1) {
    const [x0, y0] = contorno[i];
    const [x1, y1] = contorno[(i + 1) % contorno.length];
    d += ` ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
  }
  return new Path2D(`${d} Z`);
}

const ferramentaDe = (traco) => (traco.ferramenta === 'caneta' ? 'tinteiro' : traco.ferramenta);

function opcoesDoTraco(traco, terminado) {
  const suave = SUAVIZACAO[traco.suavizacao] || SUAVIZACAO.leve;
  const base = {
    size: traco.tamanho,
    smoothing: suave.smoothing,
    streamline: suave.streamline,
    simulatePressure: !traco.pressaoReal,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last: terminado,
  };
  switch (ferramentaDe(traco)) {
    case 'esferografica': return { ...base, thinning: 0.2 };
    case 'pincel': return { ...base, thinning: 0.85, start: { taper: traco.tamanho * 3, cap: true }, end: { taper: traco.tamanho * 4, cap: true } };
    case 'lapis': return { ...base, thinning: 0.35 };
    case 'marca-texto': return { ...base, thinning: 0, smoothing: 0.7 };
    default: return { ...base, thinning: 0.6 };
  }
}

const estiloRaiz = () => getComputedStyle(document.documentElement);

// prefixo "--impressao-tinta-" dá as cores da exportação (papel claro nos dois temas).
function corDaTinta(nome, prefixo = '--tinta-') {
  if (/^#[0-9a-f]{6}$/i.test(nome || '')) return nome;
  const estilo = estiloRaiz();
  return estilo.getPropertyValue(`${prefixo}${nome}`).trim() || estilo.getPropertyValue(`${prefixo}tinta`).trim();
}

// Cores do papel no tema atual.
export function coresDoPapel({ impressao = false } = {}) {
  const estilo = estiloRaiz();
  const v = (n) => estilo.getPropertyValue(n).trim();
  const p = impressao ? '--impressao-' : '--papel-';
  return { papel: v(impressao ? '--impressao-papel' : '--papel'), linha: v(`${p}linha`), margem: v(`${p}margem`), texto: v(`${p}texto`), tinta: impressao ? '--impressao-tinta-' : '--tinta-' };
}

// ---------------------------------------------------------------------------
// Itens de caixa: texto digitado, imagem e adesivo. Guardam a caixa em "pontos"
// (dois cantos), assim o laço, mover, redimensionar e desfazer valem para eles também.
// ---------------------------------------------------------------------------

export const ADESIVOS_SIMPLES = ['⭐', '✅', '❗', '❓', '📌', '💡', '❤️', '🔥', '📅', '✏️', '⚠️', '🎯', 'Prova!', 'Revisar', 'Importante'];
export const FONTES_TEXTO = {
  sistema: { nome: 'Padrão', css: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  serifa: { nome: 'Serifa', css: 'Georgia, "Times New Roman", serif' },
  mono: { nome: 'Máquina', css: 'ui-monospace, "Courier New", monospace' },
  manuscrita: { nome: 'Manuscrita', css: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' },
};
export const ehCaixa = (item) => item?.tipo === 'texto' || item?.tipo === 'imagem' || item?.tipo === 'adesivo';
const imagensDosItens = new Map(); // src → Image (decodificada uma vez)

function caixaDoItem(item) {
  const [[ax, ay], [bx, by]] = item.pontos;
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

export function fonteDoTexto(item) {
  return `${item.negrito ? '700 ' : ''}${item.tamTexto || 26}px ${(FONTES_TEXTO[item.fonte] || FONTES_TEXTO.sistema).css}`;
}

// Quebra o texto em linhas que cabem na largura (respeita as quebras digitadas).
export function linhasDoTexto(ctx, texto, largura) {
  const linhas = [];
  for (const paragrafo of String(texto || '').split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/(\s+)/)) {
      const tentativa = atual + palavra;
      if (atual && ctx.measureText(tentativa).width > largura) {
        linhas.push(atual.trimEnd());
        atual = palavra.trimStart();
      } else atual = tentativa;
    }
    linhas.push(atual);
  }
  return linhas;
}

function imagemDoItem(src, aoCarregar) {
  let img = imagensDosItens.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => aoCarregar?.();
    img.src = src;
    imagensDosItens.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

function desenharCaixa(ctx, item, prefixo, aoCarregar) {
  const c = caixaDoItem(item);
  const w = c.x1 - c.x0;
  const h = c.y1 - c.y0;
  ctx.save();
  if (item.angulo) {
    ctx.translate(c.x0 + w / 2, c.y0 + h / 2);
    ctx.rotate(item.angulo);
    ctx.translate(-(c.x0 + w / 2), -(c.y0 + h / 2));
  }
  if (item.tipo === 'imagem') {
    const img = imagemDoItem(item.src, aoCarregar);
    if (img) ctx.drawImage(img, c.x0, c.y0, w, h);
    else {
      ctx.strokeStyle = corDaTinta('tinta', prefixo);
      ctx.globalAlpha *= 0.3;
      ctx.strokeRect(c.x0, c.y0, w, h);
    }
  } else if (item.tipo === 'adesivo') {
    const tam = item.simbolo.length > 2 ? h * 0.55 : h * 0.82;
    ctx.font = `700 ${tam}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (item.simbolo.length > 2) {
      ctx.fillStyle = corDaTinta(item.fundo || 'amarelo', prefixo);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x0, c.y0, w, h, h * 0.25);
      else ctx.rect(c.x0, c.y0, w, h);
      ctx.fill();
    }
    ctx.fillStyle = corDaTinta(item.tinta || 'tinta', prefixo);
    ctx.fillText(item.simbolo, c.x0 + w / 2, c.y0 + h / 2 + tam * 0.04, w);
  } else {
    if (item.fundo && item.fundo !== 'nenhum') {
      ctx.fillStyle = corDaTinta(item.fundo, prefixo);
      ctx.fillRect(c.x0 - 6, c.y0 - 4, w + 12, h + 8);
    }
    ctx.font = fonteDoTexto(item);
    ctx.fillStyle = corDaTinta(item.tinta, prefixo);
    ctx.textBaseline = 'top';
    const alturaLinha = (item.tamTexto || 26) * 1.3;
    linhasDoTexto(ctx, item.texto, w).forEach((linha, i) => ctx.fillText(linha, c.x0, c.y0 + i * alturaLinha));
  }
  ctx.restore();
}

// Traço tracejado ou pontilhado: a linha do meio com traços, na espessura da caneta.
function pintarTracoComLinha(ctx, traco, prefixo) {
  const t = Math.max(1, traco.tamanho);
  ctx.save();
  ctx.strokeStyle = corDaTinta(traco.tinta, prefixo);
  ctx.lineWidth = t * 0.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(traco.linha === 'pontilhada' ? [0.01, t * 2.4] : [t * 3.2, t * 2.4]);
  ctx.beginPath();
  traco.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

function pintarTraco(ctx, traco, caminho, prefixo) {
  if (traco.linha === 'tracejada' || traco.linha === 'pontilhada') {
    pintarTracoComLinha(ctx, traco, prefixo);
    return;
  }
  if (!caminho) return;
  const ferramenta = ferramentaDe(traco);
  const alfaAntes = ctx.globalAlpha;
  // Cor própria no marca-texto fica translúcida; o lápis é um pouco mais claro que a caneta.
  if (ferramenta === 'marca-texto' && traco.tinta?.startsWith('#')) ctx.globalAlpha = alfaAntes * 0.38;
  if (ferramenta === 'lapis') ctx.globalAlpha = alfaAntes * 0.8;
  ctx.fillStyle = corDaTinta(traco.tinta, prefixo);
  ctx.fill(caminho);
  ctx.globalAlpha = alfaAntes;
}

// Espera as imagens dos itens da página carregarem (para miniatura e exportação).
export async function carregarImagensDaPagina(pagina) {
  const srcs = (pagina?.camadas || []).flatMap((c) => (c.itens || []).filter((i) => i.tipo === 'imagem').map((i) => i.src));
  await Promise.all(srcs.map((src) => new Promise((resolver) => {
    const img = imagemDoItem(src, resolver);
    if (img) resolver();
    else setTimeout(resolver, 4000);
  })));
}

// Desenha uma página inteira (fundo + camadas) num contexto já em unidades da página.
// Serve para miniaturas e exportação, fora do editor.
export function desenharPaginaEm(ctx, pagina, dim, { imagem = null, cores = coresDoPapel() } = {}) {
  desenharFolha(ctx, pagina?.modelo || 'branco', dim, cores, { imagem, data: pagina?.fundo?.data });
  for (const camada of pagina?.camadas || []) {
    if (camada.tipo !== 'desenho' || camada.visivel === false) continue;
    ctx.globalAlpha = camada.opacidade ?? 1;
    const ordem = [...camada.itens.filter((i) => i.ferramenta === 'marca-texto'), ...camada.itens.filter((i) => i.ferramenta !== 'marca-texto')];
    for (const item of ordem) {
      if (ehCaixa(item)) desenharCaixa(ctx, item, cores.tinta);
      else pintarTraco(ctx, item, caminhoDoContorno(getStroke(item.pontos, opcoesDoTraco(item, true))), cores.tinta);
    }
  }
  ctx.globalAlpha = 1;
}

const arred = (v, casas) => Math.round(v * 10 ** casas) / 10 ** casas;

function pontoNoPoligono([x, y], poligono) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function caixaDosItens(itens) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const item of itens) {
    const m = ehCaixa(item) ? 0 : item.tamanho / 2;
    for (const [x, y] of item.pontos) {
      x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m);
    }
  }
  return { x0, y0, x1, y1 };
}

export class EditorDeTinta {
  constructor(recipiente, { aoMudar = () => {}, aoDiagnostico = () => {}, aoSelecao = () => {}, aoZoom = () => {}, aoTexto = () => {} } = {}) {
    this.recipiente = recipiente;
    this.aoMudar = aoMudar;
    this.aoTexto = aoTexto; // tocar com a ferramenta Texto: o editor abre a caixa de digitar
    this.aoDiagnostico = aoDiagnostico;
    this.aoSelecao = aoSelecao;
    this.aoZoom = aoZoom;

    this.dim = dimensoes('A4');
    this.pagina = novaPaginaVazia();
    this.ferramenta = 'tinteiro';
    this.tinta = 'tinta';
    this.tintaMarca = 'amarelo';
    this.tamanho = 4;
    this.tamanhoMarca = 24;
    this.raioBorracha = 16;
    this.tipoBorracha = 'traco'; // 'traco' apaga o traço inteiro; 'area' apaga só o pedaço
    this.suavizacao = 'leve';
    this.dedoDesenha = false;
    this.marcaReta = false;
    this.formasAuto = true;
    this.linha = 'continua'; // continua | tracejada | pontilhada
    this.camadaAtivaId = null;
    this.todasAsCamadas = false; // laço e borracha agem em todas as camadas
    this.marcaCamadaPropria = false; // marca-texto vai para uma camada só dele
    this.filtroLaco = 'tudo'; // tudo | escrita | formas | imagens | texto
    this.canetaVista = false;
    this.zoom = 1;

    this.desfazer = [];
    this.refazer = [];
    this.atual = null; // traço em andamento
    this.apagando = null;
    this.laco = null; // pontos do laço em andamento
    this.selecao = null; // { ids: Set, caixa }
    this.arrastando = null;
    this.previstos = [];
    this.quadroPedido = false;
    this.toques = new Map(); // dedos na tela (gestos)
    this.caminhos = new WeakMap(); // traço → Path2D (em unidades da página)

    this.diag = { eventos: 0, agrupados: 0, ultimo: null, atrasoEntrada: 0, atrasoQuadro: 0, eventosPorSegundo: 0 };
    this.montar();
  }

  // ---------------------------------------------------------------------------
  // Montagem e tamanho
  // ---------------------------------------------------------------------------

  montar() {
    this.folha = document.createElement('div');
    this.folha.className = 'folha-tinta';
    this.cPapel = document.createElement('canvas');
    this.cTinta = document.createElement('canvas');
    this.cVivo = document.createElement('canvas');
    this.cVivo.className = 'folha-tinta-entrada';
    this.cVivo.setAttribute('aria-label', 'Página para escrever');
    this.cVivo.setAttribute('role', 'img');
    this.folha.append(this.cPapel, this.cTinta, this.cVivo);
    this.recipiente.append(this.folha);

    this.xPapel = this.cPapel.getContext('2d');
    this.xTinta = this.cTinta.getContext('2d');
    // Sem "desynchronized": no Galaxy Tab ele deixa este canvas opaco (preto). O atraso sem ele é de 1 a 3 ms.
    this.xVivo = this.cVivo.getContext('2d');

    this.observador = new ResizeObserver(() => this.ajustarTamanho());
    this.observador.observe(this.recipiente);
    this.observadorTema = new MutationObserver(() => this.desenharTudo());
    this.observadorTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

    const c = this.cVivo;
    this.manipuladores = {
      pointerdown: (e) => this.aoApertar(e),
      pointermove: (e) => this.aoMover(e),
      pointerup: (e) => this.aoSoltar(e),
      pointercancel: (e) => this.aoSoltar(e, true),
      contextmenu: (e) => e.preventDefault(),
    };
    for (const [nome, fn] of Object.entries(this.manipuladores)) c.addEventListener(nome, fn, { passive: false });
    // Ctrl + rodinha (computador) também dá zoom.
    this.aoRodinha = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      this.definirZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), [e.clientX, e.clientY]);
    };
    this.recipiente.addEventListener('wheel', this.aoRodinha, { passive: false });

    this.relogio = setInterval(() => this.emitirDiagnostico(), 500);
    this.ajustarTamanho();
  }

  destruir() {
    this.observador.disconnect();
    this.observadorTema.disconnect();
    clearInterval(this.relogio);
    clearTimeout(this.tempoForma);
    for (const [nome, fn] of Object.entries(this.manipuladores)) this.cVivo.removeEventListener(nome, fn);
    this.recipiente.removeEventListener('wheel', this.aoRodinha);
    this.folha.remove();
  }

  definirPapel(dim) {
    this.dim = dim;
    this.ajustarTamanho();
  }

  ajustarTamanho() {
    const largDisp = this.recipiente.clientWidth;
    if (!largDisp) return;
    // Zoom 1 = a página na largura disponível (até 900 px). A pinça aumenta ou diminui a partir daí.
    const base = Math.min(largDisp - 2, 900) / this.dim.largura;
    this.escala = base * this.zoom;
    const largCss = Math.floor(this.dim.largura * this.escala);
    const altCss = Math.floor(this.dim.altura * this.escala);
    // Canvas muito grande estoura a memória do tablet: no zoom alto, cada canvas fica com no
    // máximo 4096 px de lado e uns 8 milhões de pixels (são três canvas empilhados).
    this.dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 3, 4096 / Math.max(largCss, altCss), Math.sqrt(8e6 / (largCss * altCss))));
    this.folha.style.width = `${largCss}px`;
    this.folha.style.height = `${altCss}px`;
    for (const canvas of [this.cPapel, this.cTinta, this.cVivo]) {
      canvas.width = Math.round(largCss * this.dpr);
      canvas.height = Math.round(altCss * this.dpr);
      canvas.style.width = `${largCss}px`;
      canvas.style.height = `${altCss}px`;
    }
    const fator = this.escala * this.dpr;
    for (const ctx of [this.xPapel, this.xTinta, this.xVivo]) ctx.setTransform(fator, 0, 0, fator, 0, 0);
    this.desenharTudo();
  }

  // Zoom mantendo parado o ponto da tela em "ancora" (clientX, clientY).
  definirZoom(novo, ancora = null) {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, novo));
    if (Math.abs(zoom - this.zoom) < 0.001) return;
    const r0 = this.folha.getBoundingClientRect();
    const [ax, ay] = ancora || [r0.left + r0.width / 2, r0.top + Math.min(r0.height, this.recipiente.clientHeight) / 2];
    const px = (ax - r0.left) / this.escala;
    const py = (ay - r0.top) / this.escala;
    this.zoom = zoom;
    this.ajustarTamanho();
    const r1 = this.folha.getBoundingClientRect();
    this.recipiente.scrollLeft += r1.left + px * this.escala - ax;
    this.recipiente.scrollTop += r1.top + py * this.escala - ay;
    this.aoZoom(this.zoom);
  }

  // ---------------------------------------------------------------------------
  // Dados e histórico
  // ---------------------------------------------------------------------------

  carregar(pagina, dim = this.dim) {
    this.pagina = pagina?.camadas ? pagina : novaPaginaVazia();
    this.imagemFundo = null;
    this.camadaAtivaId = null;
    if (!this.camadaAtiva()) this.pagina.camadas.push({ id: crypto.randomUUID(), nome: 'Camada 1', tipo: 'desenho', visivel: true, bloqueada: false, opacidade: 1, itens: [] });
    this.desfazer = [];
    this.refazer = [];
    this.limparSelecao();
    this.dim = dim;
    this.ajustarTamanho();
  }

  camadaAtiva() {
    const usavel = (c) => c.tipo === 'desenho' && !c.bloqueada && c.visivel !== false;
    const escolhida = this.pagina.camadas.find((c) => c.id === this.camadaAtivaId);
    return escolhida && usavel(escolhida) ? escolhida : this.pagina.camadas.find(usavel);
  }

  // Camadas em que o laço e a borracha agem: a ativa, ou todas as que dá para editar.
  camadasDeAcao() {
    if (!this.todasAsCamadas) return this.camadaAtiva() ? [this.camadaAtiva()] : [];
    return this.pagina.camadas.filter((c) => c.tipo === 'desenho' && !c.bloqueada && c.visivel !== false);
  }

  camadasDeDesenho() {
    return this.pagina.camadas.filter((c) => c.tipo === 'desenho');
  }

  // ---------------------------------------------------------------------------
  // Camadas (sem desfazer: mexer na estrutura vale na hora)
  // ---------------------------------------------------------------------------

  mudarCamadas(fn) {
    this.limparSelecao();
    fn();
    this.desfazer = this.desfazer.filter((a) => this.acaoValida(a));
    this.refazer = this.refazer.filter((a) => this.acaoValida(a));
    this.desenharTudo();
    this.aoMudar(this.pagina);
  }

  acaoValida(acao) {
    if (acao.tipo === 'grupo') return acao.acoes.every((a) => this.acaoValida(a));
    return this.pagina.camadas.some((c) => c.id === acao.camadaId);
  }

  adicionarCamada(nome) {
    const nova = { id: crypto.randomUUID(), nome: nome || `Camada ${this.camadasDeDesenho().length + 1}`, tipo: 'desenho', visivel: true, bloqueada: false, opacidade: 1, itens: [] };
    this.mudarCamadas(() => {
      this.pagina.camadas.push(nova);
      this.camadaAtivaId = nova.id;
    });
    return nova;
  }

  camada(id) {
    return this.pagina.camadas.find((c) => c.id === id && c.tipo === 'desenho');
  }

  ativarCamada(id) {
    if (!this.camada(id)) return;
    this.limparSelecao();
    this.camadaAtivaId = id;
  }

  renomearCamada(id, nome) {
    const c = this.camada(id);
    if (!c || !nome.trim()) return;
    c.nome = nome.trim().slice(0, 40);
    this.aoMudar(this.pagina);
  }

  alternarCamada(id, campo) {
    const c = this.camada(id);
    if (!c) return;
    this.mudarCamadas(() => {
      if (campo === 'visivel') c.visivel = c.visivel === false;
      else c.bloqueada = !c.bloqueada;
    });
  }

  opacidadeDaCamada(id, valor) {
    const c = this.camada(id);
    if (!c) return;
    c.opacidade = Math.max(0.1, Math.min(1, Number(valor) || 1));
    this.desenharTudo();
    this.aoMudar(this.pagina);
  }

  // passo +1 = para cima (desenhada por cima das outras)
  moverCamada(id, passo) {
    const lista = this.pagina.camadas;
    const i = lista.findIndex((c) => c.id === id);
    let j = i + passo;
    while (lista[j] && lista[j].tipo !== 'desenho') j += passo;
    if (i < 0 || !lista[j]) return;
    this.mudarCamadas(() => {
      [lista[i], lista[j]] = [lista[j], lista[i]];
    });
  }

  // Junta a camada com a de baixo (os itens ficam na de baixo, na ordem).
  mesclarComAbaixo(id) {
    const lista = this.pagina.camadas;
    const i = lista.findIndex((c) => c.id === id);
    let j = i - 1;
    while (lista[j] && lista[j].tipo !== 'desenho') j -= 1;
    if (i < 0 || !lista[j]) return false;
    this.mudarCamadas(() => {
      lista[j].itens.push(...lista[i].itens);
      lista.splice(i, 1);
      this.camadaAtivaId = lista[j].id;
    });
    return true;
  }

  excluirCamada(id) {
    if (this.camadasDeDesenho().length <= 1) return false;
    this.mudarCamadas(() => {
      this.pagina.camadas = this.pagina.camadas.filter((c) => c.id !== id);
      if (this.camadaAtivaId === id) this.camadaAtivaId = null;
    });
    return true;
  }

  camadaDoMarcaTexto() {
    let c = this.pagina.camadas.find((x) => x.tipo === 'desenho' && x.marcaTexto);
    if (!c) {
      c = { id: crypto.randomUUID(), nome: 'Marca-texto', tipo: 'desenho', marcaTexto: true, visivel: true, bloqueada: false, opacidade: 1, itens: [] };
      const fundo = this.pagina.camadas.findIndex((x) => x.tipo === 'fundo');
      this.pagina.camadas.splice(fundo + 1, 0, c);
    }
    if (c.bloqueada || c.visivel === false) return this.camadaAtiva();
    return c;
  }

  totalDeTracos() {
    return this.pagina.camadas.reduce((soma, c) => soma + (c.itens?.length || 0), 0);
  }

  registrar(acao) {
    this.desfazer.push(acao);
    if (this.desfazer.length > 200) this.desfazer.shift();
    this.refazer = [];
    this.aoMudar(this.pagina);
  }

  podeDesfazer() {
    return this.desfazer.length > 0;
  }

  podeRefazer() {
    return this.refazer.length > 0;
  }

  aplicar(acao, voltar) {
    if (acao.tipo === 'grupo') {
      for (const a of voltar ? [...acao.acoes].reverse() : acao.acoes) this.aplicar(a, voltar);
      return;
    }
    const camada = this.pagina.camadas.find((c) => c.id === acao.camadaId);
    if (!camada) return;
    if (acao.tipo === 'adicionar') {
      if (voltar) camada.itens = camada.itens.filter((i) => i.id !== acao.item.id);
      else camada.itens.push(acao.item);
    } else if (acao.tipo === 'remover') {
      if (voltar) {
        for (const { item, indice } of [...acao.itens].sort((a, b) => a.indice - b.indice)) camada.itens.splice(indice, 0, item);
      } else {
        const ids = new Set(acao.itens.map((r) => r.item.id));
        camada.itens = camada.itens.filter((i) => !ids.has(i.id));
      }
    } else if (acao.tipo === 'limpar') {
      camada.itens = voltar ? [...acao.antes] : [];
    } else if (acao.tipo === 'trocar') {
      camada.itens = [...(voltar ? acao.antes : acao.depois)];
    }
  }

  voltar() {
    const acao = this.desfazer.pop();
    if (!acao) return;
    this.limparSelecao();
    this.aplicar(acao, true);
    this.refazer.push(acao);
    this.desenharTudo();
    this.aoMudar(this.pagina);
  }

  avancar() {
    const acao = this.refazer.pop();
    if (!acao) return;
    this.limparSelecao();
    this.aplicar(acao, false);
    this.desfazer.push(acao);
    this.desenharTudo();
    this.aoMudar(this.pagina);
  }

  limpar() {
    const camada = this.camadaAtiva();
    if (!camada || !camada.itens.length) return;
    const antes = [...camada.itens];
    camada.itens = [];
    this.limparSelecao();
    this.registrar({ tipo: 'limpar', camadaId: camada.id, antes });
    this.desenharTudo();
  }

  // Troca a lista de itens da camada inteira (desfazer volta a lista anterior).
  trocarItens(camada, depois) {
    const antes = [...camada.itens];
    camada.itens = depois;
    this.registrar({ tipo: 'trocar', camadaId: camada.id, antes, depois: [...depois] });
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------

  desenharPapel() {
    desenharFolha(this.xPapel, this.pagina.modelo || 'branco', this.dim, coresDoPapel(), { imagem: this.imagemFundo, data: this.pagina.fundo?.data });
  }

  // Imagem do fundo (modelo próprio ou página de PDF), carregada depois de abrir a página.
  definirImagemDeFundo(imagem) {
    this.imagemFundo = imagem || null;
    if (this.escala) this.desenharTudo();
  }

  caminhoDe(traco) {
    let caminho = this.caminhos.get(traco);
    if (!caminho) {
      caminho = caminhoDoContorno(getStroke(traco.pontos, opcoesDoTraco(traco, true)));
      if (caminho) this.caminhos.set(traco, caminho);
    }
    return caminho;
  }

  desenharTraco(ctx, traco, terminado = true, extras = []) {
    const caminho = terminado && !extras.length
      ? this.caminhoDe(traco)
      : caminhoDoContorno(getStroke(extras.length ? traco.pontos.concat(extras) : traco.pontos, opcoesDoTraco(traco, terminado)));
    // Em cima de PDF ou modelo próprio (papel claro), a tinta usa as cores do papel claro.
    pintarTraco(ctx, traco, caminho, this.prefixoTinta());
  }

  prefixoTinta() {
    return this.imagemFundo ? '--impressao-tinta-' : '--tinta-';
  }

  desenharItem(ctx, item) {
    if (ehCaixa(item)) desenharCaixa(ctx, item, this.prefixoTinta(), () => this.desenharTudo());
    else this.desenharTraco(ctx, item);
  }

  desenharTudo() {
    if (!this.escala) return;
    this.desenharPapel();
    const x = this.xTinta;
    x.clearRect(0, 0, this.dim.largura, this.dim.altura);
    const escondidos = this.arrastando?.ids;
    for (const camada of this.pagina.camadas) {
      if (camada.tipo !== 'desenho' || camada.visivel === false) continue;
      x.globalAlpha = camada.opacidade ?? 1;
      // Marca-texto primeiro: ele fica atrás da escrita.
      for (const item of camada.itens) if (item.ferramenta === 'marca-texto' && !escondidos?.has(item.id)) this.desenharTraco(x, item);
      for (const item of camada.itens) if (item.ferramenta !== 'marca-texto' && !escondidos?.has(item.id)) this.desenharItem(x, item);
    }
    x.globalAlpha = 1;
    this.pedirQuadro();
  }

  // Miniatura em JPEG (data URL) para o painel de páginas.
  miniatura(largura = 220) {
    const fator = largura / this.cPapel.width;
    const c = document.createElement('canvas');
    c.width = largura;
    c.height = Math.max(1, Math.round(this.cPapel.height * fator));
    const x = c.getContext('2d');
    x.drawImage(this.cPapel, 0, 0, c.width, c.height);
    x.drawImage(this.cTinta, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  // A página como imagem PNG (folha + escrita), com no máximo "maxLargura" px de largura.
  imagemDaPagina(maxLargura = 1400) {
    const fator = Math.min(1, maxLargura / this.cPapel.width);
    const c = document.createElement('canvas');
    c.width = Math.round(this.cPapel.width * fator);
    c.height = Math.round(this.cPapel.height * fator);
    const x = c.getContext('2d');
    x.drawImage(this.cPapel, 0, 0, c.width, c.height);
    x.drawImage(this.cTinta, 0, 0, c.width, c.height);
    return new Promise((resolver) => c.toBlob(resolver, 'image/png'));
  }

  corDoContorno() {
    return estiloRaiz().getPropertyValue('--borracha-contorno').trim();
  }

  pedirQuadro() {
    if (this.quadroPedido) return;
    this.quadroPedido = true;
    requestAnimationFrame((agora) => {
      this.quadroPedido = false;
      const x = this.xVivo;
      x.clearRect(0, 0, this.dim.largura, this.dim.altura);
      if (this.atual) {
        this.desenharTraco(x, this.atual, false, this.previstos);
        if (this.ultimoTempoEvento) this.diag.atrasoQuadro = Math.max(0, agora - this.ultimoTempoEvento);
        return;
      }
      x.strokeStyle = this.corDoContorno();
      x.lineWidth = 1.5 / this.escala;
      if (this.laco?.length > 1) {
        x.setLineDash([6 / this.escala, 5 / this.escala]);
        x.beginPath();
        x.moveTo(...this.laco[0]);
        for (const p of this.laco) x.lineTo(p[0], p[1]);
        x.stroke();
        x.setLineDash([]);
      }
      if (this.arrastando) {
        const { dx, dy, fator, base, angulo = 0 } = this.arrastando;
        x.save();
        if (angulo) {
          const cx = (base.x0 + base.x1) / 2;
          const cy = (base.y0 + base.y1) / 2;
          x.translate(cx, cy);
          x.rotate(angulo);
          x.translate(-cx, -cy);
        }
        x.translate(base.x0 + dx, base.y0 + dy);
        x.scale(fator, fator);
        x.translate(-base.x0, -base.y0);
        for (const item of this.itensSelecionados()) this.desenharItem(x, item);
        x.restore();
      }
      if (this.selecao) {
        const c = this.caixaVisivel();
        x.setLineDash([8 / this.escala, 6 / this.escala]);
        x.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
        x.setLineDash([]);
        // Alça de redimensionar (canto inferior direito) e de girar (bolinha em cima)
        const t = 22 / this.escala;
        x.fillStyle = this.corDoContorno();
        x.fillRect(c.x1 - t / 2, c.y1 - t / 2, t, t);
        if (!this.arrastando?.angulo) {
          const [gx, gy] = this.alcaGirar(c);
          x.beginPath();
          x.moveTo((c.x0 + c.x1) / 2, c.y0);
          x.lineTo(gx, gy);
          x.stroke();
          x.beginPath();
          x.arc(gx, gy, t / 2, 0, Math.PI * 2);
          x.fill();
        }
      }
      if (this.cursorBorracha) {
        x.beginPath();
        x.arc(this.cursorBorracha[0], this.cursorBorracha[1], this.raioBorracha, 0, Math.PI * 2);
        x.stroke();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Entrada (Pointer Events)
  // ---------------------------------------------------------------------------

  pontoDoEvento(e) {
    const r = this.cVivo.getBoundingClientRect();
    const x = (e.clientX - r.left) / this.escala;
    const y = (e.clientY - r.top) / this.escala;
    // Mouse e dedo não têm pressão de verdade: o perfect-freehand simula pela velocidade.
    const p = e.pointerType === 'pen' ? Math.max(0.02, e.pressure || 0.5) : 0.5;
    return [arred(x, 1), arred(y, 1), arred(p, 2)];
  }

  capturar(e) {
    try {
      this.cVivo.setPointerCapture(e.pointerId);
    } catch {
      // alguns navegadores recusam a captura; o traço segue mesmo assim
    }
  }

  aoApertar(e) {
    this.anotarDiagnostico(e, 1);
    if (e.pointerType === 'pen') this.canetaVista = true;

    if (e.pointerType === 'touch') {
      // Com a caneta escrevendo, a mão apoiada não faz nada.
      if (this.ponteiroCaneta) return;
      this.toques.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp });
      this.capturar(e);
      if (this.toques.size >= 2) {
        // Segundo dedo: vira gesto (cancela a rolagem ou o traço feito com o dedo).
        this.rolagem = null;
        if (this.ponteiro !== null && this.ponteiro !== undefined && this.tipoPonteiro === 'touch') this.cancelarAcao();
        this.iniciarGesto();
        return;
      }
      if (!this.dedoDesenha) {
        this.rolagem = { id: e.pointerId, y: e.clientY, x: e.clientX, topo: this.recipiente.scrollTop, esquerda: this.recipiente.scrollLeft };
        return;
      }
    }
    if (!e.isPrimary && e.pointerType !== 'touch') return;
    e.preventDefault();
    this.capturar(e);
    this.ponteiro = e.pointerId;
    this.tipoPonteiro = e.pointerType;
    if (e.pointerType === 'pen') this.ponteiroCaneta = e.pointerId;

    const ponto = this.pontoDoEvento(e);
    const borracha = this.ferramenta === 'borracha' || (e.buttons & BOTAO_BORRACHA_SPEN) === BOTAO_BORRACHA_SPEN || e.button === 5;
    const camada = this.camadaAtiva();
    if (!camada) return;

    if (borracha) {
      this.limparSelecao();
      this.apagando = {
        camadas: this.camadasDeAcao().map((c) => ({ id: c.id, removidos: [], antes: [...c.itens], mudou: false })),
        area: this.tipoBorracha === 'area',
      };
      this.apagarEm(ponto);
      return;
    }

    if (this.ferramenta === 'texto') {
      const achado = this.caixaNoPonto(ponto, 'texto');
      this.ponteiro = null;
      this.aoTexto(achado ? { item: achado.item, camadaId: achado.camada.id } : { x: ponto[0], y: ponto[1], camadaId: camada.id });
      return;
    }

    if (this.ferramenta === 'laco') {
      if (this.selecao) {
        const c = this.caixaVisivel();
        const t = 30 / this.escala;
        const [gx, gy] = this.alcaGirar(c);
        if (Math.hypot(ponto[0] - gx, ponto[1] - gy) < t) {
          const cx = (c.x0 + c.x1) / 2;
          const cy = (c.y0 + c.y1) / 2;
          this.arrastando = { modo: 'girar', ids: this.selecao.ids, inicio: ponto, base: { ...this.selecao.caixa }, dx: 0, dy: 0, fator: 1, angulo: 0, angulo0: Math.atan2(ponto[1] - cy, ponto[0] - cx) };
          this.desenharTudo();
          return;
        }
        if (Math.abs(ponto[0] - c.x1) < t && Math.abs(ponto[1] - c.y1) < t) {
          this.arrastando = { modo: 'escala', ids: this.selecao.ids, inicio: ponto, base: { ...this.selecao.caixa }, dx: 0, dy: 0, fator: 1 };
          this.desenharTudo();
          return;
        }
        if (ponto[0] >= c.x0 && ponto[0] <= c.x1 && ponto[1] >= c.y0 && ponto[1] <= c.y1) {
          this.arrastando = { modo: 'mover', ids: this.selecao.ids, inicio: ponto, base: { ...this.selecao.caixa }, dx: 0, dy: 0, fator: 1 };
          this.desenharTudo();
          return;
        }
        this.limparSelecao();
      }
      this.laco = [[ponto[0], ponto[1]]];
      this.pedirQuadro();
      return;
    }

    this.limparSelecao();
    const marca = this.ferramenta === 'marca-texto';
    this.atual = {
      id: crypto.randomUUID(),
      tipo: 'traco',
      ferramenta: marca ? 'marca-texto' : (CANETAS.includes(this.ferramenta) ? this.ferramenta : 'tinteiro'),
      tinta: marca ? this.tintaMarca : this.tinta,
      tamanho: marca ? this.tamanhoMarca : this.tamanho,
      pressaoReal: e.pointerType === 'pen',
      suavizacao: this.suavizacao,
      pontos: [ponto],
    };
    if (!marca && this.linha !== 'continua') this.atual.linha = this.linha;
    this.parado = { x: ponto[0], y: ponto[1] };
    this.agendarForma();
    this.ultimoTempoEvento = e.timeStamp;
    this.pedirQuadro();
  }

  aoMover(e) {
    const eventos = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    this.anotarDiagnostico(e, Math.max(1, eventos.length));

    if (e.pointerType === 'touch' && this.toques.has(e.pointerId)) {
      const t = this.toques.get(e.pointerId);
      t.x = e.clientX;
      t.y = e.clientY;
      if (this.gesto) {
        e.preventDefault();
        this.moverGesto();
        return;
      }
    }

    if (this.rolagem && e.pointerId === this.rolagem.id) {
      if (this.ponteiroCaneta) {
        this.rolagem = null;
        return;
      }
      this.recipiente.scrollTop = this.rolagem.topo - (e.clientY - this.rolagem.y);
      this.recipiente.scrollLeft = this.rolagem.esquerda - (e.clientX - this.rolagem.x);
      return;
    }

    if (e.pointerId !== this.ponteiro) {
      // Círculo da borracha mesmo sem apertar (caneta pairando ou mouse).
      if (this.ferramenta === 'borracha' && e.pointerType !== 'touch') {
        this.cursorBorracha = this.pontoDoEvento(e);
        this.pedirQuadro();
      }
      return;
    }
    e.preventDefault();
    const lista = eventos.length ? eventos : [e];
    const ponto = this.pontoDoEvento(e);

    if (this.apagando) {
      for (const ev of lista) this.apagarEm(this.pontoDoEvento(ev));
      this.cursorBorracha = ponto;
      this.pedirQuadro();
      return;
    }
    if (this.arrastando) {
      const a = this.arrastando;
      if (a.modo === 'mover') {
        a.dx = ponto[0] - a.inicio[0];
        a.dy = ponto[1] - a.inicio[1];
      } else if (a.modo === 'girar') {
        const cx = (a.base.x0 + a.base.x1) / 2;
        const cy = (a.base.y0 + a.base.y1) / 2;
        let ang = Math.atan2(ponto[1] - cy, ponto[0] - cx) - a.angulo0;
        // Gruda nos ângulos retos (0°, 90°…) quando passa perto.
        const reto = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(ang - reto) < 0.06) ang = reto;
        a.angulo = ang;
      } else {
        const largura = Math.max(10, a.base.x1 - a.base.x0);
        a.fator = Math.max(0.2, Math.min(5, (a.base.x1 - a.base.x0 + ponto[0] - a.inicio[0]) / largura));
      }
      this.pedirQuadro();
      return;
    }
    if (this.laco) {
      for (const ev of lista) {
        const p = this.pontoDoEvento(ev);
        this.laco.push([p[0], p[1]]);
      }
      this.pedirQuadro();
      return;
    }
    if (!this.atual || this.atual.forma) return;

    if (this.atual.ferramenta === 'marca-texto' && this.marcaReta) {
      // Marca-texto reto: do primeiro ponto até a ponta, na horizontal se estiver quase reto.
      const p0 = this.atual.pontos[0];
      const y = Math.abs(ponto[1] - p0[1]) < 18 ? p0[1] : ponto[1];
      this.atual.pontos = [p0, [ponto[0], y, p0[2]]];
    } else {
      for (const ev of lista) this.atual.pontos.push(this.pontoDoEvento(ev));
      // Pontos previstos deixam o traço "colado" na ponta da caneta (só na tela, não são salvos).
      this.previstos = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents().map((ev) => this.pontoDoEvento(ev)) : [];
    }
    if (Math.hypot(ponto[0] - this.parado.x, ponto[1] - this.parado.y) > 3) {
      this.parado = { x: ponto[0], y: ponto[1] };
      this.agendarForma();
    }
    this.ultimoTempoEvento = e.timeStamp;
    this.pedirQuadro();
  }

  aoSoltar(e, cancelado = false) {
    if (e.pointerType === 'touch' && this.toques.has(e.pointerId)) {
      if (this.gesto) {
        this.gesto.levantados = (this.gesto.levantados || 0) + 1;
        if (this.gesto.levantados >= this.gesto.dedos || this.toques.size <= 1) this.terminarGesto(e.timeStamp, cancelado);
      }
      this.toques.delete(e.pointerId);
      if (!this.toques.size) this.gesto = null;
    }
    if (this.rolagem && e.pointerId === this.rolagem.id) this.rolagem = null;
    if (e.pointerId === this.ponteiroCaneta) this.ponteiroCaneta = null;
    if (e.pointerId !== this.ponteiro) return;
    this.ponteiro = null;
    this.previstos = [];
    clearTimeout(this.tempoForma);

    if (this.apagando) {
      const { camadas, area } = this.apagando;
      this.apagando = null;
      this.cursorBorracha = null;
      const acoes = [];
      for (const r of camadas) {
        const camada = this.pagina.camadas.find((c) => c.id === r.id);
        if (!camada) continue;
        if (area && r.mudou) acoes.push({ tipo: 'trocar', camadaId: r.id, antes: r.antes, depois: [...camada.itens] });
        else if (r.removidos.length) acoes.push({ tipo: 'remover', camadaId: r.id, itens: r.removidos });
      }
      if (acoes.length) this.registrar(acoes.length === 1 ? acoes[0] : { tipo: 'grupo', acoes });
      this.pedirQuadro();
      return;
    }
    if (this.arrastando) {
      this.terminarArraste();
      return;
    }
    if (this.laco) {
      this.fecharLaco();
      return;
    }

    const traco = this.atual;
    this.atual = null;
    this.xVivo.clearRect(0, 0, this.dim.largura, this.dim.altura);
    if (!traco || cancelado) return;
    const camada = traco.ferramenta === 'marca-texto' && this.marcaCamadaPropria ? this.camadaDoMarcaTexto() : this.camadaAtiva();
    if (camada !== this.camadaAtiva()) {
      camada.itens.push(traco);
      this.registrar({ tipo: 'adicionar', camadaId: camada.id, item: traco });
      this.desenharTudo();
      return;
    }
    camada.itens.push(traco);
    if (traco.ferramenta === 'marca-texto') {
      // Desenha por baixo do que já existe, sem redesenhar a página toda.
      this.xTinta.globalCompositeOperation = 'destination-over';
      this.desenharTraco(this.xTinta, traco);
      this.xTinta.globalCompositeOperation = 'source-over';
    } else {
      this.desenharTraco(this.xTinta, traco);
    }
    this.registrar({ tipo: 'adicionar', camadaId: camada.id, item: traco });
  }

  cancelarAcao() {
    clearTimeout(this.tempoForma);
    this.atual = null;
    this.apagando = null;
    this.laco = null;
    this.arrastando = null;
    this.ponteiro = null;
    this.previstos = [];
    this.desenharTudo();
  }

  // Caneta parada no fim do traço: vira forma.
  agendarForma() {
    clearTimeout(this.tempoForma);
    if (!this.formasAuto || (this.atual?.ferramenta === 'marca-texto' && this.marcaReta)) return;
    this.tempoForma = setTimeout(() => {
      if (!this.atual || this.atual.forma) return;
      const r = reconhecerForma(this.atual.pontos);
      if (!r) return;
      this.atual.pontos = r.pontos;
      this.atual.forma = r.forma;
      this.atual.pressaoReal = true; // a forma tem espessura constante
      this.previstos = [];
      this.pedirQuadro();
    }, SEGURAR_MS);
  }

  // ---------------------------------------------------------------------------
  // Borracha
  // ---------------------------------------------------------------------------

  apagarEm([x, y]) {
    let mudou = false;
    for (const r of this.apagando.camadas) {
      const camada = this.pagina.camadas.find((c) => c.id === r.id);
      if (!camada) continue;
      for (let i = camada.itens.length - 1; i >= 0; i -= 1) {
        const item = camada.itens[i];
        // Texto, imagem e adesivo não saem com a borracha (só com o laço → Excluir).
        if (ehCaixa(item)) continue;
        const alcance = this.raioBorracha + item.tamanho / 2;
        const alcance2 = alcance * alcance;
        const perto = (p) => (p[0] - x) ** 2 + (p[1] - y) ** 2 <= alcance2;
        if (!item.pontos.some(perto)) continue;
        mudou = true;
        r.mudou = true;
        if (!this.apagando.area) {
          r.removidos.push({ item, indice: i });
          camada.itens.splice(i, 1);
          continue;
        }
        // Borracha de área: o traço vira os pedaços que sobraram fora do círculo.
        const pedacos = [];
        let atual = [];
        for (const p of item.pontos) {
          if (perto(p)) {
            if (atual.length > 1) pedacos.push(atual);
            atual = [];
          } else atual.push(p);
        }
        if (atual.length > 1) pedacos.push(atual);
        camada.itens.splice(i, 1, ...pedacos.map((pontos) => ({ ...item, id: crypto.randomUUID(), forma: undefined, pontos })));
      }
    }
    if (mudou) this.desenharTudo();
  }

  // ---------------------------------------------------------------------------
  // Laço (selecionar, mover, redimensionar, mudar a cor, duplicar, excluir)
  // ---------------------------------------------------------------------------

  itensSelecionados() {
    if (!this.selecao) return [];
    return this.camadasDeAcao().flatMap((c) => c.itens.filter((i) => this.selecao.ids.has(i.id)));
  }

  caixaVisivel() {
    const c = this.selecao.caixa;
    if (!this.arrastando) return c;
    const { dx, dy, fator } = this.arrastando;
    return { x0: c.x0 + dx, y0: c.y0 + dy, x1: c.x0 + dx + (c.x1 - c.x0) * fator, y1: c.y0 + dy + (c.y1 - c.y0) * fator };
  }

  alcaGirar(c) {
    return [(c.x0 + c.x1) / 2, c.y0 - 40 / this.escala];
  }

  // Texto (ou outro item de caixa) no ponto, da camada de cima para a de baixo.
  caixaNoPonto([x, y], tipo = null) {
    for (const camada of [...this.camadasDeAcao()].reverse()) {
      for (const item of [...camada.itens].reverse()) {
        if (!ehCaixa(item) || (tipo && item.tipo !== tipo)) continue;
        const c = caixaDoItem(item);
        if (x >= c.x0 - 8 && x <= c.x1 + 8 && y >= c.y0 - 8 && y <= c.y1 + 8) return { item, camada };
      }
    }
    return null;
  }

  categoria(item) {
    if (item.tipo === 'texto') return 'texto';
    if (item.tipo === 'imagem' || item.tipo === 'adesivo') return 'imagens';
    return item.forma ? 'formas' : 'escrita';
  }

  fecharLaco() {
    const poligono = this.laco;
    this.laco = null;
    if (!this.camadaAtiva() || poligono.length < 3) {
      this.pedirQuadro();
      return;
    }
    const dentro = this.camadasDeAcao().flatMap((camada) => camada.itens.filter((item) => {
      if (this.filtroLaco !== 'tudo' && this.categoria(item) !== this.filtroLaco) return false;
      const amostra = ehCaixa(item)
        ? (() => { const c = caixaDoItem(item); return [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1], [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]]; })()
        : item.pontos.filter((_, i) => i % 3 === 0);
      const n = amostra.filter((p) => pontoNoPoligono(p, poligono)).length;
      return n / amostra.length >= 0.6;
    }));
    if (!dentro.length) {
      this.limparSelecao();
      return;
    }
    this.selecionar(dentro);
  }

  selecionar(itens) {
    this.selecao = { ids: new Set(itens.map((i) => i.id)), caixa: caixaDosItens(itens) };
    this.aoSelecao(itens.length);
    this.pedirQuadro();
  }

  terminarArraste() {
    const { dx, dy, fator, base, angulo = 0 } = this.arrastando;
    this.arrastando = null;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(fator - 1) < 0.01 && Math.abs(angulo) < 0.001) {
      this.desenharTudo();
      return;
    }
    if (angulo) {
      this.girarSelecao(angulo, base);
      return;
    }
    const mover = ([x, y, p]) => [arred(base.x0 + dx + (x - base.x0) * fator, 1), arred(base.y0 + dy + (y - base.y0) * fator, 1), p];
    this.transformarSelecao((item) => ({
      ...item,
      id: crypto.randomUUID(),
      tamanho: arred(item.tamanho * fator, 2),
      ...(item.tamTexto ? { tamTexto: arred(item.tamTexto * fator, 1) } : {}),
      pontos: item.pontos.map(mover),
    }));
  }

  // Gira em volta do centro da seleção. Itens de caixa giram a caixa inteira (ângulo próprio).
  girarSelecao(angulo, base = this.selecao?.caixa) {
    if (!base) return;
    const cx = (base.x0 + base.x1) / 2;
    const cy = (base.y0 + base.y1) / 2;
    const cos = Math.cos(angulo);
    const sen = Math.sin(angulo);
    const girar = ([x, y, p = 0.5]) => [arred(cx + (x - cx) * cos - (y - cy) * sen, 1), arred(cy + (x - cx) * sen + (y - cy) * cos, 1), p];
    this.transformarSelecao((item) => {
      if (!ehCaixa(item)) return { ...item, id: crypto.randomUUID(), forma: undefined, pontos: item.pontos.map(girar) };
      const c = caixaDoItem(item);
      const [mx, my] = girar([(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]);
      const w = c.x1 - c.x0;
      const h = c.y1 - c.y0;
      return { ...item, id: crypto.randomUUID(), angulo: arred((item.angulo || 0) + angulo, 4), pontos: [[mx - w / 2, my - h / 2, 0.5], [mx + w / 2, my + h / 2, 0.5]] };
    });
  }

  // Substitui os itens selecionados pelo resultado de "fn", em cada camada (desfazer volta tudo).
  transformarSelecao(fn, { manterOriginais = false } = {}) {
    if (!this.selecao) return;
    const novos = [];
    const acoes = [];
    for (const camada of this.camadasDeAcao()) {
      if (!camada.itens.some((i) => this.selecao.ids.has(i.id))) continue;
      const depois = [];
      const daCamada = [];
      for (const item of camada.itens) {
        if (!this.selecao.ids.has(item.id)) {
          depois.push(item);
          continue;
        }
        if (manterOriginais) depois.push(item);
        const novo = fn(item);
        if (!novo) continue;
        daCamada.push(novo);
        if (!manterOriginais) depois.push(novo);
      }
      if (manterOriginais) depois.push(...daCamada);
      novos.push(...daCamada);
      const antes = [...camada.itens];
      camada.itens = depois;
      acoes.push({ tipo: 'trocar', camadaId: camada.id, antes, depois: [...depois] });
    }
    if (acoes.length) this.registrar(acoes.length === 1 ? acoes[0] : { tipo: 'grupo', acoes });
    this.selecao = novos.length ? { ids: new Set(novos.map((i) => i.id)), caixa: caixaDosItens(novos) } : null;
    this.aoSelecao(this.selecao ? novos.length : 0);
    this.desenharTudo();
  }

  excluirSelecao() {
    this.transformarSelecao(() => null);
  }

  duplicarSelecao() {
    this.transformarSelecao((item) => ({ ...item, id: crypto.randomUUID(), pontos: item.pontos.map(([x, y, p]) => [x + 20, y + 20, p]) }), { manterOriginais: true });
  }

  mudarCorSelecao(tinta) {
    this.transformarSelecao((item) => ({ ...item, id: crypto.randomUUID(), tinta: item.ferramenta === 'marca-texto' || item.tipo === 'imagem' ? item.tinta : tinta }));
  }

  mudarEspessuraSelecao(tamanho) {
    this.transformarSelecao((item) => (ehCaixa(item) || item.ferramenta === 'marca-texto' ? item : { ...item, id: crypto.randomUUID(), tamanho }));
  }

  copiarSelecao() {
    this.area = this.itensSelecionados().map((i) => JSON.parse(JSON.stringify(i)));
    return this.area.length;
  }

  recortarSelecao() {
    const n = this.copiarSelecao();
    if (n) this.excluirSelecao();
    return n;
  }

  colar() {
    if (!this.area?.length) return 0;
    return this.colarItens(this.area.map((i) => ({ ...i, pontos: i.pontos.map(([x, y, p]) => [x + 30, y + 30, p]) })));
  }

  // Põe itens novos na camada ativa (cópias com ids novos) e deixa selecionados.
  colarItens(itens) {
    const camada = this.camadaAtiva();
    if (!camada || !itens.length) return 0;
    const novos = itens.map((i) => ({ ...JSON.parse(JSON.stringify(i)), id: crypto.randomUUID() }));
    camada.itens.push(...novos);
    this.registrar(novos.length === 1 ? { tipo: 'adicionar', camadaId: camada.id, item: novos[0] } : { tipo: 'grupo', acoes: novos.map((item) => ({ tipo: 'adicionar', camadaId: camada.id, item })) });
    this.selecionar(novos);
    this.desenharTudo();
    return novos.length;
  }

  // Centro da parte da página que está aparecendo na tela.
  centroVisivel() {
    const r = this.cVivo.getBoundingClientRect();
    const area = this.recipiente.getBoundingClientRect();
    const cx = (Math.max(r.left, area.left) + Math.min(r.right, area.right)) / 2;
    const cy = (Math.max(r.top, area.top) + Math.min(r.bottom, area.bottom)) / 2;
    return [arred((cx - r.left) / this.escala, 1), arred((cy - r.top) / this.escala, 1)];
  }

  // Itens prontos (ex.: adesivo próprio, guardado com o canto em 0,0) no centro da tela.
  inserirItens(itens, largura, altura) {
    const [cx, cy] = this.centroVisivel();
    const dx = Math.max(0, Math.min(this.dim.largura - largura, cx - largura / 2));
    const dy = Math.max(0, Math.min(this.dim.altura - altura, cy - altura / 2));
    return this.colarItens(itens.map((i) => ({ ...i, pontos: i.pontos.map(([x, y, p]) => [arred(x + dx, 1), arred(y + dy, 1), p]) })));
  }

  inserirCaixa(campos, largura, altura) {
    return this.inserirItens([{ ...campos, tamanho: 0, pontos: [[0, 0, 0.5], [largura, altura, 0.5]] }], largura, altura);
  }

  // Seleção como itens com o canto em 0,0 (para virar adesivo próprio).
  selecaoNormalizada() {
    const itens = this.itensSelecionados();
    if (!itens.length) return null;
    const c = caixaDosItens(itens);
    return {
      largura: arred(c.x1 - c.x0, 1),
      altura: arred(c.y1 - c.y0, 1),
      itens: itens.map((i) => ({ ...JSON.parse(JSON.stringify(i)), pontos: i.pontos.map(([x, y, p]) => [arred(x - c.x0, 1), arred(y - c.y0, 1), p]) })),
    };
  }

  // A seleção como imagem PNG (fundo transparente), para copiar ou compartilhar.
  imagemDaSelecao(escala = 3) {
    const n = this.selecaoNormalizada();
    if (!n) return Promise.resolve(null);
    const margem = 12;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((n.largura + margem * 2) * escala));
    c.height = Math.max(1, Math.round((n.altura + margem * 2) * escala));
    const x = c.getContext('2d');
    x.setTransform(escala, 0, 0, escala, margem * escala, margem * escala);
    for (const item of n.itens.filter((i) => i.ferramenta === 'marca-texto')) this.desenharItem(x, item);
    for (const item of n.itens.filter((i) => i.ferramenta !== 'marca-texto')) this.desenharItem(x, item);
    return new Promise((resolver) => c.toBlob(resolver, 'image/png'));
  }

  // Cria ou atualiza uma caixa de texto (texto vazio apaga a caixa).
  salvarTexto({ item = null, camadaId, x, y, texto, estilo }) {
    const camada = this.camada(camadaId) || this.camadaAtiva();
    if (!camada) return;
    const base = item || { id: crypto.randomUUID(), tipo: 'texto', tamanho: 0, pontos: [[x, y, 0.5], [x + 420, y + 40, 0.5]] };
    const limpo = String(texto || '').replace(/\s+$/, '');
    if (!limpo) {
      if (item) {
        const antes = [...camada.itens];
        camada.itens = camada.itens.filter((i) => i.id !== item.id);
        this.registrar({ tipo: 'trocar', camadaId: camada.id, antes, depois: [...camada.itens] });
        this.desenharTudo();
      }
      return;
    }
    const novo = { ...base, ...estilo, id: crypto.randomUUID(), texto: limpo };
    const c = caixaDoItem(novo);
    const largura = Math.min(this.dim.largura - c.x0, Math.max(60, c.x1 - c.x0));
    this.xVivo.save();
    this.xVivo.font = fonteDoTexto(novo);
    const linhas = linhasDoTexto(this.xVivo, limpo, largura);
    const maior = Math.max(...linhas.map((l) => this.xVivo.measureText(l).width));
    this.xVivo.restore();
    const larguraFinal = item ? largura : Math.min(largura, Math.max(60, maior + 4));
    novo.pontos = [[c.x0, c.y0, 0.5], [arred(c.x0 + larguraFinal, 1), arred(c.y0 + linhas.length * (novo.tamTexto || 26) * 1.3, 1), 0.5]];
    const antes = [...camada.itens];
    camada.itens = item ? camada.itens.map((i) => (i.id === item.id ? novo : i)) : [...camada.itens, novo];
    this.registrar({ tipo: 'trocar', camadaId: camada.id, antes, depois: [...camada.itens] });
    this.desenharTudo();
  }

  // Posição de um item na tela (para a caixa de digitar ficar em cima dele).
  retanguloNaTela(item) {
    const c = caixaDoItem(item);
    return { x: c.x0 * this.escala, y: c.y0 * this.escala, largura: (c.x1 - c.x0) * this.escala, altura: (c.y1 - c.y0) * this.escala, escala: this.escala };
  }

  limparSelecao() {
    if (!this.selecao && !this.laco) return;
    this.selecao = null;
    this.laco = null;
    this.arrastando = null;
    this.aoSelecao(0);
    this.pedirQuadro();
  }

  // ---------------------------------------------------------------------------
  // Gestos com os dedos
  // ---------------------------------------------------------------------------

  pontosDosToques() {
    return [...this.toques.values()];
  }

  iniciarGesto() {
    const pts = this.pontosDosToques();
    const [a, b] = pts;
    this.gesto = {
      dedos: pts.length,
      t0: Math.min(...pts.map((p) => p.t0)),
      dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      meio0: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      zoom0: this.zoom,
      moveu: false,
    };
    const r = this.folha.getBoundingClientRect();
    this.gesto.origem = [this.gesto.meio0[0] - r.left, this.gesto.meio0[1] - r.top];
    this.folha.style.transformOrigin = `${this.gesto.origem[0]}px ${this.gesto.origem[1]}px`;
  }

  moverGesto() {
    const g = this.gesto;
    const pts = this.pontosDosToques();
    g.dedos = Math.max(g.dedos, pts.length);
    if (pts.length < 2 || g.dedos > 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const meio = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const deslocou = pts.some((p) => Math.hypot(p.x - p.x0, p.y - p.y0) > 10);
    if (!deslocou && !g.moveu) return;
    g.moveu = true;
    // Durante a pinça, só a imagem muda (rápido); o tamanho de verdade é aplicado ao soltar.
    const fator = Math.min(ZOOM_MAX / g.zoom0, Math.max(ZOOM_MIN / g.zoom0, dist / g.dist0));
    g.fator = fator;
    g.meio = meio;
    this.folha.style.transform = `translate(${meio[0] - g.meio0[0]}px, ${meio[1] - g.meio0[1]}px) scale(${fator})`;
  }

  terminarGesto(tempo, cancelado) {
    const g = this.gesto;
    if (!g || g.terminado) return;
    g.terminado = true;
    this.folha.style.transform = '';
    if (cancelado) return;
    if (!g.moveu && tempo - g.t0 < TOQUE_RAPIDO_MS + 150) {
      if (g.dedos === 2) this.voltar();
      else if (g.dedos === 3) this.avancar();
      return;
    }
    if (!g.moveu || !g.fator) return;
    // Aplica o zoom e a rolagem para o ponto do meio ficar onde os dedos soltaram.
    const r0 = this.folha.getBoundingClientRect();
    const px = (g.meio0[0] - r0.left) / this.escala;
    const py = (g.meio0[1] - r0.top) / this.escala;
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, g.zoom0 * g.fator));
    this.ajustarTamanho();
    const r1 = this.folha.getBoundingClientRect();
    this.recipiente.scrollLeft += r1.left + px * this.escala - g.meio[0];
    this.recipiente.scrollTop += r1.top + py * this.escala - g.meio[1];
    this.aoZoom(this.zoom);
  }

  // ---------------------------------------------------------------------------
  // Diagnóstico (para avaliar a caneta no tablet)
  // ---------------------------------------------------------------------------

  anotarDiagnostico(e, quantos) {
    this.diag.eventos += quantos;
    this.diag.agrupados = quantos;
    this.diag.atrasoEntrada = Math.max(0, performance.now() - e.timeStamp);
    this.diag.ultimo = { tipo: e.pointerType, pressao: e.pressure, inclinacaoX: e.tiltX, inclinacaoY: e.tiltY, botoes: e.buttons };
  }

  emitirDiagnostico() {
    this.diag.eventosPorSegundo = this.diag.eventos * 2;
    this.diag.eventos = 0;
    this.aoDiagnostico({ ...this.diag, canetaVista: this.canetaVista, tracos: this.totalDeTracos() });
  }
}
