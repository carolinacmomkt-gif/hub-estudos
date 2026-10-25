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

function corDaTinta(nome) {
  if (/^#[0-9a-f]{6}$/i.test(nome || '')) return nome;
  const estilo = estiloRaiz();
  return estilo.getPropertyValue(`--tinta-${nome}`).trim() || estilo.getPropertyValue('--tinta-tinta').trim();
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
    const m = item.tamanho / 2;
    for (const [x, y] of item.pontos) {
      x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m);
    }
  }
  return { x0, y0, x1, y1 };
}

export class EditorDeTinta {
  constructor(recipiente, { aoMudar = () => {}, aoDiagnostico = () => {}, aoSelecao = () => {}, aoZoom = () => {} } = {}) {
    this.recipiente = recipiente;
    this.aoMudar = aoMudar;
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
    if (!this.camadaAtiva()) this.pagina.camadas.push({ id: crypto.randomUUID(), nome: 'Camada 1', tipo: 'desenho', visivel: true, bloqueada: false, opacidade: 1, itens: [] });
    this.desfazer = [];
    this.refazer = [];
    this.limparSelecao();
    this.dim = dim;
    this.ajustarTamanho();
  }

  camadaAtiva() {
    return this.pagina.camadas.find((c) => c.tipo === 'desenho' && !c.bloqueada && c.visivel !== false);
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
    const estilo = estiloRaiz();
    desenharFolha(this.xPapel, this.pagina.modelo || 'branco', this.dim, {
      papel: estilo.getPropertyValue('--papel').trim(),
      linha: estilo.getPropertyValue('--papel-linha').trim(),
      margem: estilo.getPropertyValue('--papel-margem').trim(),
    });
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
    if (!caminho) return;
    const ferramenta = ferramentaDe(traco);
    const alfaAntes = ctx.globalAlpha;
    // Cor própria no marca-texto fica translúcida; o lápis é um pouco mais claro que a caneta.
    if (ferramenta === 'marca-texto' && traco.tinta?.startsWith('#')) ctx.globalAlpha = alfaAntes * 0.38;
    if (ferramenta === 'lapis') ctx.globalAlpha = alfaAntes * 0.8;
    ctx.fillStyle = corDaTinta(traco.tinta);
    ctx.fill(caminho);
    ctx.globalAlpha = alfaAntes;
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
      for (const item of camada.itens) if (item.ferramenta !== 'marca-texto' && !escondidos?.has(item.id)) this.desenharTraco(x, item);
    }
    x.globalAlpha = 1;
    this.pedirQuadro();
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
        const { dx, dy, fator, base } = this.arrastando;
        x.save();
        x.translate(base.x0 + dx, base.y0 + dy);
        x.scale(fator, fator);
        x.translate(-base.x0, -base.y0);
        for (const item of this.itensSelecionados()) this.desenharTraco(x, item);
        x.restore();
      }
      if (this.selecao) {
        const c = this.caixaVisivel();
        x.setLineDash([8 / this.escala, 6 / this.escala]);
        x.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
        x.setLineDash([]);
        // Alça de redimensionar (canto inferior direito)
        const t = 22 / this.escala;
        x.fillStyle = this.corDoContorno();
        x.fillRect(c.x1 - t / 2, c.y1 - t / 2, t, t);
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
      this.apagando = { camadaId: camada.id, removidos: [], antes: [...camada.itens], mudou: false, area: this.tipoBorracha === 'area' };
      this.apagarEm(ponto);
      return;
    }

    if (this.ferramenta === 'laco') {
      if (this.selecao) {
        const c = this.caixaVisivel();
        const t = 30 / this.escala;
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
      const { camadaId, removidos, antes, mudou, area } = this.apagando;
      this.apagando = null;
      this.cursorBorracha = null;
      const camada = this.pagina.camadas.find((c) => c.id === camadaId);
      if (area && mudou) this.registrar({ tipo: 'trocar', camadaId, antes, depois: [...camada.itens] });
      else if (removidos.length) this.registrar({ tipo: 'remover', camadaId, itens: removidos });
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
    const camada = this.camadaAtiva();
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
    const camada = this.pagina.camadas.find((c) => c.id === this.apagando.camadaId);
    let mudou = false;
    for (let i = camada.itens.length - 1; i >= 0; i -= 1) {
      const item = camada.itens[i];
      const alcance = this.raioBorracha + item.tamanho / 2;
      const alcance2 = alcance * alcance;
      const perto = (p) => (p[0] - x) ** 2 + (p[1] - y) ** 2 <= alcance2;
      if (!item.pontos.some(perto)) continue;
      mudou = true;
      if (!this.apagando.area) {
        this.apagando.removidos.push({ item, indice: i });
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
    if (mudou) {
      this.apagando.mudou = true;
      this.desenharTudo();
    }
  }

  // ---------------------------------------------------------------------------
  // Laço (selecionar, mover, redimensionar, mudar a cor, duplicar, excluir)
  // ---------------------------------------------------------------------------

  itensSelecionados() {
    if (!this.selecao) return [];
    const camada = this.camadaAtiva();
    return camada ? camada.itens.filter((i) => this.selecao.ids.has(i.id)) : [];
  }

  caixaVisivel() {
    const c = this.selecao.caixa;
    if (!this.arrastando) return c;
    const { dx, dy, fator } = this.arrastando;
    return { x0: c.x0 + dx, y0: c.y0 + dy, x1: c.x0 + dx + (c.x1 - c.x0) * fator, y1: c.y0 + dy + (c.y1 - c.y0) * fator };
  }

  fecharLaco() {
    const poligono = this.laco;
    this.laco = null;
    const camada = this.camadaAtiva();
    if (!camada || poligono.length < 3) {
      this.pedirQuadro();
      return;
    }
    const dentro = camada.itens.filter((item) => {
      const amostra = item.pontos.filter((_, i) => i % 3 === 0);
      const n = amostra.filter((p) => pontoNoPoligono(p, poligono)).length;
      return n / amostra.length >= 0.6;
    });
    if (!dentro.length) {
      this.limparSelecao();
      return;
    }
    this.selecao = { ids: new Set(dentro.map((i) => i.id)), caixa: caixaDosItens(dentro) };
    this.aoSelecao(dentro.length);
    this.pedirQuadro();
  }

  terminarArraste() {
    const { dx, dy, fator, base } = this.arrastando;
    this.arrastando = null;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(fator - 1) < 0.01) {
      this.desenharTudo();
      return;
    }
    this.transformarSelecao((item) => ({
      ...item,
      id: crypto.randomUUID(),
      tamanho: arred(item.tamanho * fator, 2),
      pontos: item.pontos.map(([x, y, p]) => [arred(base.x0 + dx + (x - base.x0) * fator, 1), arred(base.y0 + dy + (y - base.y0) * fator, 1), p]),
    }));
  }

  // Substitui os itens selecionados pelo resultado de "fn" (desfazer volta tudo).
  transformarSelecao(fn, { manterOriginais = false } = {}) {
    const camada = this.camadaAtiva();
    if (!camada || !this.selecao) return;
    const novos = [];
    const depois = [];
    for (const item of camada.itens) {
      if (!this.selecao.ids.has(item.id)) {
        depois.push(item);
        continue;
      }
      if (manterOriginais) depois.push(item);
      const novo = fn(item);
      if (!novo) continue;
      novos.push(novo);
      if (!manterOriginais) depois.push(novo);
    }
    if (manterOriginais) depois.push(...novos);
    this.trocarItens(camada, depois);
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
    this.transformarSelecao((item) => ({ ...item, id: crypto.randomUUID(), tinta: item.ferramenta === 'marca-texto' ? item.tinta : tinta }));
  }

  copiarSelecao() {
    this.area = this.itensSelecionados().map((i) => JSON.parse(JSON.stringify(i)));
    return this.area.length;
  }

  colar() {
    const camada = this.camadaAtiva();
    if (!camada || !this.area?.length) return 0;
    const novos = this.area.map((i) => ({ ...i, id: crypto.randomUUID(), pontos: i.pontos.map(([x, y, p]) => [x + 30, y + 30, p]) }));
    this.trocarItens(camada, [...camada.itens, ...novos]);
    this.selecao = { ids: new Set(novos.map((i) => i.id)), caixa: caixaDosItens(novos) };
    this.aoSelecao(novos.length);
    this.desenharTudo();
    return novos.length;
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
