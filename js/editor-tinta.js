// Motor de escrita à mão: Pointer Events + perfect-freehand sobre canvas.
//
// - Três canvas empilhados: papel (fundo), tinta (traços prontos) e ao vivo (traço em andamento).
//   O "ao vivo" usa desynchronized para o traço aparecer com o menor atraso possível.
// - Coordenadas em unidades da página (1000 de largura, proporção A4), iguais em qualquer tela.
// - Formato salvo (JSON vetorial, já com camadas):
//   { versao: 1, modelo, camadas: [{ id, nome, tipo: 'fundo'|'desenho', visivel, bloqueada, opacidade, itens: [traço] }] }
//   traço: { id, tipo: 'traco', ferramenta: 'caneta'|'marca-texto', tinta, tamanho, pressaoReal, suavizacao, pontos: [[x, y, p], ...] }
// - Rejeição da palma: o dedo não risca (a não ser que "dedo" esteja ligado); em vez disso, ele rola a página,
//   como no GoodNotes. Enquanto a caneta escreve, qualquer toque é ignorado.
// - Botão da S Pen (buttons & 32) vira borracha enquanto estiver apertado.

import { getStroke } from './vendor/perfect-freehand.js';

export const LARGURA = 1000;
export const ALTURA = Math.round(1000 * 297 / 210); // A4 em pé

export const SUAVIZACAO = {
  desligado: { streamline: 0.2, smoothing: 0.45 },
  leve: { streamline: 0.4, smoothing: 0.55 },
  medio: { streamline: 0.6, smoothing: 0.65 },
  forte: { streamline: 0.78, smoothing: 0.78 },
};

const BOTAO_BORRACHA_SPEN = 32;

export function novaPaginaVazia() {
  return {
    versao: 1,
    modelo: 'pautada-media',
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

function opcoesDoTraco(traco, terminado) {
  const suave = SUAVIZACAO[traco.suavizacao] || SUAVIZACAO.leve;
  const marcaTexto = traco.ferramenta === 'marca-texto';
  return {
    size: traco.tamanho,
    thinning: marcaTexto ? 0 : 0.6,
    smoothing: suave.smoothing,
    streamline: suave.streamline,
    simulatePressure: !traco.pressaoReal,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last: terminado,
  };
}

function corDaTinta(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--tinta-${nome}`).trim() || '#888';
}

const arred = (v, casas) => Math.round(v * 10 ** casas) / 10 ** casas;

export class EditorDeTinta {
  constructor(recipiente, { aoMudar = () => {}, aoDiagnostico = () => {} } = {}) {
    this.recipiente = recipiente;
    this.aoMudar = aoMudar;
    this.aoDiagnostico = aoDiagnostico;

    this.pagina = novaPaginaVazia();
    this.ferramenta = 'caneta';
    this.tinta = 'tinta';
    this.tintaMarca = 'amarelo';
    this.tamanho = 4;
    this.tamanhoMarca = 24;
    this.raioBorracha = 16;
    this.suavizacao = 'leve';
    this.dedoDesenha = false;
    this.canetaVista = false;

    this.desfazer = [];
    this.refazer = [];
    this.atual = null; // traço em andamento
    this.apagando = null; // { removidos: [] }
    this.previstos = [];
    this.quadroPedido = false;

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
    this.xVivo = this.cVivo.getContext('2d', { desynchronized: true });

    this.aoRedimensionar = () => this.ajustarTamanho();
    this.observador = new ResizeObserver(this.aoRedimensionar);
    this.observador.observe(this.recipiente);

    // Trocar o tema troca as cores do papel e das tintas.
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

    this.relogio = setInterval(() => this.emitirDiagnostico(), 500);
    this.ajustarTamanho();
  }

  destruir() {
    this.observador.disconnect();
    this.observadorTema.disconnect();
    clearInterval(this.relogio);
    for (const [nome, fn] of Object.entries(this.manipuladores)) this.cVivo.removeEventListener(nome, fn);
    this.folha.remove();
  }

  ajustarTamanho() {
    const largDisp = this.recipiente.clientWidth;
    if (!largDisp) return;
    // A página ocupa a largura disponível (até um limite confortável) e rola na vertical.
    const LARGURA_MAXIMA_CSS = 900;
    this.escala = Math.min(largDisp - 2, LARGURA_MAXIMA_CSS) / LARGURA;
    const largCss = Math.floor(LARGURA * this.escala);
    const altCss = Math.floor(ALTURA * this.escala);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
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

  // ---------------------------------------------------------------------------
  // Dados
  // ---------------------------------------------------------------------------

  carregar(pagina) {
    this.pagina = pagina?.camadas ? pagina : novaPaginaVazia();
    this.desfazer = [];
    this.refazer = [];
    this.desenharTudo();
  }

  camadaAtiva() {
    return this.pagina.camadas.find((c) => c.tipo === 'desenho' && !c.bloqueada);
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
    }
  }

  voltar() {
    const acao = this.desfazer.pop();
    if (!acao) return;
    this.aplicar(acao, true);
    this.refazer.push(acao);
    this.desenharTudo();
    this.aoMudar(this.pagina);
  }

  avancar() {
    const acao = this.refazer.pop();
    if (!acao) return;
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
    this.registrar({ tipo: 'limpar', camadaId: camada.id, antes });
    this.desenharTudo();
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------

  desenharPapel() {
    const x = this.xPapel;
    const estilo = getComputedStyle(document.documentElement);
    x.clearRect(0, 0, LARGURA, ALTURA);
    x.fillStyle = estilo.getPropertyValue('--papel').trim();
    x.fillRect(0, 0, LARGURA, ALTURA);
    // Pautada média: linhas a cada 34 unidades (~7 mm no A4) e margem à esquerda.
    x.strokeStyle = estilo.getPropertyValue('--papel-linha').trim();
    x.lineWidth = 1.2;
    x.beginPath();
    for (let y = 110; y < ALTURA - 40; y += 34) {
      x.moveTo(0, y);
      x.lineTo(LARGURA, y);
    }
    x.stroke();
    x.strokeStyle = estilo.getPropertyValue('--papel-margem').trim();
    x.beginPath();
    x.moveTo(90, 0);
    x.lineTo(90, ALTURA);
    x.stroke();
  }

  desenharTraco(ctx, traco, terminado = true, extras = []) {
    const pontos = extras.length ? traco.pontos.concat(extras) : traco.pontos;
    const caminho = caminhoDoContorno(getStroke(pontos, opcoesDoTraco(traco, terminado)));
    if (!caminho) return;
    ctx.fillStyle = corDaTinta(traco.tinta);
    ctx.fill(caminho);
  }

  desenharTudo() {
    if (!this.escala) return;
    this.desenharPapel();
    const x = this.xTinta;
    x.clearRect(0, 0, LARGURA, ALTURA);
    for (const camada of this.pagina.camadas) {
      if (camada.tipo !== 'desenho' || !camada.visivel) continue;
      x.globalAlpha = camada.opacidade ?? 1;
      // Marca-texto primeiro: ele fica atrás da escrita.
      for (const item of camada.itens) if (item.ferramenta === 'marca-texto') this.desenharTraco(x, item);
      for (const item of camada.itens) if (item.ferramenta !== 'marca-texto') this.desenharTraco(x, item);
    }
    x.globalAlpha = 1;
  }

  pedirQuadro() {
    if (this.quadroPedido) return;
    this.quadroPedido = true;
    requestAnimationFrame((agora) => {
      this.quadroPedido = false;
      const x = this.xVivo;
      x.clearRect(0, 0, LARGURA, ALTURA);
      if (this.atual) {
        this.desenharTraco(x, this.atual, false, this.previstos);
        if (this.ultimoTempoEvento) this.diag.atrasoQuadro = Math.max(0, agora - this.ultimoTempoEvento);
      } else if (this.cursorBorracha) {
        x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--borracha-contorno').trim();
        x.lineWidth = 1.5 / this.escala;
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

  podeDesenhar(e) {
    if (e.pointerType === 'pen') {
      this.canetaVista = true;
      return true;
    }
    if (e.pointerType === 'touch') return this.dedoDesenha; // palma e dedo não riscam
    return true; // mouse (computador)
  }

  aoApertar(e) {
    this.anotarDiagnostico(e, 1);
    if (e.pointerType === 'touch' && !this.dedoDesenha) {
      // Dedo rola a página (só se a caneta não estiver escrevendo agora).
      if (!this.atual && !this.apagando && e.isPrimary) {
        this.rolagem = { id: e.pointerId, y: e.clientY, x: e.clientX, topo: this.recipiente.scrollTop, esquerda: this.recipiente.scrollLeft };
      }
      return;
    }
    if (!e.isPrimary || !this.podeDesenhar(e)) return;
    e.preventDefault();
    try {
      this.cVivo.setPointerCapture(e.pointerId);
    } catch {
      // alguns navegadores recusam a captura; o traço segue mesmo assim
    }
    this.ponteiro = e.pointerId;

    const borracha = this.ferramenta === 'borracha' || (e.buttons & BOTAO_BORRACHA_SPEN) === BOTAO_BORRACHA_SPEN || e.button === 5;
    const camada = this.camadaAtiva();
    if (!camada) return;

    if (borracha) {
      this.apagando = { camadaId: camada.id, removidos: [] };
      this.apagarEm(this.pontoDoEvento(e));
      return;
    }

    const marca = this.ferramenta === 'marca-texto';
    this.atual = {
      id: crypto.randomUUID(),
      tipo: 'traco',
      ferramenta: marca ? 'marca-texto' : 'caneta',
      tinta: marca ? this.tintaMarca : this.tinta,
      tamanho: marca ? this.tamanhoMarca : this.tamanho,
      pressaoReal: e.pointerType === 'pen',
      suavizacao: this.suavizacao,
      pontos: [this.pontoDoEvento(e)],
    };
    this.ultimoTempoEvento = e.timeStamp;
    this.pedirQuadro();
  }

  aoMover(e) {
    const eventos = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    this.anotarDiagnostico(e, Math.max(1, eventos.length));

    if (this.rolagem && e.pointerId === this.rolagem.id) {
      if (this.atual || this.apagando) {
        this.rolagem = null; // a caneta começou a escrever: a mão apoiada não rola mais
        return;
      }
      this.recipiente.scrollTop = this.rolagem.topo - (e.clientY - this.rolagem.y);
      this.recipiente.scrollLeft = this.rolagem.esquerda - (e.clientX - this.rolagem.x);
      return;
    }

    if (e.pointerId !== this.ponteiro) {
      // Mostra o círculo da borracha mesmo sem apertar (caneta pairando ou mouse).
      if (this.ferramenta === 'borracha' && e.pointerType !== 'touch') {
        this.cursorBorracha = this.pontoDoEvento(e);
        this.pedirQuadro();
      }
      return;
    }
    e.preventDefault();
    const lista = eventos.length ? eventos : [e];

    if (this.apagando) {
      for (const ev of lista) this.apagarEm(this.pontoDoEvento(ev));
      this.cursorBorracha = this.pontoDoEvento(e);
      this.pedirQuadro();
      return;
    }
    if (!this.atual) return;
    for (const ev of lista) this.atual.pontos.push(this.pontoDoEvento(ev));
    // Pontos previstos deixam o traço "colado" na ponta da caneta (só na tela, não são salvos).
    this.previstos = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents().map((ev) => this.pontoDoEvento(ev)) : [];
    this.ultimoTempoEvento = e.timeStamp;
    this.pedirQuadro();
  }

  aoSoltar(e, cancelado = false) {
    if (this.rolagem && e.pointerId === this.rolagem.id) this.rolagem = null;
    if (e.pointerId !== this.ponteiro) return;
    this.ponteiro = null;
    this.previstos = [];

    if (this.apagando) {
      const { camadaId, removidos } = this.apagando;
      this.apagando = null;
      this.cursorBorracha = null;
      if (removidos.length) this.registrar({ tipo: 'remover', camadaId, itens: removidos });
      this.pedirQuadro();
      return;
    }

    const traco = this.atual;
    this.atual = null;
    this.xVivo.clearRect(0, 0, LARGURA, ALTURA);
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

  apagarEm([x, y]) {
    const camada = this.pagina.camadas.find((c) => c.id === this.apagando.camadaId);
    let mudou = false;
    for (let i = camada.itens.length - 1; i >= 0; i -= 1) {
      const item = camada.itens[i];
      const alcance = this.raioBorracha + item.tamanho / 2;
      const alcance2 = alcance * alcance;
      if (item.pontos.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= alcance2)) {
        this.apagando.removidos.push({ item, indice: i });
        camada.itens.splice(i, 1);
        mudou = true;
      }
    }
    if (mudou) this.desenharTudo();
  }

  // ---------------------------------------------------------------------------
  // Diagnóstico (para avaliar a caneta no tablet)
  // ---------------------------------------------------------------------------

  anotarDiagnostico(e, quantos) {
    this.diag.eventos += quantos;
    this.diag.agrupados = quantos;
    this.diag.atrasoEntrada = Math.max(0, performance.now() - e.timeStamp);
    this.diag.ultimo = {
      tipo: e.pointerType,
      pressao: e.pressure,
      inclinacaoX: e.tiltX,
      inclinacaoY: e.tiltY,
      botoes: e.buttons,
    };
  }

  emitirDiagnostico() {
    this.diag.eventosPorSegundo = this.diag.eventos * 2;
    this.diag.eventos = 0;
    this.aoDiagnostico({ ...this.diag, canetaVista: this.canetaVista, tracos: this.totalDeTracos() });
  }
}
