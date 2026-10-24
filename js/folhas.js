// Modelos de folha e tamanhos de página.
// A página tem sempre 1000 unidades de largura; a altura sai da proporção do papel.
// As linhas usam medidas reais (mm), convertidas pela largura do papel.

export const TAMANHOS_PAPEL = {
  A4: { nome: 'A4', mm: [210, 297] },
  A5: { nome: 'A5', mm: [148, 210] },
  Carta: { nome: 'Carta', mm: [216, 279] },
  Tablet: { nome: 'Tela do tablet', mm: [160, 256] }, // 16:10, como o Tab S10 Lite
};

export const MODELOS_BASICOS = [
  { id: 'branco', nome: 'Em branco' },
  { id: 'pautada-estreita', nome: 'Pautada estreita' },
  { id: 'pautada-media', nome: 'Pautada média' },
  { id: 'pautada-larga', nome: 'Pautada larga' },
  { id: 'quadriculada-5mm', nome: 'Quadriculada 5 mm' },
  { id: 'quadriculada-1cm', nome: 'Quadriculada 1 cm' },
  { id: 'pontilhada', nome: 'Pontilhada' },
  { id: 'milimetrada', nome: 'Milimetrada' },
];

// { largura: 1000, altura, mm: unidades por milímetro }
export function dimensoes(tamanho = 'A4', orientacao = 'retrato') {
  const [l, a] = (TAMANHOS_PAPEL[tamanho] || TAMANHOS_PAPEL.A4).mm;
  const [largMm, altMm] = orientacao === 'paisagem' ? [a, l] : [l, a];
  return { largura: 1000, altura: Math.round((1000 * altMm) / largMm), mm: 1000 / largMm };
}

const PAUTAS = { 'pautada-estreita': 6, 'pautada-media': 7, 'pautada-larga': 8.7 };

function linhasHorizontais(x, dim, passo, inicio) {
  x.beginPath();
  for (let y = inicio; y < dim.altura - passo * 0.5; y += passo) {
    x.moveTo(0, y);
    x.lineTo(dim.largura, y);
  }
  x.stroke();
}

function grade(x, dim, passo) {
  x.beginPath();
  for (let y = passo; y < dim.altura; y += passo) {
    x.moveTo(0, y);
    x.lineTo(dim.largura, y);
  }
  for (let xx = passo; xx < dim.largura; xx += passo) {
    x.moveTo(xx, 0);
    x.lineTo(xx, dim.altura);
  }
  x.stroke();
}

// Desenha o fundo no contexto (já em unidades da página).
export function desenharFolha(x, modelo, dim, cores) {
  x.clearRect(0, 0, dim.largura, dim.altura);
  x.fillStyle = cores.papel;
  x.fillRect(0, 0, dim.largura, dim.altura);
  x.strokeStyle = cores.linha;
  x.fillStyle = cores.linha;
  x.lineWidth = 1.2;
  const mm = dim.mm;

  if (PAUTAS[modelo]) {
    linhasHorizontais(x, dim, PAUTAS[modelo] * mm, 25 * mm);
    x.strokeStyle = cores.margem;
    x.beginPath();
    x.moveTo(20 * mm, 0);
    x.lineTo(20 * mm, dim.altura);
    x.stroke();
  } else if (modelo === 'quadriculada-5mm') {
    grade(x, dim, 5 * mm);
  } else if (modelo === 'quadriculada-1cm') {
    grade(x, dim, 10 * mm);
  } else if (modelo === 'pontilhada') {
    const passo = 5 * mm;
    for (let y = passo; y < dim.altura; y += passo) {
      for (let xx = passo; xx < dim.largura; xx += passo) x.fillRect(xx - 1.3, y - 1.3, 2.6, 2.6);
    }
  } else if (modelo === 'milimetrada') {
    x.lineWidth = 0.5;
    grade(x, dim, mm);
    x.lineWidth = 1.4;
    grade(x, dim, 10 * mm);
  }
}

// Espaço entre linhas do modelo (para alinhar à pauta depois); null se não tem linhas.
export function passoDaPauta(modelo, dim) {
  if (PAUTAS[modelo]) return PAUTAS[modelo] * dim.mm;
  if (modelo === 'quadriculada-5mm' || modelo === 'pontilhada') return 5 * dim.mm;
  if (modelo === 'quadriculada-1cm') return 10 * dim.mm;
  return null;
}
