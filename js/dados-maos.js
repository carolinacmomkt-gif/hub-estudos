// "Com as mãos" (Meu cantinho e Mesinha, 02/11/2026): modelos para colorir, riscos e passo a passo para
// desenhar, folhas de caligrafia, ideias do dia e o contador do crochê. Tudo desenhado aqui mesmo
// (SVG, viewBox 400×400), sem imagem de fora. Sem tela e sem internet.
// Cada área de colorir é um <path data-r="id">; a cor fica em maos.dados.cores { id: n } e vira
// var(--pinta-n) (tokens em temas.css, iguais nos dois temas: são as "tintas" da caixa de lápis).

export const TIPOS_MAOS = [
  { id: 'colorir', nome: 'Colorir', emoji: '🎨', texto: 'mandalas, flores, xícara, janela' },
  { id: 'desenhar', nome: 'Desenhar', emoji: '✏️', texto: 'riscos, passo a passo, ideia do dia' },
  { id: 'escrever', nome: 'Escrever à mão', emoji: '🖋️', texto: 'uma folha só sua' },
  { id: 'caligrafia', nome: 'Caligrafia', emoji: '✒️', texto: 'letras de guia para cobrir' },
  { id: 'croche', nome: 'Crochê', emoji: '🧶', texto: 'contador de carreiras e pontos' },
  { id: 'ideia', nome: 'Outras ideias', emoji: '🪡', texto: 'tricô, bordado, quebra-cabeça…' },
];
export const tipoMaos = (id) => TIPOS_MAOS.find((t) => t.id === id) || null;

export const TOTAL_TINTAS = 16;
export const NOMES_TINTAS = ['Creme', 'Areia', 'Bege', 'Mel', 'Mostarda', 'Terracota', 'Rosa queimado', 'Vinho', 'Lavanda', 'Azul-claro', 'Azul-noite', 'Sálvia', 'Oliva', 'Musgo', 'Cinza', 'Grafite'];

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

const r2 = (n) => Math.round(n * 10) / 10;
const pol = (cx, cy, r, ang) => [r2(cx + r * Math.cos(ang)), r2(cy + r * Math.sin(ang))];
const circulo = (cx, cy, r) => `M ${r2(cx - r)} ${cy} a ${r} ${r} 0 1 0 ${r2(2 * r)} 0 a ${r} ${r} 0 1 0 ${r2(-2 * r)} 0 Z`;
const elipse = (cx, cy, rx, ry, rot = 0) => {
  // Elipse girada como caminho (para virar área de colorir).
  const pts = [];
  for (let i = 0; i < 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    const x = rx * Math.cos(t); const y = ry * Math.sin(t);
    const c = Math.cos(rot); const s = Math.sin(rot);
    pts.push([r2(cx + x * c - y * s), r2(cy + x * s + y * c)]);
  }
  return `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;
};
const poligono = (pts) => `M ${pts.map((p) => p.map(r2).join(' ')).join(' L ')} Z`;
const retangulo = (x, y, w, h, r = 0) => (r ? `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z` : `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`);

function petala(cx, cy, r0, r1, a, meia, bico = 1.12) {
  const [x0, y0] = pol(cx, cy, r0, a - meia);
  const [x1, y1] = pol(cx, cy, r0, a + meia);
  const [qa, qb] = pol(cx, cy, r1 * bico, a - meia * 0.9);
  const [qc, qd] = pol(cx, cy, r1 * bico, a + meia * 0.9);
  const [px, py] = pol(cx, cy, r1, a);
  return `M ${x0} ${y0} Q ${qa} ${qb} ${px} ${py} Q ${qc} ${qd} ${x1} ${y1} A ${r0} ${r0} 0 0 0 ${x0} ${y0} Z`;
}

// Mandala: discos (o "fundo" de cada anel) do maior para o menor, com as pétalas por cima.
function mandala(n, aneis, giro = 0) {
  const cx = 200; const cy = 200;
  const areas = [];
  const passo = 160 / (aneis + 1);
  for (let k = aneis; k >= 1; k -= 1) {
    const r1 = 30 + passo * k + (k === aneis ? 18 : 0);
    const r0 = 30 + passo * (k - 1);
    const qtd = k % 2 ? n : n * 2;
    areas.push({ id: `d${k}`, d: circulo(cx, cy, r1) });
    for (let i = 0; i < qtd; i += 1) {
      const a = (i / qtd) * Math.PI * 2 + (k % 2 ? giro : giro + Math.PI / qtd);
      areas.push({ id: `p${k}-${i}`, d: petala(cx, cy, r0, r1, a, (Math.PI / qtd) * 0.92) });
    }
  }
  areas.push({ id: 'c', d: circulo(cx, cy, 30) });
  areas.push({ id: 'c2', d: circulo(cx, cy, 13) });
  return areas;
}

function hexagonos() {
  const areas = [{ id: 'fundo', d: retangulo(0, 0, 400, 400) }];
  const s = 34; const h = Math.sqrt(3) * s;
  let n = 0;
  for (let linha = -1; linha < 400 / h + 1; linha += 1) {
    for (let col = -1; col < 400 / (1.5 * s) + 1; col += 1) {
      const cx = col * 1.5 * s; const cy = linha * h + (col % 2 ? h / 2 : 0);
      areas.push({ id: `h${n += 1}`, d: poligono([0, 1, 2, 3, 4, 5].map((i) => pol(cx, cy, s - 2, (Math.PI / 3) * i))) });
    }
  }
  return areas;
}

function triangulos() {
  const areas = [];
  const lado = 57; const alt = (Math.sqrt(3) / 2) * lado;
  let n = 0;
  for (let linha = 0; linha * alt < 400; linha += 1) {
    const y0 = linha * alt; const y1 = y0 + alt;
    const desloc = linha % 2 ? -lado / 2 : 0;
    for (let x = desloc - lado; x < 400 + lado; x += lado) {
      areas.push({ id: `t${n += 1}`, d: poligono([[x, y1], [x + lado / 2, y0], [x + lado, y1]]) });
      areas.push({ id: `t${n += 1}`, d: poligono([[x + lado / 2, y0], [x + lado * 1.5, y0], [x + lado, y1]]) });
    }
  }
  return areas;
}

function flor() {
  const areas = [{ id: 'ceu', d: retangulo(0, 0, 400, 400) }, { id: 'chao', d: retangulo(0, 330, 400, 70) }];
  areas.push({ id: 'caule', d: retangulo(193, 175, 14, 165, 6) });
  areas.push({ id: 'folha1', d: elipse(150, 270, 46, 16, -0.5) });
  areas.push({ id: 'folha2', d: elipse(250, 240, 46, 16, 0.5) });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const [x, y] = pol(200, 140, 52, a);
    areas.push({ id: `petala${i}`, d: elipse(x, y, 44, 22, a) });
  }
  areas.push({ id: 'miolo', d: circulo(200, 140, 32) });
  areas.push({ id: 'miolo2', d: circulo(200, 140, 14) });
  return { areas, linhas: ['M 150 270 L 108 290', 'M 250 240 L 292 220'] };
}

function folhagem() {
  const areas = [{ id: 'fundo', d: retangulo(0, 0, 400, 400) }, { id: 'vaso', d: poligono([[140, 300], [260, 300], [245, 390], [155, 390]]) }, { id: 'borda', d: retangulo(130, 288, 140, 22, 6) }];
  const folhas = [[-1.15, 120], [-0.6, 140], [0, 150], [0.6, 140], [1.15, 120], [-0.9, 90], [0.9, 90]];
  folhas.forEach(([a, comp], i) => {
    const [x, y] = pol(200, 290, comp * 0.62, a - Math.PI / 2);
    areas.push({ id: `folha${i}`, d: elipse(x, y, comp * 0.5, comp * 0.2, a - Math.PI / 2) });
  });
  const linhas = folhas.map(([a, comp]) => { const [x, y] = pol(200, 290, comp * 1.05, a - Math.PI / 2); return `M 200 290 L ${x} ${y}`; });
  return { areas, linhas };
}

function xicara() {
  const areas = [{ id: 'fundo', d: retangulo(0, 0, 400, 400) }, { id: 'mesa', d: retangulo(0, 330, 400, 70) }];
  areas.push({ id: 'pires', d: elipse(200, 322, 150, 26) });
  areas.push({ id: 'alca', d: `${circulo(298, 230, 42)} ${circulo(298, 230, 24)}`, regra: 'evenodd' });
  areas.push({ id: 'corpo', d: 'M 100 160 L 300 160 Q 296 300 200 312 Q 104 300 100 160 Z' });
  areas.push({ id: 'cafe', d: elipse(200, 160, 100, 18) });
  areas.push({ id: 'faixa', d: 'M 103 200 L 297 200 Q 296 222 294 232 L 106 232 Q 104 222 103 200 Z' });
  areas.push({ id: 'coracao', d: 'M 200 290 C 160 262 160 244 180 244 C 192 244 200 254 200 260 C 200 254 208 244 220 244 C 240 244 240 262 200 290 Z' });
  return { areas, linhas: ['M 160 130 Q 150 110 165 92 Q 178 74 166 56', 'M 200 128 Q 190 106 206 88 Q 220 70 207 50', 'M 240 130 Q 230 110 245 92 Q 258 74 246 56'] };
}

function janela() {
  const areas = [{ id: 'parede', d: retangulo(0, 0, 400, 400) }, { id: 'moldura', d: retangulo(70, 40, 260, 250, 8) }];
  const vidros = [[86, 56], [206, 56], [86, 172], [206, 172]];
  vidros.forEach(([x, y], i) => areas.push({ id: `vidro${i}`, d: retangulo(x, y, 108, 102, 4) }));
  areas.push({ id: 'sol', d: circulo(150, 104, 30) });
  areas.push({ id: 'nuvem', d: `${circulo(256, 120, 20)} ${circulo(280, 112, 24)} ${circulo(300, 124, 18)}` });
  areas.push({ id: 'peitoril', d: retangulo(50, 290, 300, 24, 6) });
  areas.push({ id: 'vaso', d: poligono([[160, 250], [240, 250], [230, 292], [170, 292]]) });
  for (const [i, a] of [[0, -0.9], [1, 0], [2, 0.9]]) {
    const [x, y] = pol(200, 250, 52, a - Math.PI / 2);
    areas.push({ id: `planta${i}`, d: elipse(x, y, 44, 16, a - Math.PI / 2) });
  }
  areas.push({ id: 'cortina-e', d: 'M 20 20 L 90 20 Q 70 160 96 330 L 20 330 Z' });
  areas.push({ id: 'cortina-d', d: 'M 380 20 L 310 20 Q 330 160 304 330 L 380 330 Z' });
  return { areas, linhas: ['M 0 20 L 400 20'] };
}

function casa() {
  const areas = [{ id: 'ceu', d: retangulo(0, 0, 400, 400) }, { id: 'sol', d: circulo(330, 70, 36) }];
  areas.push({ id: 'nuvem', d: `${circulo(90, 80, 22)} ${circulo(118, 70, 28)} ${circulo(146, 82, 20)}` });
  areas.push({ id: 'morro', d: 'M 0 300 Q 120 220 240 290 Q 330 250 400 280 L 400 400 L 0 400 Z' });
  areas.push({ id: 'chamine', d: retangulo(250, 120, 28, 60) });
  areas.push({ id: 'telhado', d: poligono([[110, 200], [200, 120], [290, 200]]) });
  areas.push({ id: 'parede', d: retangulo(125, 200, 150, 120) });
  areas.push({ id: 'porta', d: retangulo(185, 250, 40, 70, 4) });
  areas.push({ id: 'janela', d: retangulo(140, 220, 34, 34, 3) });
  areas.push({ id: 'janela2', d: retangulo(236, 220, 30, 30, 3) });
  areas.push({ id: 'caminho', d: 'M 190 320 L 220 320 L 250 400 L 160 400 Z' });
  return { areas, linhas: ['M 157 220 L 157 254', 'M 140 237 L 174 237'] };
}

function estrela4(cx, cy, r) {
  const p = (a, rr) => pol(cx, cy, rr, a);
  const pts = [];
  for (let i = 0; i < 8; i += 1) pts.push(p((Math.PI / 4) * i - Math.PI / 2, i % 2 ? r * 0.32 : r));
  return poligono(pts);
}

function lua() {
  const areas = [{ id: 'ceu', d: retangulo(0, 0, 400, 400) }];
  areas.push({ id: 'lua', d: `M 230 70 A 130 130 0 1 0 330 270 A 105 105 0 1 1 230 70 Z` });
  [[90, 80, 22], [320, 70, 16], [70, 300, 18], [340, 340, 24], [150, 360, 12], [360, 170, 12]].forEach(([x, y, r], i) => areas.push({ id: `estrela${i}`, d: estrela4(x, y, r) }));
  areas.push({ id: 'nuvem', d: `${circulo(150, 300, 26)} ${circulo(182, 288, 32)} ${circulo(216, 302, 24)} ${retangulo(128, 300, 110, 26, 12)}` });
  return { areas, linhas: [] };
}

const comoModelo = (x) => (Array.isArray(x) ? { areas: x, linhas: [] } : x);
export const MODELOS_COLORIR = [
  { id: 'mandala-flor', nome: 'Mandala flor', grupo: 'Mandalas', criar: () => mandala(8, 3) },
  { id: 'mandala-sol', nome: 'Mandala sol', grupo: 'Mandalas', criar: () => mandala(12, 4, 0.13) },
  { id: 'mandala-estrela', nome: 'Mandala estrela', grupo: 'Mandalas', criar: () => mandala(6, 5, 0.3) },
  { id: 'flor', nome: 'Flor', grupo: 'Flores e folhas', criar: flor },
  { id: 'folhagem', nome: 'Folhagem no vaso', grupo: 'Flores e folhas', criar: folhagem },
  { id: 'xicara', nome: 'Xícara de café', grupo: 'Cenas', criar: xicara },
  { id: 'janela', nome: 'Janela com plantas', grupo: 'Cenas', criar: janela },
  { id: 'casa', nome: 'Casinha', grupo: 'Cenas', criar: casa },
  { id: 'lua', nome: 'Lua e estrelas', grupo: 'Cenas', criar: lua },
  { id: 'hexagonos', nome: 'Favos', grupo: 'Geométricos', criar: hexagonos },
  { id: 'triangulos', nome: 'Triângulos', grupo: 'Geométricos', criar: triangulos },
];
const cacheModelo = new Map();
export function modeloColorir(id) {
  const m = MODELOS_COLORIR.find((x) => x.id === id);
  if (!m) return null;
  if (!cacheModelo.has(id)) cacheModelo.set(id, { ...m, ...comoModelo(m.criar()) });
  return cacheModelo.get(id);
}

const fillDe = (cores, id) => (cores?.[id] ? `var(--pinta-${Number(cores[id])})` : 'var(--maos-vazio)');
// SVG do desenho para colorir (interativo na tela de pintar; pequeno na galeria).
export function svgColorir(id, cores = {}, { classe = 'maos-svg', rotulo = '' } = {}) {
  const m = modeloColorir(id);
  if (!m) return '';
  return `<svg class="${classe}" viewBox="0 0 400 400" role="img" aria-label="${rotulo || m.nome}" preserveAspectRatio="xMidYMid meet">
    ${m.areas.map((a) => `<path data-r="${a.id}" d="${a.d}"${a.regra ? ` fill-rule="${a.regra}"` : ''} style="fill: ${fillDe(cores, a.id)}"/>`).join('')}
    ${m.linhas.map((d) => `<path class="maos-so-linha" d="${d}"/>`).join('')}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Desenhar: riscos para cobrir, passo a passo e ideia do dia
// ---------------------------------------------------------------------------

// O contorno de um modelo (sem as áreas de fundo), para cobrir na folha.
const FUNDOS = new Set(['ceu', 'fundo', 'parede', 'mesa', 'chao']);
export function contornoDoModelo(id) {
  const m = modeloColorir(id);
  if (!m) return [];
  return [...m.areas.filter((a) => !FUNDOS.has(a.id)).map((a) => a.d), ...m.linhas];
}
export const RISCOS = MODELOS_COLORIR.filter((m) => !['hexagonos', 'triangulos'].includes(m.id)).map((m) => ({ id: m.id, nome: m.nome }));

export const PASSO_A_PASSO = [
  { id: 'gato', nome: 'Gato', passos: [
    { texto: 'Um círculo para a cabeça.', d: [circulo(200, 150, 70)] },
    { texto: 'Duas orelhas em triângulo.', d: ['M 145 108 L 150 52 L 190 86', 'M 255 108 L 250 52 L 210 86'] },
    { texto: 'Olhos, focinho e boca.', d: [circulo(175, 145, 9), circulo(225, 145, 9), 'M 192 172 L 208 172 L 200 182 Z', 'M 200 182 Q 190 196 178 190', 'M 200 182 Q 210 196 222 190'] },
    { texto: 'O corpo, como uma gota deitada.', d: ['M 150 210 Q 110 330 170 350 L 250 350 Q 300 330 250 210'] },
    { texto: 'Patinhas e o rabo enrolado.', d: ['M 180 350 Q 182 330 192 350', 'M 214 350 Q 216 330 226 350', 'M 268 330 Q 340 320 330 260 Q 322 230 300 250'] },
    { texto: 'Bigodes. Pronto!', d: ['M 160 176 L 112 166', 'M 160 182 L 112 188', 'M 240 176 L 288 166', 'M 240 182 L 288 188'] },
  ] },
  { id: 'folha', nome: 'Folha', passos: [
    { texto: 'Uma linha curva no meio (a nervura).', d: ['M 120 320 Q 200 200 280 80'] },
    { texto: 'Um lado da folha.', d: ['M 120 320 Q 110 160 280 80'] },
    { texto: 'O outro lado.', d: ['M 120 320 Q 290 240 280 80'] },
    { texto: 'Nervuras pequenas, saindo do meio.', d: ['M 160 262 L 140 230', 'M 190 220 L 162 180', 'M 222 172 L 196 136', 'M 170 248 L 210 262', 'M 202 204 L 246 214', 'M 236 152 L 270 160'] },
    { texto: 'O cabinho. Pronto!', d: ['M 120 320 L 92 360'] },
  ] },
  { id: 'xicara', nome: 'Xícara', passos: [
    { texto: 'Uma elipse para a boca da xícara.', d: [elipse(200, 150, 100, 20)] },
    { texto: 'O corpo, descendo em curva.', d: ['M 100 150 Q 104 300 200 312 Q 296 300 300 150'] },
    { texto: 'A alça.', d: ['M 296 190 Q 360 190 352 240 Q 344 284 288 262'] },
    { texto: 'O pires embaixo.', d: [elipse(200, 322, 150, 24)] },
    { texto: 'A fumacinha. Pronto!', d: ['M 170 120 Q 160 100 175 84 Q 188 68 176 52', 'M 220 118 Q 210 98 226 80 Q 240 64 227 46'] },
  ] },
  { id: 'casa', nome: 'Casinha', passos: [
    { texto: 'Um quadrado.', d: [retangulo(125, 200, 150, 120)] },
    { texto: 'O telhado em triângulo.', d: ['M 110 200 L 200 120 L 290 200'] },
    { texto: 'A porta.', d: [retangulo(185, 250, 40, 70, 4)] },
    { texto: 'A janela com a cruz.', d: [retangulo(140, 220, 34, 34, 3), 'M 157 220 L 157 254', 'M 140 237 L 174 237'] },
    { texto: 'O chão e um sol. Pronto!', d: ['M 40 320 L 360 320', circulo(320, 80, 30)] },
  ] },
  { id: 'lua', nome: 'Lua e estrelas', passos: [
    { texto: 'Um círculo grande.', d: ['M 230 70 A 130 130 0 1 0 330 270'] },
    { texto: 'Uma curva por dentro, para virar lua crescente.', d: ['M 330 270 A 105 105 0 1 1 230 70'] },
    { texto: 'Estrelas de quatro pontas.', d: [estrela4(90, 80, 22), estrela4(320, 70, 16), estrela4(70, 300, 18)] },
    { texto: 'Uma nuvem. Pronto!', d: ['M 128 326 Q 120 300 150 296 Q 160 266 192 274 Q 220 266 228 296 Q 252 304 238 326 Z'] },
  ] },
];
export const passoAPasso = (id) => PASSO_A_PASSO.find((x) => x.id === id) || null;

export const IDEIAS_DE_DESENHO = [
  'Desenhe o que está em cima da sua mesa agora.', 'Desenhe a sua xícara favorita.', 'Desenhe uma planta da sua casa.',
  'Desenhe a vista da janela mais perto de você.', 'Desenhe as suas mãos (uma desenha a outra).', 'Desenhe três frutas.',
  'Desenhe um lugar onde você foi feliz.', 'Desenhe o céu de hoje.', 'Desenhe um animal que você ama, bem simples.',
  'Desenhe um padrão só com círculos.', 'Desenhe o seu café da manhã.', 'Desenhe uma chave antiga.',
  'Desenhe sapatos, só os contornos.', 'Desenhe uma folha de verdade, olhando para ela.', 'Desenhe uma cadeira da casa.',
  'Desenhe linhas onduladas até encher a folha.', 'Desenhe um mapa inventado.', 'Desenhe a lua de hoje.',
  'Desenhe uma flor que você nunca viu.', 'Desenhe o seu rosto com cinco linhas.', 'Desenhe uma casa onde gostaria de morar.',
  'Desenhe um prato de comida brasileira.', 'Desenhe um objeto sem tirar a caneta do papel.', 'Desenhe o que você ouviu hoje.',
];
export const ideiaDoDia = (hoje) => IDEIAS_DE_DESENHO[Math.abs(Math.floor(Date.parse(`${hoje}T12:00:00Z`) / 864e5)) % IDEIAS_DE_DESENHO.length];

// ---------------------------------------------------------------------------
// Escrever à mão e caligrafia
// ---------------------------------------------------------------------------

export const FOLHAS_ESCREVER = [
  { id: 'pautada-media', nome: 'Pautada' },
  { id: 'pontilhada', nome: 'Pontilhada' },
  { id: 'branco', nome: 'Lisa' },
];

const MINUSCULAS = 'abcdefghijklmnopqrstuvwxyz';
const repetir = (letras) => letras.split('').map((l) => `${l}${l}${l}`).reduce((linhas, g, i) => { if (i % 3 === 0) linhas.push([]); linhas[linhas.length - 1].push(g); return linhas; }, []).map((l) => l.join('   '));
export const FRASES_CALIGRAFIA = ['Um dia de cada vez.', 'Respira fundo.', 'Devagar também chega.', 'O que é meu me encontra.', 'Gentileza gera gentileza.', 'Hoje eu escolho a calma.', 'Feito é melhor que perfeito.', 'Casa, café e silêncio.', 'Tudo tem o seu tempo.'];
export const MODELOS_CALIGRAFIA = [
  { id: 'cursiva-min', nome: 'Cursiva · minúsculas', fonte: 'cursiva', linhas: repetir(MINUSCULAS) },
  { id: 'cursiva-mai', nome: 'Cursiva · maiúsculas', fonte: 'cursiva', linhas: repetir(MINUSCULAS.toUpperCase()) },
  { id: 'forma-min', nome: 'Letra de forma', fonte: 'forma', linhas: repetir(MINUSCULAS) },
  { id: 'frases', nome: 'Frases curtas', fonte: 'cursiva', linhas: FRASES_CALIGRAFIA },
  { id: 'nome', nome: 'Seu nome', fonte: 'cursiva', linhas: Array(9).fill('Carol') },
];
export const modeloCaligrafia = (id) => MODELOS_CALIGRAFIA.find((x) => x.id === id) || MODELOS_CALIGRAFIA[0];
export const FONTES_CALIGRAFIA = {
  cursiva: "'Segoe Script', 'Snell Roundhand', 'Apple Chancery', 'Dancing Script', 'Brush Script MT', cursive",
  forma: "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
};

// Fundo da folha (risco, caligrafia) como SVG no tamanho da página (1000 × altura), com as cores
// lidas do tema na hora (papel, linha e guia), para virar a imagem de fundo do editor de tinta.
export function svgFundoDaFolha({ largura = 1000, altura = 1414, tipo, modelo, passo = 0, cores }) {
  const { papel, linha, guia } = cores;
  let corpo = '';
  if (tipo === 'risco') {
    const caminhos = contornoDoModelo(modelo);
    corpo = `<g transform="translate(100 ${Math.round((altura - 800) / 2)}) scale(2)" fill="none" stroke="${guia}" stroke-opacity="0.32" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${caminhos.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  } else if (tipo === 'caligrafia') {
    const m = modeloCaligrafia(modelo);
    const topo = 130; const passoY = 140;
    corpo = m.linhas.map((t, i) => {
      const base = topo + i * passoY + 70;
      return `<line x1="70" x2="${largura - 70}" y1="${base}" y2="${base}" stroke="${linha}" stroke-opacity="0.28" stroke-width="2"/>
        <line x1="70" x2="${largura - 70}" y1="${base - 34}" y2="${base - 34}" stroke="${linha}" stroke-opacity="0.2" stroke-width="1.2" stroke-dasharray="6 8"/>
        <line x1="70" x2="${largura - 70}" y1="${base - 72}" y2="${base - 72}" stroke="${linha}" stroke-opacity="0.16" stroke-width="1"/>
        <text x="90" y="${base}" font-family="${FONTES_CALIGRAFIA[m.fonte].replace(/"/g, "'")}" font-size="${m.fonte === 'forma' ? 54 : 64}" fill="${guia}" fill-opacity="0.26" letter-spacing="${m.id === 'frases' ? 2 : 6}">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    }).join('');
  } else if (tipo === 'folha') {
    // Folha de escrever: pautada (linha a cada 7 mm), pontilhada (5 mm) ou lisa, no papel claro.
    const mm = largura / 210;
    if (modelo === 'pautada-media') {
      for (let y = 25 * mm; y < altura - 8 * mm; y += 7 * mm) corpo += `<line x1="0" x2="${largura}" y1="${r2(y)}" y2="${r2(y)}" stroke="${linha}" stroke-opacity="0.16" stroke-width="1.2"/>`;
      corpo += `<line x1="${r2(20 * mm)}" x2="${r2(20 * mm)}" y1="0" y2="${altura}" stroke="${guia}" stroke-opacity="0.22" stroke-width="1.2"/>`;
    } else if (modelo === 'pontilhada') {
      for (let y = 5 * mm; y < altura; y += 5 * mm) for (let x = 5 * mm; x < largura; x += 5 * mm) corpo += `<circle cx="${r2(x)}" cy="${r2(y)}" r="1.6" fill="${linha}" fill-opacity="0.3"/>`;
    }
  } else if (tipo === 'passo') {
    const p = passoAPasso(modelo);
    const ate = (p?.passos || []).slice(0, passo + 1).flatMap((x) => x.d);
    corpo = `<g transform="translate(100 ${Math.round((altura - 800) / 2)}) scale(2)" fill="none" stroke="${guia}" stroke-opacity="0.32" stroke-width="1.6" stroke-linecap="round">${ate.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"><rect width="100%" height="100%" fill="${papel}"/>${corpo}</svg>`;
}

// SVG do passo a passo (referência ao lado da folha): passos feitos em tom suave, o atual em destaque.
export function svgPassoAPasso(id, passo) {
  const p = passoAPasso(id);
  if (!p) return '';
  return `<svg class="maos-passo-svg" viewBox="0 0 400 400" role="img" aria-label="${p.nome}, passo ${passo + 1}">
    ${p.passos.slice(0, passo + 1).map((x, i) => x.d.map((d) => `<path class="${i === passo ? 'maos-passo-atual' : 'maos-passo-feito'}" d="${d}"/>`).join('')).join('')}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Crochê e outras ideias
// ---------------------------------------------------------------------------

export const PROJETO_VAZIO = { linha: '', agulha: '', receita: '', notas: '', carreira: 0, pontos: 0, metaCarreiras: 0, foto: null, minutos: 0 };
export const projetoDe = (linha) => ({ ...PROJETO_VAZIO, ...(linha?.dados || {}) });
export const linkSeguro = (url) => (/^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '');

export const IDEIAS_PADRAO = ['Tricô', 'Bordado', 'Ponto cruz', 'Quebra-cabeça', 'Dobradura (origami)', 'Argila ou massinha', 'Aquarela', 'Colagem com revistas', 'Macramê', 'Plantar uma muda', 'Fazer um pão', 'Pulseira de miçangas'];

export const vivosMaos = (estado, tipo) => (estado.maos || []).filter((m) => !m.excluido_em && (!tipo || m.tipo === tipo))
  .sort((a, b) => String(b.atualizado_em || b.criado_em || '').localeCompare(String(a.atualizado_em || a.criado_em || '')));

// "maos", "maos:colorir", "maos:colorir:<id>", "maos:colorir:novo:<modelo>"
export function lerParametroMaos(parametro) {
  const [, tipo = '', id = '', modelo = ''] = String(parametro || '').split(':');
  return { tipo, id, modelo };
}
