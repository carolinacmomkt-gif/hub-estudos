// Legibilidade da letra (Cadernos, parte 2): "Melhorar letra" e "Alinhar à pauta".
// Sem DOM, para dar para testar sozinho. Tudo em unidades da página (largura 1000).
//
// Melhorar letra (não destrutivo): agrupa os traços em linhas e palavras, endireita a linha de base,
// uniformiza a inclinação, o tamanho e o espaço entre as palavras, na intensidade escolhida
// (0 a 1), mantendo o jeito de escrever. Cada traço mexido guarda os pontos de antes em
// "original" (só na primeira vez), e "voltarAoOriginal" desfaz a qualquer momento.
// Alinhar à pauta: cada linha de escrita desce ou sobe até a linha da folha mais perto.

const ehEscrita = (t) => t?.tipo === 'traco' && t.ferramenta !== 'marca-texto' && !t.forma && (t.pontos?.length || 0) > 1;
const mediana = (l) => { if (!l.length) return 0; const s = [...l].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantil = (l, q) => { if (!l.length) return 0; const s = [...l].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const arred = (n) => Math.round(n * 10) / 10;

function caixa(pontos) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pontos) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, cy: (y0 + y1) / 2 };
}

// Linhas e palavras da escrita (só traços de caneta; formas, marca-texto e caixas ficam como estão).
export function linhasDaEscrita(itens) {
  const tracos = itens.filter(ehEscrita).map((t) => ({ t, c: caixa(t.pontos) }));
  if (!tracos.length) return [];
  const altura = Math.max(10, mediana(tracos.map((x) => x.c.y1 - x.c.y0)));
  // Segue a escrita da esquerda para a direita: um traço entra na linha cujo último traço ele
  // cobre na vertical (assim uma linha torta continua sendo uma linha só). Pingo do "i" e acento
  // entram pela faixa da linha.
  const linhas = [];
  const sobrepoe = (a, b) => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  for (const x of [...tracos].sort((a, b) => a.c.x0 - b.c.x0)) {
    let melhor = null; let valor = 0;
    for (const l of linhas) {
      const ult = l.ultima;
      const s = sobrepoe(x.c, ult) / Math.max(1, Math.min(x.c.y1 - x.c.y0, ult.y1 - ult.y0) || 1);
      const perto = x.c.x0 - ult.x1 < altura * 10; // espaços grandes entre palavras continuam na mesma linha
      const naFaixa = x.c.cy > ult.y0 - altura * 0.8 && x.c.cy < ult.y1 + altura * 0.3;
      const nota = perto ? (s > 0.25 ? 1 + s : naFaixa ? 0.5 : 0) : 0;
      if (nota > valor) { valor = nota; melhor = l; }
    }
    if (melhor) {
      melhor.tracos.push(x);
      if (x.c.y1 - x.c.y0 > altura * 0.3) melhor.ultima = x.c;
    } else linhas.push({ tracos: [x], ultima: x.c });
  }
  for (const l of linhas) l.cy = l.tracos.reduce((s, y) => s + y.c.cy, 0) / l.tracos.length;
  for (const linha of linhas) {
    const alt = Math.max(8, mediana(linha.tracos.map((x) => x.c.y1 - x.c.y0)));
    const folga = Math.max(6, alt * 0.45);
    const palavras = [];
    for (const x of [...linha.tracos].sort((a, b) => a.c.x0 - b.c.x0)) {
      const ultima = palavras[palavras.length - 1];
      if (ultima && x.c.x0 <= ultima.x1 + folga) {
        ultima.tracos.push(x.t);
        ultima.x1 = Math.max(ultima.x1, x.c.x1);
      } else palavras.push({ tracos: [x.t], x0: x.c.x0, x1: x.c.x1 });
    }
    linha.palavras = palavras;
  }
  return linhas.sort((a, b) => a.cy - b.cy);
}

const pontosDe = (tracos) => tracos.flatMap((t) => t.pontos);
// Linha de base de um grupo: perto do fundo das letras (o que desce, como "g" e "p", fica de fora).
const baseDe = (tracos) => quantil(pontosDe(tracos).map((p) => p[1]), 0.8);
const corpoDe = (tracos) => { const ys = pontosDe(tracos).map((p) => p[1]); return Math.max(4, quantil(ys, 0.8) - quantil(ys, 0.15)); };

// Inclinação das letras: média ponderada de dx/dy nos trechos quase verticais.
function inclinacao(tracos) {
  let soma = 0; let peso = 0;
  for (const t of tracos) {
    for (let i = 1; i < t.pontos.length; i += 1) {
      const dx = t.pontos[i][0] - t.pontos[i - 1][0];
      const dy = t.pontos[i][1] - t.pontos[i - 1][1];
      if (Math.abs(dy) < 1.5 || Math.abs(dx) > Math.abs(dy) * 0.8) continue;
      const comp = Math.hypot(dx, dy);
      soma += (dx / dy) * comp; peso += comp;
    }
  }
  return peso ? Math.max(-0.6, Math.min(0.6, soma / peso)) : 0;
}

const novoTraco = (t, pontos) => ({ ...t, original: t.original || t.pontos, pontos: pontos.map(([x, y, p]) => [arred(x), arred(y), p]) });

// Devolve um Map id → traço novo (só os que mudaram). intensidade de 0 a 1.
export function melhorarLetra(itens, intensidade = 0.6) {
  const k = Math.max(0, Math.min(1, intensidade));
  const linhas = linhasDaEscrita(itens);
  const mudados = new Map();
  if (!linhas.length || !k) return mudados;
  const corpoAlvo = mediana(linhas.flatMap((l) => l.palavras.map((w) => corpoDe(w.tracos))));
  for (const linha of linhas) {
    const pal = linha.palavras;
    // 1. Linha de base reta: reta pelas bases das palavras; cada ponto sobe ou desce até ela ficar horizontal.
    const bases = pal.map((w) => ({ x: (w.x0 + w.x1) / 2, b: baseDe(w.tracos) }));
    const mx = bases.reduce((s, p) => s + p.x, 0) / bases.length;
    const mb = bases.reduce((s, p) => s + p.b, 0) / bases.length;
    const den = bases.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const m = den > 0 && bases.length > 1 ? bases.reduce((s, p) => s + (p.x - mx) * (p.b - mb), 0) / den : 0;
    const declive = Math.max(-0.35, Math.min(0.35, m));
    const incl = inclinacao(linha.tracos.map((x) => x.t));
    const trabalho = pal.map((w) => {
      // Cada palavra: endireita, sobe/desce até a base comum, ajusta a inclinação e o tamanho.
      const baseW = baseDe(w.tracos);
      const baseNaReta = mb + declive * ((w.x0 + w.x1) / 2 - mx);
      const corpo = corpoDe(w.tracos);
      const escala = Math.max(0.75, Math.min(1.3, 1 + k * (corpoAlvo / corpo - 1)));
      const ajusteBase = k * (baseNaReta - baseW) * 0.5; // palavras soltas se aproximam da reta
      const tracos = w.tracos.map((t) => ({
        t,
        pontos: t.pontos.map(([x, y, p]) => {
          let ny = y - k * declive * (x - mx) + ajusteBase;
          const base = mb + (1 - k) * declive * (x - mx);
          let nx = x - k * incl * (ny - base);
          nx = w.x0 + (nx - w.x0) * escala;
          ny = base + (ny - base) * escala;
          return [nx, ny, p];
        }),
      }));
      const xs = tracos.flatMap((x) => x.pontos.map((p) => p[0]));
      return { tracos, x0: Math.min(...xs), x1: Math.max(...xs) };
    });
    // 2. Espaço entre as palavras: cada vão vai na direção do vão do meio.
    const vaos = trabalho.slice(1).map((w, i) => w.x0 - trabalho[i].x1).filter((v) => v > 0);
    const vaoAlvo = mediana(vaos);
    let desloc = 0;
    trabalho.forEach((w, i) => {
      if (i > 0 && vaoAlvo) {
        const vao = w.x0 + desloc - (trabalho[i - 1].x1 + trabalho[i - 1].desloc);
        desloc += k * (vaoAlvo - vao);
      }
      w.desloc = desloc;
      for (const x of w.tracos) mudados.set(x.t.id, novoTraco(x.t, x.pontos.map(([px, py, p]) => [px + desloc, py, p])));
    });
  }
  return mudados;
}

// Alinhar à pauta: cada linha de escrita vai para a linha da folha mais perto (passo e início em
// unidades da página). Devolve um Map id → traço novo.
export function alinharAPauta(itens, passo, inicio = passo) {
  const mudados = new Map();
  if (!passo) return mudados;
  for (const linha of linhasDaEscrita(itens)) {
    const tracos = linha.tracos.map((x) => x.t);
    const base = baseDe(tracos);
    const alvo = inicio + Math.max(0, Math.round((base - inicio) / passo)) * passo;
    const dy = alvo - base;
    if (Math.abs(dy) < 0.5) continue;
    for (const t of tracos) mudados.set(t.id, novoTraco(t, t.pontos.map(([x, y, p]) => [x, y + dy, p])));
  }
  return mudados;
}

// Volta os traços mexidos aos pontos de antes (o que nunca foi mexido fica igual).
export function voltarAoOriginal(itens) {
  const mudados = new Map();
  for (const t of itens) {
    if (t?.tipo !== 'traco' || !t.original) continue;
    const { original, ...resto } = t;
    mudados.set(t.id, { ...resto, pontos: original });
  }
  return mudados;
}

export const temOriginal = (itens) => itens.some((t) => t?.tipo === 'traco' && t.original);
