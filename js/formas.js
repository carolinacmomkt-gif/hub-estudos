// Formas com auto-ajuste: ao segurar a caneta parada no fim do traço, o rabisco vira
// linha reta, triângulo, retângulo ou elipse. Funções puras (pontos [x, y, pressão]).

const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function comprimento(pontos) {
  let total = 0;
  for (let i = 1; i < pontos.length; i += 1) total += distancia(pontos[i - 1], pontos[i]);
  return total;
}

function distanciaAoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (!l2) return distancia(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Ramer–Douglas–Peucker: os "cantos" do rabisco.
export function simplificar(pontos, tolerancia) {
  if (pontos.length < 3) return pontos.slice();
  let maior = 0;
  let indice = 0;
  for (let i = 1; i < pontos.length - 1; i += 1) {
    const d = distanciaAoSegmento(pontos[i], pontos[0], pontos[pontos.length - 1]);
    if (d > maior) {
      maior = d;
      indice = i;
    }
  }
  if (maior <= tolerancia) return [pontos[0], pontos[pontos.length - 1]];
  const esquerda = simplificar(pontos.slice(0, indice + 1), tolerancia);
  const direita = simplificar(pontos.slice(indice), tolerancia);
  return esquerda.slice(0, -1).concat(direita);
}

function caixa(pontos) {
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x0, y0, x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Pontos densos ao longo de uma polilinha (para o traço continuar "caligráfico").
function densificar(vertices, pressao, passo = 4) {
  const saida = [];
  for (let i = 1; i < vertices.length; i += 1) {
    const a = vertices[i - 1];
    const b = vertices[i];
    const n = Math.max(1, Math.round(distancia(a, b) / passo));
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      saida.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, pressao]);
    }
  }
  const ultimo = vertices[vertices.length - 1];
  saida.push([ultimo[0], ultimo[1], pressao]);
  return saida.map(([x, y, p]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, p]);
}

function elipse({ x0, y0, x1, y1 }, pressao) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const n = Math.max(24, Math.round((Math.PI * (rx + ry)) / 4));
  const vertices = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    vertices.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return densificar(vertices, pressao, 6);
}

// Se a linha é quase horizontal/vertical, endireita de vez (como no GoodNotes).
function alinharLinha(a, b) {
  const angulo = Math.abs((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) % 180;
  if (angulo < 6 || angulo > 174) return [a, [b[0], a[1]]];
  if (Math.abs(angulo - 90) < 6) return [a, [a[0], b[1]]];
  return [a, b];
}

// Devolve { forma, pontos } ou null se o rabisco não parece nenhuma forma.
export function reconhecerForma(pontos) {
  if (pontos.length < 4) return null;
  const total = comprimento(pontos);
  if (total < 30) return null;
  const pressao = Math.round((pontos.reduce((s, p) => s + (p[2] ?? 0.5), 0) / pontos.length) * 100) / 100;
  const inicio = pontos[0];
  const fim = pontos[pontos.length - 1];

  // Linha: nenhum ponto se afasta muito do segmento entre as pontas.
  const desvio = Math.max(...pontos.map((p) => distanciaAoSegmento(p, inicio, fim)));
  if (desvio < Math.max(6, distancia(inicio, fim) * 0.08)) {
    return { forma: 'linha', pontos: densificar(alinharLinha(inicio, fim), pressao) };
  }

  // Forma fechada: as pontas quase se encontram.
  const c = caixa(pontos);
  const diagonal = Math.hypot(c.x1 - c.x0, c.y1 - c.y0);
  if (distancia(inicio, fim) > Math.max(25, diagonal * 0.2) || diagonal < 20) return null;

  const fechado = pontos.concat([inicio]);
  let cantos = simplificar(fechado, diagonal * 0.09);
  // Junta cantos muito próximos (a volta final costuma repetir o primeiro).
  cantos = cantos.filter((p, i) => i === 0 || distancia(p, cantos[i - 1]) > diagonal * 0.12);
  if (cantos.length > 1 && distancia(cantos[0], cantos[cantos.length - 1]) < diagonal * 0.12) cantos.pop();

  if (cantos.length === 3) return { forma: 'triangulo', pontos: densificar([...cantos, cantos[0]], pressao) };
  if (cantos.length === 4) {
    // Retângulo alinhado à página (o caso mais comum ao estudar: caixas e tabelas).
    const v = [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1], [c.x0, c.y0]];
    return { forma: 'retangulo', pontos: densificar(v, pressao) };
  }
  return { forma: 'elipse', pontos: elipse(c, pressao) };
}
