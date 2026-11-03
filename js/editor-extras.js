// Cadernos, parte 2 (Carol, 03/11/2026): ferramentas e modos extras do EditorDeTinta, instalados
// por cima dos ganchos do editor (extraApertar, extraMover, extraSoltar, extraQuadro, ajustarPonto,
// extraToque e os gestos), para o editor principal continuar do mesmo tamanho.
//
// - Letra: "Melhorar letra" (seleção, página ou sozinho depois de uma pausa), "Alinhar à pauta" e
//   "Voltar ao original" (tinta-letra.js; o traço de antes fica em traco.original).
// - Régua: faixa por cima da página; dois dedos em cima dela movem e giram (gruda a cada 15°); o traço
//   que começa perto da borda segue reto pela borda.
// - Fita de estudo: cobre um trecho; tocar revela e cobre de novo; aberta, o × tira a fita.
//   Fica em pagina.fitas [{ id, x0, y0, x1, y1 }] e só é desenhada na tela (não sai na exportação).
// - Laser: risco vermelho que some sozinho (não é salvo). Usado também no modo apresentação.
// - Leitura: nada escreve; tocar abre links e revela fitas.
// - Links: pagina.links [{ id, x0, y0, x1, y1, destino { tipo: 'pagina' | 'site' | 'caderno', ... } }].
// - Janela de zoom: faixa ampliada embaixo da página; escrever nela escreve na página, e ela anda
//   sozinha pela linha.

import { melhorarLetra, alinharAPauta, voltarAoOriginal, linhasDaEscrita } from './tinta-letra.js';
import { passoDaPauta, inicioDaPauta } from './folhas.js';

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const dentro = (c, [x, y], folga = 0) => x >= c.x0 - folga && x <= c.x1 + folga && y >= c.y0 - folga && y <= c.y1 + folga;
const normal = (c) => ({ x0: Math.min(c.x0, c.x1), y0: Math.min(c.y0, c.y1), x1: Math.max(c.x0, c.x1), y1: Math.max(c.y0, c.y1) });
const LASER_SOME_MS = 900;

export function instalarExtras(E) {
  const p = E.prototype;

  // ---------------------------------------------------------------------------
  // Letra
  // ---------------------------------------------------------------------------
  p.aplicarLetra = function aplicarLetra(fn, soSelecao = false) {
    const acoes = [];
    let mexidos = 0;
    for (const camada of this.camadasDeAcao()) {
      const alvo = soSelecao && this.selecao ? camada.itens.filter((i) => this.selecao.ids.has(i.id)) : camada.itens;
      const mud = fn(alvo);
      if (!mud.size) continue;
      const antes = [...camada.itens];
      camada.itens = camada.itens.map((i) => mud.get(i.id) || i);
      mexidos += mud.size;
      acoes.push({ tipo: 'trocar', camadaId: camada.id, antes, depois: [...camada.itens] });
    }
    if (acoes.length) this.registrar(acoes.length === 1 ? acoes[0] : { tipo: 'grupo', acoes });
    if (this.selecao) this.selecionar(this.itensSelecionados());
    this.desenharTudo();
    return mexidos;
  };
  p.melhorarLetraAgora = function (intensidade = 0.6, soSelecao = false) {
    return this.aplicarLetra((itens) => melhorarLetra(itens, intensidade), soSelecao);
  };
  p.alinharAPautaAgora = function (soSelecao = false) {
    const modelo = this.pagina.modelo || 'branco';
    const passo = passoDaPauta(modelo, this.dim);
    if (!passo) return -1;
    return this.aplicarLetra((itens) => alinharAPauta(itens, passo, inicioDaPauta(modelo, this.dim)), soSelecao);
  };
  p.voltarLetraAgora = function (soSelecao = false) {
    return this.aplicarLetra((itens) => voltarAoOriginal(itens), soSelecao);
  };
  // Sozinho depois de uma pausa: só as linhas em que ela acabou de escrever.
  p.definirLetraAutomatica = function (intensidade) {
    this.letraAuto = intensidade ? { intensidade, recentes: new Set() } : null;
    clearTimeout(this.tempoLetra);
  };
  p.agendarLetraAutomatica = function (id) {
    if (!this.letraAuto) return;
    this.letraAuto.recentes.add(id);
    clearTimeout(this.tempoLetra);
    this.tempoLetra = setTimeout(() => {
      if (this.atual || this.ponteiro !== null && this.ponteiro !== undefined) { this.agendarLetraAutomatica(id); return; }
      const recentes = this.letraAuto?.recentes;
      if (!recentes?.size) return;
      this.letraAuto.recentes = new Set();
      this.aplicarLetra((itens) => {
        const linhas = linhasDaEscrita(itens).filter((l) => l.tracos.some((x) => recentes.has(x.t.id)));
        return melhorarLetra(linhas.flatMap((l) => l.tracos.map((x) => x.t)), this.letraAuto?.intensidade || 0.5);
      });
      this.aoLetraAutomatica?.();
    }, 1800);
  };

  // ---------------------------------------------------------------------------
  // Régua
  // ---------------------------------------------------------------------------
  p.alternarRegua = function () {
    this.regua = this.regua ? null : { cx: this.dim.largura / 2, cy: this.dim.altura * 0.35, ang: 0, comp: 760, larg: 64 };
    this.pedirQuadro();
    return Boolean(this.regua);
  };
  p.girarRegua = function (graus) {
    if (!this.regua) return;
    this.regua.ang += (graus * Math.PI) / 180;
    this.pedirQuadro();
  };
  // Coordenadas da régua: u ao longo, v na perpendicular (0 = linha do meio).
  p.naRegua = function ([x, y]) {
    const r = this.regua;
    const c = Math.cos(r.ang); const s = Math.sin(r.ang);
    const dx = x - r.cx; const dy = y - r.cy;
    return { u: dx * c + dy * s, v: -dx * s + dy * c };
  };
  p.daRegua = function (u, v) {
    const r = this.regua;
    const c = Math.cos(r.ang); const s = Math.sin(r.ang);
    return [r.cx + u * c - v * s, r.cy + u * s + v * c];
  };
  p.pontoDaTela = function (cliente) {
    const r = this.cVivo.getBoundingClientRect();
    return [(cliente.x - r.left) / this.escala, (cliente.y - r.top) / this.escala];
  };
  p.extraGestoInicio = function () {
    if (!this.regua) return false;
    const [a, b] = this.pontosDosToques();
    const meio = this.pontoDaTela({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const { u, v } = this.naRegua(meio);
    if (Math.abs(u) > this.regua.comp / 2 + 30 || Math.abs(v) > this.regua.larg) return false;
    this.gestoRegua = { meio0: meio, ang0: Math.atan2(b.y - a.y, b.x - a.x), base: { ...this.regua } };
    return true;
  };
  p.extraGestoMover = function () {
    const g = this.gestoRegua;
    if (!g) return false;
    const pts = this.pontosDosToques();
    if (pts.length < 2) return true;
    const [a, b] = pts;
    const meio = this.pontoDaTela({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let ang = g.base.ang + (Math.atan2(b.y - a.y, b.x - a.x) - g.ang0);
    const passo = Math.PI / 12; // gruda a cada 15°
    const grude = Math.round(ang / passo) * passo;
    if (Math.abs(ang - grude) < 0.05) ang = grude;
    Object.assign(this.regua, { cx: g.base.cx + meio[0] - g.meio0[0], cy: g.base.cy + meio[1] - g.meio0[1], ang });
    this.pedirQuadro();
    return true;
  };
  p.extraGestoFim = function () {
    if (this.gestoRegua && this.toques.size < 2) this.gestoRegua = null;
  };
  // O traço que começa perto de uma borda da régua segue reto por ela.
  p.ajustarPonto = function (ponto, traco) {
    if (!this.regua) return ponto;
    if (!this.reguaDoTraco) this.reguaDoTraco = new WeakMap();
    let lado = this.reguaDoTraco.get(traco);
    if (lado === undefined) {
      const { u, v } = this.naRegua(traco.pontos[0]);
      const borda = this.regua.larg / 2;
      lado = Math.abs(u) <= this.regua.comp / 2 + 20 && Math.abs(Math.abs(v) - borda) < 24 ? Math.sign(v) || 1 : 0;
      this.reguaDoTraco.set(traco, lado);
      if (lado) {
        const encostado = this.daRegua(u, lado * (borda + (traco.tamanho || 3) / 2));
        traco.pontos[0] = [encostado[0], encostado[1], traco.pontos[0][2]];
      }
    }
    if (!lado) return ponto;
    const { u } = this.naRegua(ponto);
    const [x, y] = this.daRegua(u, lado * (this.regua.larg / 2 + (traco.tamanho || 3) / 2));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, ponto[2]];
  };
  p.desenharRegua = function (x) {
    const r = this.regua;
    x.save();
    x.translate(r.cx, r.cy);
    x.rotate(r.ang);
    x.globalAlpha = 0.82;
    x.fillStyle = cssVar('--cor-superficie-elevada') || '#353535';
    x.strokeStyle = cssVar('--cor-borda') || '#474747';
    x.lineWidth = 1 / this.escala;
    x.beginPath();
    if (x.roundRect) x.roundRect(-r.comp / 2, -r.larg / 2, r.comp, r.larg, 6); else x.rect(-r.comp / 2, -r.larg / 2, r.comp, r.larg);
    x.fill();
    x.stroke();
    x.globalAlpha = 1;
    // Marcas a cada milímetro (maiores a cada 5 e 10), com os centímetros escritos.
    const mm = this.dim.mm || 4.76;
    x.strokeStyle = cssVar('--cor-texto-suave') || '#C7B6A5';
    x.fillStyle = x.strokeStyle;
    x.font = `${Math.max(9, 11)}px system-ui, sans-serif`;
    x.textAlign = 'center';
    const total = Math.floor(r.comp / mm);
    x.beginPath();
    for (let i = 0; i <= total; i += 1) {
      const px = -r.comp / 2 + i * mm;
      const tam = i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 6;
      x.moveTo(px, -r.larg / 2);
      x.lineTo(px, -r.larg / 2 + tam);
    }
    x.stroke();
    for (let i = 10; i < total; i += 10) x.fillText(String(i / 10), -r.comp / 2 + i * mm, -r.larg / 2 + 30);
    x.restore();
  };

  // ---------------------------------------------------------------------------
  // Fitas de estudo, laser, leitura e links
  // ---------------------------------------------------------------------------
  p.fitas = function () { return this.pagina.fitas || []; };
  p.fitaNoPonto = function (ponto) { return [...this.fitas()].reverse().find((f) => dentro(f, ponto)); };
  p.xDaFita = function (f) { const t = 26 / this.escala; return { x0: f.x1 - t, y0: f.y0, x1: f.x1, y1: f.y0 + t }; };
  p.tocarFita = function (ponto) {
    const f = this.fitaNoPonto(ponto);
    if (!f) return false;
    if (!this.fitasAbertas) this.fitasAbertas = new Set();
    if (this.fitasAbertas.has(f.id) && dentro(this.xDaFita(f), ponto, 4 / this.escala) && !this.somenteLeitura) {
      this.pagina.fitas = this.fitas().filter((x) => x.id !== f.id);
      this.aoMudar(this.pagina);
    } else if (this.fitasAbertas.has(f.id)) this.fitasAbertas.delete(f.id);
    else this.fitasAbertas.add(f.id);
    this.pedirQuadro();
    return true;
  };
  p.cobrirTodasAsFitas = function () { this.fitasAbertas = new Set(); this.pedirQuadro(); };
  p.tirarTodasAsFitas = function () { this.pagina.fitas = []; this.aoMudar(this.pagina); this.pedirQuadro(); };
  p.desenharFitas = function (x) {
    const abertas = this.fitasAbertas || new Set();
    for (const f of this.fitas()) {
      const w = f.x1 - f.x0; const h = f.y1 - f.y0;
      if (abertas.has(f.id)) {
        x.save();
        x.strokeStyle = cssVar('--cor-destaque') || '#C9B7A4';
        x.lineWidth = 1.5 / this.escala;
        x.setLineDash([6 / this.escala, 5 / this.escala]);
        x.strokeRect(f.x0, f.y0, w, h);
        x.setLineDash([]);
        if (!this.somenteLeitura) {
          const c = this.xDaFita(f);
          x.fillStyle = x.strokeStyle;
          x.font = `${Math.round(20 / this.escala)}px system-ui, sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('×', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
        }
        x.restore();
      } else {
        x.save();
        x.fillStyle = cssVar('--cor-preenchido') || '#4A4038';
        x.fillRect(f.x0, f.y0, w, h);
        x.strokeStyle = cssVar('--cor-sobre-preenchido') || '#EBDCCB';
        x.globalAlpha = 0.18;
        x.lineWidth = 6;
        x.beginPath();
        x.rect(f.x0, f.y0, w, h);
        x.clip();
        x.beginPath();
        for (let d = -h; d < w; d += 22) { x.moveTo(f.x0 + d, f.y1); x.lineTo(f.x0 + d + h, f.y0); }
        x.stroke();
        x.restore();
      }
    }
  };
  p.links = function () { return this.pagina.links || []; };
  p.linkNoPonto = function (ponto) { return this.links().find((l) => dentro(l, ponto, 4)); };
  p.criarLinkDaSelecao = function (destino) {
    if (!this.selecao) return false;
    const c = this.selecao.caixa;
    this.pagina.links = [...this.links(), { id: crypto.randomUUID(), x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, destino }];
    this.aoMudar(this.pagina);
    this.pedirQuadro();
    return true;
  };
  p.tirarLinksDaSelecao = function () {
    if (!this.selecao) return 0;
    const c = this.selecao.caixa;
    const antes = this.links().length;
    this.pagina.links = this.links().filter((l) => !(l.x0 >= c.x0 - 2 && l.x1 <= c.x1 + 2 && l.y0 >= c.y0 - 2 && l.y1 <= c.y1 + 2));
    if (this.pagina.links.length !== antes) { this.aoMudar(this.pagina); this.pedirQuadro(); }
    return antes - this.pagina.links.length;
  };
  p.desenharLinks = function (x) {
    x.save();
    x.strokeStyle = cssVar('--tinta-azul') || '#8DB7EC';
    x.lineWidth = 2 / this.escala;
    x.setLineDash([3 / this.escala, 3 / this.escala]);
    for (const l of this.links()) {
      x.beginPath();
      x.moveTo(l.x0, l.y1 + 3);
      x.lineTo(l.x1, l.y1 + 3);
      x.stroke();
    }
    x.restore();
  };
  // Toque com o dedo (ou caneta no modo leitura): fita, depois link.
  p.extraToque = function (ponto) {
    if (this.tocarFita(ponto)) return true;
    const l = this.linkNoPonto(ponto);
    if (l) { this.aoLink?.(l.destino); return true; }
    return false;
  };

  p.extraApertar = function (e, ponto) {
    if (this.somenteLeitura) {
      this.ponteiro = null;
      if (this.ferramenta === 'laser') return this.extraApertarLaser(e, ponto);
      this.extraToque(ponto);
      return true;
    }
    if (this.ferramenta === 'laser') return this.extraApertarLaser(e, ponto);
    if (this.ferramenta === 'fita') {
      if (this.tocarFita(ponto)) { this.ponteiro = null; return true; }
      this.fitaNova = { x0: ponto[0], y0: ponto[1], x1: ponto[0], y1: ponto[1] };
      return true;
    }
    return false;
  };
  p.extraApertarLaser = function (e, ponto) {
    this.ponteiro = e.pointerId;
    if (!this.lasers) this.lasers = [];
    this.laserAtual = { pontos: [ponto], fim: null };
    this.lasers.push(this.laserAtual);
    this.pedirQuadro();
    return true;
  };
  p.extraMover = function (e, ponto, lista) {
    if (this.laserAtual) {
      for (const ev of lista) this.laserAtual.pontos.push(this.pontoDoEvento(ev));
      this.pedirQuadro();
      return true;
    }
    if (this.fitaNova) {
      this.fitaNova.x1 = ponto[0];
      this.fitaNova.y1 = ponto[1];
      this.pedirQuadro();
      return true;
    }
    return false;
  };
  p.extraSoltar = function () {
    if (this.laserAtual) {
      this.laserAtual.fim = performance.now();
      this.laserAtual = null;
      this.pedirQuadro();
      return true;
    }
    if (this.fitaNova) {
      const f = normal(this.fitaNova);
      this.fitaNova = null;
      if (f.x1 - f.x0 > 12 && f.y1 - f.y0 > 8) {
        this.pagina.fitas = [...this.fitas(), { id: crypto.randomUUID(), ...f }];
        this.aoMudar(this.pagina);
      }
      this.pedirQuadro();
      return true;
    }
    // Traço novo de caneta: entra na fila do "melhorar sozinho".
    if (this.atual && this.letraAuto && this.atual.ferramenta !== 'marca-texto') this.agendarLetraAutomatica(this.atual.id);
    if (this.janela && this.naJanela && this.atual) this.avancarJanela(this.atual);
    return false;
  };
  p.desenharLasers = function (x, agora) {
    if (!this.lasers?.length) return;
    const t = performance.now();
    this.lasers = this.lasers.filter((l) => !l.fim || t - l.fim < LASER_SOME_MS);
    const cor = cssVar('--urg-atrasado') || '#EC7C66';
    x.save();
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.shadowColor = cor;
    x.shadowBlur = 12;
    for (const l of this.lasers) {
      x.globalAlpha = l.fim ? Math.max(0, 1 - (t - l.fim) / LASER_SOME_MS) : 1;
      x.strokeStyle = cor;
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(l.pontos[0][0], l.pontos[0][1]);
      for (const pt of l.pontos) x.lineTo(pt[0], pt[1]);
      x.stroke();
    }
    x.restore();
    if (this.lasers.length) requestAnimationFrame(() => this.pedirQuadro());
    return agora;
  };

  // ---------------------------------------------------------------------------
  // Janela de zoom
  // ---------------------------------------------------------------------------
  p.abrirJanela = function (recipienteJanela) {
    if (this.janela) return;
    const div = document.createElement('div');
    div.className = 'janela-zoom';
    div.innerHTML = `
      <canvas class="janela-zoom-folha" aria-label="Janela de zoom: escreva aqui com a letra grande"></canvas>
      <div class="janela-zoom-botoes">
        <button type="button" class="ferramenta-botao" data-janela="voltar" aria-label="Voltar um pouco">‹</button>
        <button type="button" class="ferramenta-botao" data-janela="andar" aria-label="Andar um pouco">›</button>
        <button type="button" class="ferramenta-botao" data-janela="linha" aria-label="Próxima linha">↵</button>
        <button type="button" class="ferramenta-botao" data-janela="fechar" aria-label="Fechar a janela de zoom">×</button>
      </div>`;
    recipienteJanela.append(div);
    this.divJanela = div;
    this.cJanela = div.querySelector('canvas');
    this.xJanela = this.cJanela.getContext('2d');
    const passo = passoDaPauta(this.pagina.modelo || 'branco', this.dim) || 40;
    const inicio = inicioDaPauta(this.pagina.modelo || 'branco', this.dim) || 120;
    this.janela = { x: 60, y: inicio - passo * 1.6, w: 300, h: passo * 2.2, passo };
    this.pontoDaJanela = (e) => {
      const r = this.cJanela.getBoundingClientRect();
      const f = r.width / this.janela.w;
      const pr = e.pointerType === 'pen' ? Math.max(0.02, e.pressure || 0.5) : 0.5;
      return [Math.round((this.janela.x + (e.clientX - r.left) / f) * 10) / 10, Math.round((this.janela.y + (e.clientY - r.top) / f) * 10) / 10, Math.round(pr * 100) / 100];
    };
    const c = this.cJanela;
    this.manipJanela = {
      pointerdown: (e) => {
        if (e.pointerType === 'touch' && !this.dedoDesenha) return;
        this.naJanela = true;
        this.aoApertar(e);
      },
      pointermove: (e) => { if (this.naJanela) this.aoMover(e); },
      pointerup: (e) => { if (this.naJanela) { this.aoSoltar(e); this.naJanela = false; } },
      pointercancel: (e) => { if (this.naJanela) { this.aoSoltar(e, true); this.naJanela = false; } },
    };
    for (const [n, fn] of Object.entries(this.manipJanela)) c.addEventListener(n, fn, { passive: false });
    this.cliqueJanela = (e) => {
      const b = e.target.closest('[data-janela]');
      if (!b) return;
      const j = this.janela;
      if (b.dataset.janela === 'fechar') this.fecharJanela();
      else if (b.dataset.janela === 'andar') j.x = Math.min(this.dim.largura - j.w, j.x + j.w * 0.6);
      else if (b.dataset.janela === 'voltar') j.x = Math.max(0, j.x - j.w * 0.6);
      else if (b.dataset.janela === 'linha') { j.x = 60; j.y += j.passo; }
      this.mostrarJanelaNaTela();
      this.pedirQuadro();
    };
    div.addEventListener('click', this.cliqueJanela);
    this.ajustarJanela();
    this.mostrarJanelaNaTela();
    this.pedirQuadro();
  };
  p.ajustarJanela = function () {
    if (!this.cJanela) return;
    const larg = this.cJanela.clientWidth || 600;
    const alt = this.cJanela.clientHeight || 180;
    const dpr = window.devicePixelRatio || 1;
    this.cJanela.width = Math.round(larg * dpr);
    this.cJanela.height = Math.round(alt * dpr);
    this.janela.h = (this.janela.w * alt) / larg;
  };
  p.fecharJanela = function () {
    if (!this.janela) return;
    for (const [n, fn] of Object.entries(this.manipJanela)) this.cJanela.removeEventListener(n, fn);
    this.divJanela.removeEventListener('click', this.cliqueJanela);
    this.divJanela.remove();
    this.janela = null;
    this.cJanela = null;
    this.pontoDaJanela = null;
    this.pedirQuadro();
    this.aoFecharJanela?.();
  };
  // Anda sozinha: perto do fim da janela, ela avança; no fim da página, vai para a próxima linha.
  p.avancarJanela = function (traco) {
    const j = this.janela;
    const ultimoX = Math.max(...traco.pontos.map((pt) => pt[0]));
    if (ultimoX < j.x + j.w * 0.78) return;
    j.x += j.w * 0.55;
    if (j.x + j.w > this.dim.largura - 20) { j.x = 60; j.y += j.passo; }
    this.mostrarJanelaNaTela();
  };
  p.mostrarJanelaNaTela = function () {
    const j = this.janela;
    if (!j) return;
    const r = this.recipiente;
    const topo = j.y * this.escala;
    if (topo < r.scrollTop + 40 || topo + j.h * this.escala > r.scrollTop + r.clientHeight - 40) r.scrollTop = Math.max(0, topo - r.clientHeight / 3);
  };
  p.desenharJanela = function (x) {
    const j = this.janela;
    // Onde a janela está na página.
    x.save();
    x.strokeStyle = cssVar('--cor-destaque') || '#C9B7A4';
    x.lineWidth = 2 / this.escala;
    x.strokeRect(j.x, j.y, j.w, j.h);
    x.restore();
    // A faixa ampliada: papel + tinta + o traço em andamento.
    const cj = this.xJanela;
    const W = this.cJanela.width; const H = this.cJanela.height;
    const f = this.escala * this.dpr;
    cj.setTransform(1, 0, 0, 1, 0, 0);
    cj.clearRect(0, 0, W, H);
    for (const origem of [this.cPapel, this.cTinta]) cj.drawImage(origem, j.x * f, j.y * f, j.w * f, j.h * f, 0, 0, W, H);
    if (this.atual) {
      const fj = W / j.w;
      cj.setTransform(fj, 0, 0, fj, -j.x * fj, -j.y * fj);
      this.desenharTraco(cj, this.atual, false, this.previstos);
      cj.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  // Tudo que é desenhado por cima, a cada quadro.
  p.extraQuadro = function (x, agora) {
    if (this.fitas().length) this.desenharFitas(x);
    if (this.fitaNova) {
      const f = normal(this.fitaNova);
      x.save();
      x.fillStyle = cssVar('--cor-preenchido') || '#4A4038';
      x.globalAlpha = 0.7;
      x.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
      x.restore();
    }
    if (this.links().length) this.desenharLinks(x);
    if (this.regua) this.desenharRegua(x);
    if (this.janela) this.desenharJanela(x);
    this.desenharLasers(x, agora);
  };
}
