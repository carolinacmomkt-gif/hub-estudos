// Modelos de folha e tamanhos de página.
// A página tem sempre 1000 unidades de largura; a altura sai da proporção do papel.
// As linhas usam medidas reais (mm), convertidas pela largura do papel.
// Fundos com imagem (modelo próprio e página de PDF) recebem a imagem pronta em "extras.imagem";
// os planners recebem a data inicial em "extras.data" (AAAA-MM-DD).

export const TAMANHOS_PAPEL = {
  A4: { nome: 'A4', mm: [210, 297] },
  A5: { nome: 'A5', mm: [148, 210] },
  Carta: { nome: 'Carta', mm: [216, 279] },
  Tablet: { nome: 'Tela do tablet', mm: [160, 256] }, // 16:10, como o Tab S10 Lite
};

export const GRUPOS_MODELOS = [
  {
    nome: 'Básicos',
    modelos: [
      { id: 'branco', nome: 'Em branco' },
      { id: 'pautada-estreita', nome: 'Pautada estreita' },
      { id: 'pautada-media', nome: 'Pautada média' },
      { id: 'pautada-larga', nome: 'Pautada larga' },
      { id: 'quadriculada-5mm', nome: 'Quadriculada 5 mm' },
      { id: 'quadriculada-1cm', nome: 'Quadriculada 1 cm' },
      { id: 'pontilhada', nome: 'Pontilhada' },
      { id: 'milimetrada', nome: 'Milimetrada' },
      { id: 'isometrica', nome: 'Isométrica' },
      { id: 'hexagonal', nome: 'Hexagonal' },
    ],
  },
  {
    nome: 'Estudo',
    modelos: [
      { id: 'cornell', nome: 'Cornell' },
      { id: 'mapa-mental', nome: 'Mapa mental' },
      { id: 'fichamento', nome: 'Fichamento de leitura' },
      { id: 'resumo-aula', nome: 'Resumo de aula' },
      { id: 'flashcards', nome: 'Flashcards (frente e verso)' },
      { id: 'perguntas-respostas', nome: 'Perguntas e respostas' },
      { id: 'revisao-prova', nome: 'Revisão para prova' },
      { id: 'linha-tempo', nome: 'Linha do tempo' },
      { id: 'tabela-comparativa', nome: 'Tabela comparativa' },
    ],
  },
  {
    nome: 'Organização',
    modelos: [
      { id: 'checklist', nome: 'Checklist' },
      { id: 'todo-diario', nome: 'To-do diário' },
      { id: 'planner-semanal', nome: 'Planner semanal', data: 'semana' },
      { id: 'planner-mensal', nome: 'Planner mensal', data: 'mes' },
      { id: 'estudos-semana', nome: 'Estudos da semana', data: 'semana' },
      { id: 'controle-leitura', nome: 'Controle de leitura' },
      { id: 'entrega-trabalhos', nome: 'Entrega de trabalhos' },
    ],
  },
  {
    nome: 'Escrita',
    modelos: [
      { id: 'substack-rascunho', nome: 'Rascunho do Substack' },
      { id: 'storyboard', nome: 'Storyboard' },
    ],
  },
  { nome: 'Música', modelos: [{ id: 'pentagrama', nome: 'Pentagrama' }] },
];

export const MODELOS = GRUPOS_MODELOS.flatMap((g) => g.modelos);
export const MODELOS_BASICOS = GRUPOS_MODELOS[0].modelos;
export const nomeDoModelo = (id) => MODELOS.find((m) => m.id === id)?.nome || (String(id).startsWith('proprio:') ? 'Modelo próprio' : id === 'pdf' ? 'Página do PDF' : 'Em branco');
export const modeloComData = (id) => MODELOS.find((m) => m.id === id)?.data || null;

// { largura: 1000, altura, mm: unidades por milímetro }
export function dimensoes(tamanho = 'A4', orientacao = 'retrato') {
  const [l, a] = (TAMANHOS_PAPEL[tamanho] || TAMANHOS_PAPEL.A4).mm;
  const [largMm, altMm] = orientacao === 'paisagem' ? [a, l] : [l, a];
  return { largura: 1000, altura: Math.round((1000 * altMm) / largMm), mm: 1000 / largMm };
}

const PAUTAS = { 'pautada-estreita': 6, 'pautada-media': 7, 'pautada-larga': 8.7 };
const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

// ---------------------------------------------------------------------------
// Peças de desenho (tudo em unidades da página)
// ---------------------------------------------------------------------------

function linhasHorizontais(x, dim, passo, inicio, { x0 = 0, x1 = dim.largura, y1 = dim.altura - passo * 0.5 } = {}) {
  x.beginPath();
  for (let y = inicio; y < y1; y += passo) {
    x.moveTo(x0, y);
    x.lineTo(x1, y);
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

function linha(x, x0, y0, x1, y1) {
  x.beginPath();
  x.moveTo(x0, y0);
  x.lineTo(x1, y1);
  x.stroke();
}

function caixa(x, x0, y0, w, h, raio = 0) {
  x.beginPath();
  if (raio && x.roundRect) x.roundRect(x0, y0, w, h, raio);
  else x.rect(x0, y0, w, h);
  x.stroke();
}

function rotulo(x, cores, texto, px, py, tam, { negrito = false, alinhar = 'left' } = {}) {
  x.save();
  x.fillStyle = cores.texto || cores.margem;
  x.font = `${negrito ? '600 ' : ''}${tam}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  x.textAlign = alinhar;
  x.textBaseline = 'alphabetic';
  x.fillText(texto, px, py);
  x.restore();
}

function quadradinho(x, px, py, lado) {
  x.strokeRect(px, py - lado, lado, lado);
}

// Tabela com cabeçalho: colunas em frações da largura útil.
function tabela(x, dim, cores, { y0, colunas, linhaAlt, margem }) {
  const mm = dim.mm;
  const x0 = margem;
  const x1 = dim.largura - margem;
  const larg = x1 - x0;
  const y1 = dim.altura - 12 * mm;
  const fim = y0 + Math.floor((y1 - y0) / linhaAlt) * linhaAlt;
  caixa(x, x0, y0, larg, fim - y0);
  linhasHorizontais(x, dim, linhaAlt, y0 + linhaAlt, { x0, x1, y1: fim - linhaAlt * 0.5 });
  let cx = x0;
  colunas.forEach((c, i) => {
    rotulo(x, cores, c.nome, cx + 2 * mm, y0 + linhaAlt * 0.68, 3.2 * mm, { negrito: true });
    cx += larg * c.fracao;
    if (i < colunas.length - 1) linha(x, cx, y0, cx, fim);
  });
}

function cabecalho(x, dim, cores, titulo, campos = []) {
  const mm = dim.mm;
  rotulo(x, cores, titulo, 15 * mm, 16 * mm, 5.5 * mm, { negrito: true });
  let px = 15 * mm;
  for (const campo of campos) {
    rotulo(x, cores, `${campo}:`, px, 26 * mm, 3.4 * mm);
    linha(x, px + campo.length * 2.2 * mm + 4 * mm, 26.5 * mm, px + 60 * mm, 26.5 * mm);
    px += 65 * mm;
  }
  return 32 * mm;
}

function dataDe(chave) {
  const [a, m, d] = String(chave || '').split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d, 12) : null;
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

const DESENHOS = {
  'quadriculada-5mm': (x, dim) => grade(x, dim, 5 * dim.mm),
  'quadriculada-1cm': (x, dim) => grade(x, dim, 10 * dim.mm),
  pontilhada(x, dim) {
    const passo = 5 * dim.mm;
    for (let y = passo; y < dim.altura; y += passo) {
      for (let xx = passo; xx < dim.largura; xx += passo) x.fillRect(xx - 1.3, y - 1.3, 2.6, 2.6);
    }
  },
  milimetrada(x, dim) {
    x.lineWidth = 0.5;
    grade(x, dim, dim.mm);
    x.lineWidth = 1.4;
    grade(x, dim, 10 * dim.mm);
  },
  isometrica(x, dim) {
    const passo = 6 * dim.mm;
    const t = Math.tan(Math.PI / 6);
    x.beginPath();
    for (let xx = 0; xx < dim.largura; xx += passo * Math.cos(Math.PI / 6) * 2) {
      x.moveTo(xx, 0);
      x.lineTo(xx, dim.altura);
    }
    const alcance = dim.altura + dim.largura * t;
    for (let c = -dim.largura * t; c < alcance; c += passo * 1.15) {
      x.moveTo(0, c);
      x.lineTo(dim.largura, c + dim.largura * t);
      x.moveTo(0, c + dim.largura * t);
      x.lineTo(dim.largura, c);
    }
    x.stroke();
  },
  hexagonal(x, dim) {
    const r = 5 * dim.mm;
    const w = Math.sqrt(3) * r;
    x.beginPath();
    for (let lin = 0, y = r; y < dim.altura + r; lin += 1, y += 1.5 * r) {
      for (let cx = (lin % 2 ? w / 2 : 0); cx < dim.largura + w; cx += w) {
        for (let k = 0; k < 6; k += 1) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = cx + r * Math.cos(a);
          const py = y + r * Math.sin(a);
          if (k === 0) x.moveTo(px, py);
          else x.lineTo(px, py);
        }
        x.closePath();
      }
    }
    x.stroke();
  },
  cornell(x, dim, cores) {
    const mm = dim.mm;
    const topo = 20 * mm;
    const coluna = 62 * mm;
    const resumo = dim.altura - 55 * mm;
    rotulo(x, cores, 'Tópicos', 6 * mm, topo - 5 * mm, 3.6 * mm, { negrito: true });
    rotulo(x, cores, 'Anotações', coluna + 5 * mm, topo - 5 * mm, 3.6 * mm, { negrito: true });
    linhasHorizontais(x, dim, 7 * mm, topo + 7 * mm, { y1: resumo - 2 * mm });
    x.strokeStyle = cores.margem;
    linha(x, coluna, topo - 12 * mm, coluna, resumo);
    linha(x, 0, topo, dim.largura, topo);
    linha(x, 0, resumo, dim.largura, resumo);
    rotulo(x, cores, 'Resumo', 6 * mm, resumo + 7 * mm, 3.6 * mm, { negrito: true });
    x.strokeStyle = cores.linha;
    linhasHorizontais(x, dim, 7 * mm, resumo + 15 * mm);
  },
  'mapa-mental'(x, dim, cores) {
    const passo = 8 * dim.mm;
    for (let y = passo; y < dim.altura; y += passo) {
      for (let xx = passo; xx < dim.largura; xx += passo) x.fillRect(xx - 1, y - 1, 2, 2);
    }
    x.save();
    x.lineWidth = 2;
    x.strokeStyle = cores.margem;
    x.beginPath();
    x.ellipse(dim.largura / 2, dim.altura / 2, 45 * dim.mm, 25 * dim.mm, 0, 0, Math.PI * 2);
    x.stroke();
    x.restore();
    rotulo(x, cores, 'Tema central', dim.largura / 2, dim.altura / 2 + 1.5 * dim.mm, 3.4 * dim.mm, { alinhar: 'center' });
  },
  fichamento(x, dim, cores) {
    const mm = dim.mm;
    let y = cabecalho(x, dim, cores, 'Fichamento', ['Data', 'Páginas']);
    const partes = [['Referência', 2], ['Tema e objetivo', 3], ['Ideias principais', 8], ['Citações', 6], ['Minha análise', 5]];
    const total = partes.reduce((s, [, n]) => s + n + 1.6, 0);
    const passo = Math.min(7 * mm, (dim.altura - y - 10 * mm) / total);
    for (const [nome, n] of partes) {
      y += passo;
      rotulo(x, cores, nome, 15 * mm, y, 3.6 * mm, { negrito: true });
      y += passo * 0.6;
      linhasHorizontais(x, dim, passo, y + passo, { x0: 15 * mm, x1: dim.largura - 15 * mm, y1: y + passo * n + 1 });
      y += passo * n;
    }
  },
  'resumo-aula'(x, dim, cores) {
    const mm = dim.mm;
    const y = cabecalho(x, dim, cores, 'Resumo de aula', ['Disciplina', 'Data']);
    rotulo(x, cores, 'Tema da aula:', 15 * mm, y + 6 * mm, 3.4 * mm);
    linha(x, 42 * mm, y + 6.5 * mm, dim.largura - 15 * mm, y + 6.5 * mm);
    const duvidas = dim.altura - 50 * mm;
    linhasHorizontais(x, dim, 7 * mm, y + 16 * mm, { x0: 15 * mm, x1: dim.largura - 15 * mm, y1: duvidas - 4 * mm });
    caixa(x, 15 * mm, duvidas, dim.largura - 30 * mm, 38 * mm, 3 * mm);
    rotulo(x, cores, 'Dúvidas para tirar · o que revisar', 19 * mm, duvidas + 7 * mm, 3.4 * mm, { negrito: true });
  },
  flashcards(x, dim, cores) {
    const mm = dim.mm;
    const m = 12 * mm;
    const linhas = 4;
    const h = (dim.altura - 2 * m - (linhas - 1) * 6 * mm) / linhas;
    const w = (dim.largura - 2 * m - 6 * mm) / 2;
    for (let i = 0; i < linhas; i += 1) {
      const y = m + i * (h + 6 * mm);
      caixa(x, m, y, w, h, 3 * mm);
      caixa(x, m + w + 6 * mm, y, w, h, 3 * mm);
      rotulo(x, cores, `Frente ${i + 1}`, m + 3 * mm, y + 6 * mm, 3 * mm);
      rotulo(x, cores, `Verso ${i + 1}`, m + w + 9 * mm, y + 6 * mm, 3 * mm);
    }
  },
  'perguntas-respostas'(x, dim, cores) {
    const mm = dim.mm;
    const bloco = 42 * mm;
    for (let y = 14 * mm; y + bloco < dim.altura - 5 * mm; y += bloco) {
      rotulo(x, cores, 'P:', 15 * mm, y + 6 * mm, 4 * mm, { negrito: true });
      linha(x, 24 * mm, y + 6.5 * mm, dim.largura - 15 * mm, y + 6.5 * mm);
      linha(x, 24 * mm, y + 13.5 * mm, dim.largura - 15 * mm, y + 13.5 * mm);
      rotulo(x, cores, 'R:', 15 * mm, y + 22 * mm, 4 * mm, { negrito: true });
      linhasHorizontais(x, dim, 7 * mm, y + 22.5 * mm, { x0: 24 * mm, x1: dim.largura - 15 * mm, y1: y + bloco - 4 * mm });
    }
  },
  'revisao-prova'(x, dim, cores) {
    const mm = dim.mm;
    let y = cabecalho(x, dim, cores, 'Revisão para a prova', ['Disciplina', 'Data']);
    const partes = [['O que cai', 6], ['Conceitos e fórmulas', 8], ['Onde eu erro', 5]];
    for (const [nome, n] of partes) {
      y += 8 * mm;
      rotulo(x, cores, nome, 15 * mm, y, 3.6 * mm, { negrito: true });
      linhasHorizontais(x, dim, 7 * mm, y + 7 * mm, { x0: 15 * mm, x1: dim.largura - 15 * mm, y1: y + 7 * mm * n });
      y += 7 * mm * n;
    }
    y += 8 * mm;
    rotulo(x, cores, 'Checklist da véspera', 15 * mm, y, 3.6 * mm, { negrito: true });
    for (let k = 1; y + k * 8 * mm < dim.altura - 8 * mm; k += 1) {
      quadradinho(x, 15 * mm, y + k * 8 * mm, 4 * mm);
      linha(x, 22 * mm, y + k * 8 * mm, dim.largura - 15 * mm, y + k * 8 * mm);
    }
  },
  'linha-tempo'(x, dim, cores) {
    const mm = dim.mm;
    const cx = dim.largura / 2;
    x.save();
    x.lineWidth = 2.5;
    x.strokeStyle = cores.margem;
    linha(x, cx, 18 * mm, cx, dim.altura - 12 * mm);
    x.restore();
    rotulo(x, cores, 'Linha do tempo', 15 * mm, 12 * mm, 4.5 * mm, { negrito: true });
    const n = 8;
    const passo = (dim.altura - 40 * mm) / n;
    for (let i = 0; i < n; i += 1) {
      const y = 26 * mm + i * passo;
      x.beginPath();
      x.arc(cx, y, 2 * mm, 0, Math.PI * 2);
      x.fill();
      const esquerda = i % 2 === 0;
      const bx = esquerda ? 15 * mm : cx + 8 * mm;
      const bw = cx - 23 * mm;
      linha(x, esquerda ? bx + bw : cx, y, esquerda ? cx : bx, y);
      caixa(x, bx, y - 4 * mm, bw, passo - 6 * mm, 2 * mm);
      rotulo(x, cores, 'Data:', bx + 2 * mm, y + 1 * mm, 3 * mm);
    }
  },
  'tabela-comparativa'(x, dim, cores) {
    const y0 = cabecalho(x, dim, cores, 'Tabela comparativa', ['Tema']);
    tabela(x, dim, cores, { y0, margem: 12 * dim.mm, linhaAlt: 14 * dim.mm, colunas: [{ nome: 'Critério', fracao: 0.28 }, { nome: 'A', fracao: 0.24 }, { nome: 'B', fracao: 0.24 }, { nome: 'C', fracao: 0.24 }] });
  },
  checklist(x, dim, cores) {
    const mm = dim.mm;
    rotulo(x, cores, 'Checklist', 15 * mm, 16 * mm, 5.5 * mm, { negrito: true });
    for (let y = 30 * mm; y < dim.altura - 10 * mm; y += 9 * mm) {
      quadradinho(x, 15 * mm, y, 4.5 * mm);
      linha(x, 23 * mm, y, dim.largura - 15 * mm, y);
    }
  },
  'todo-diario'(x, dim, cores) {
    const mm = dim.mm;
    let y = cabecalho(x, dim, cores, 'Hoje', ['Data']);
    y += 8 * mm;
    rotulo(x, cores, '3 prioridades', 15 * mm, y, 3.6 * mm, { negrito: true });
    for (let k = 1; k <= 3; k += 1) {
      rotulo(x, cores, `${k}.`, 15 * mm, y + k * 9 * mm, 3.6 * mm);
      linha(x, 22 * mm, y + k * 9 * mm, dim.largura - 15 * mm, y + k * 9 * mm);
    }
    y += 40 * mm;
    rotulo(x, cores, 'Tarefas', 15 * mm, y, 3.6 * mm, { negrito: true });
    const notas = dim.altura - 45 * mm;
    for (let yy = y + 9 * mm; yy < notas - 6 * mm; yy += 9 * mm) {
      quadradinho(x, 15 * mm, yy, 4.5 * mm);
      linha(x, 23 * mm, yy, dim.largura - 15 * mm, yy);
    }
    caixa(x, 15 * mm, notas, dim.largura - 30 * mm, 35 * mm, 3 * mm);
    rotulo(x, cores, 'Notas', 19 * mm, notas + 7 * mm, 3.4 * mm, { negrito: true });
  },
  'planner-semanal'(x, dim, cores, extras) {
    const mm = dim.mm;
    const inicio = dataDe(extras.data);
    const titulo = inicio ? `Semana de ${fmtDia.format(inicio).replace('.', '')}` : 'Semana';
    rotulo(x, cores, titulo, 15 * mm, 16 * mm, 5.5 * mm, { negrito: true });
    const y0 = 24 * mm;
    const notas = 34 * mm;
    const h = (dim.altura - y0 - notas - 10 * mm) / 7;
    for (let i = 0; i < 7; i += 1) {
      const y = y0 + i * h;
      caixa(x, 15 * mm, y, dim.largura - 30 * mm, h - 2 * mm, 2.5 * mm);
      const dia = inicio ? new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i, 12) : null;
      rotulo(x, cores, `${DIAS[i]}${dia ? ` · ${dia.getDate()}` : ''}`, 18 * mm, y + 6 * mm, 3.4 * mm, { negrito: true });
    }
    const yn = dim.altura - notas - 6 * mm;
    caixa(x, 15 * mm, yn, dim.largura - 30 * mm, notas, 2.5 * mm);
    rotulo(x, cores, 'Notas da semana', 18 * mm, yn + 6 * mm, 3.4 * mm, { negrito: true });
  },
  'planner-mensal'(x, dim, cores, extras) {
    const mm = dim.mm;
    const inicio = dataDe(extras.data);
    const titulo = inicio ? fmtMes.format(inicio) : 'Mês';
    rotulo(x, cores, titulo.charAt(0).toUpperCase() + titulo.slice(1), 15 * mm, 16 * mm, 5.5 * mm, { negrito: true });
    const x0 = 12 * mm;
    const y0 = 30 * mm;
    const w = (dim.largura - 2 * x0) / 7;
    const h = (dim.altura - y0 - 40 * mm) / 6;
    DIAS_CURTOS.forEach((d, i) => rotulo(x, cores, d, x0 + i * w + w / 2, y0 - 3 * mm, 3.2 * mm, { negrito: true, alinhar: 'center' }));
    const desloc = inicio ? (inicio.getDay() + 6) % 7 : 0;
    const diasNoMes = inicio ? new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate() : 0;
    for (let c = 0; c < 42; c += 1) {
      const px = x0 + (c % 7) * w;
      const py = y0 + Math.floor(c / 7) * h;
      x.strokeRect(px, py, w, h);
      const n = c - desloc + 1;
      if (inicio && n >= 1 && n <= diasNoMes) rotulo(x, cores, String(n), px + 1.8 * mm, py + 5 * mm, 3.2 * mm);
    }
    const yn = y0 + 6 * h + 5 * mm;
    rotulo(x, cores, 'Metas do mês', 15 * mm, yn + 4 * mm, 3.4 * mm, { negrito: true });
    linhasHorizontais(x, dim, 7 * mm, yn + 11 * mm, { x0: 15 * mm, x1: dim.largura - 15 * mm, y1: dim.altura - 6 * mm });
  },
  'estudos-semana'(x, dim, cores, extras) {
    const mm = dim.mm;
    const inicio = dataDe(extras.data);
    rotulo(x, cores, inicio ? `Estudos da semana de ${fmtDia.format(inicio).replace('.', '')}` : 'Estudos da semana', 15 * mm, 16 * mm, 5.5 * mm, { negrito: true });
    tabela(x, dim, cores, { y0: 24 * mm, margem: 12 * mm, linhaAlt: 12 * mm, colunas: [{ nome: 'Dia', fracao: 0.16 }, { nome: 'Disciplina', fracao: 0.26 }, { nome: 'Tema', fracao: 0.34 }, { nome: 'Tempo', fracao: 0.12 }, { nome: 'Feito', fracao: 0.12 }] });
    const linhaAlt = 12 * mm;
    for (let i = 0; i < 7; i += 1) {
      const y = 24 * mm + linhaAlt * (i * 2 + 1);
      if (y + linhaAlt > dim.altura - 12 * mm) break;
      const dia = inicio ? new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i, 12) : null;
      rotulo(x, cores, `${DIAS_CURTOS[i]}${dia ? ` ${dia.getDate()}` : ''}`, 14 * mm, y + linhaAlt * 0.65, 3.2 * mm);
    }
  },
  'controle-leitura'(x, dim, cores) {
    const y0 = cabecalho(x, dim, cores, 'Controle de leitura');
    tabela(x, dim, cores, { y0, margem: 12 * dim.mm, linhaAlt: 11 * dim.mm, colunas: [{ nome: 'Título', fracao: 0.34 }, { nome: 'Autor', fracao: 0.22 }, { nome: 'Início', fracao: 0.13 }, { nome: 'Fim', fracao: 0.13 }, { nome: 'Nota', fracao: 0.18 }] });
  },
  'entrega-trabalhos'(x, dim, cores) {
    const y0 = cabecalho(x, dim, cores, 'Entrega de trabalhos');
    tabela(x, dim, cores, { y0, margem: 12 * dim.mm, linhaAlt: 11 * dim.mm, colunas: [{ nome: 'Trabalho', fracao: 0.34 }, { nome: 'Disciplina', fracao: 0.24 }, { nome: 'Prazo', fracao: 0.14 }, { nome: 'Status', fracao: 0.14 }, { nome: '✓', fracao: 0.14 }] });
  },
  'substack-rascunho'(x, dim, cores) {
    const mm = dim.mm;
    const margem = dim.largura - 60 * mm;
    rotulo(x, cores, 'Rascunho', 15 * mm, 15 * mm, 4 * mm, { negrito: true });
    rotulo(x, cores, 'Notas', margem + 5 * mm, 15 * mm, 3.6 * mm, { negrito: true });
    linhasHorizontais(x, dim, 8 * mm, 25 * mm, { x0: 0, x1: margem - 3 * mm });
    x.strokeStyle = cores.margem;
    linha(x, margem, 0, margem, dim.altura);
  },
  storyboard(x, dim, cores) {
    const mm = dim.mm;
    const m = 12 * mm;
    const cols = dim.largura > dim.altura ? 3 : 2;
    const lins = 3;
    const w = (dim.largura - 2 * m - (cols - 1) * 6 * mm) / cols;
    const h = (dim.altura - 2 * m - (lins - 1) * 6 * mm) / lins;
    let n = 1;
    for (let r = 0; r < lins; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const px = m + c * (w + 6 * mm);
        const py = m + r * (h + 6 * mm);
        const quadro = h - 18 * mm;
        caixa(x, px, py, w, quadro, 2 * mm);
        rotulo(x, cores, `Cena ${n}`, px, py + quadro + 6 * mm, 3 * mm, { negrito: true });
        linha(x, px, py + quadro + 11 * mm, px + w, py + quadro + 11 * mm);
        linha(x, px, py + quadro + 17 * mm, px + w, py + quadro + 17 * mm);
        n += 1;
      }
    }
  },
  pentagrama(x, dim) {
    const mm = dim.mm;
    const esp = 2 * mm;
    for (let y = 20 * mm; y + esp * 4 < dim.altura - 10 * mm; y += 18 * mm) {
      linhasHorizontais(x, dim, esp, y, { x0: 15 * mm, x1: dim.largura - 15 * mm, y1: y + esp * 4.5 });
    }
  },
};

// Imagem de fundo (modelo próprio ou página de PDF) cobrindo a página, sem distorcer.
function desenharImagem(x, dim, imagem) {
  const iw = imagem.width || imagem.naturalWidth;
  const ih = imagem.height || imagem.naturalHeight;
  if (!iw || !ih) return;
  const escala = Math.min(dim.largura / iw, dim.altura / ih);
  const w = iw * escala;
  const h = ih * escala;
  x.drawImage(imagem, (dim.largura - w) / 2, (dim.altura - h) / 2, w, h);
}

// Desenha o fundo no contexto (já em unidades da página).
// Folha do modelo e, por cima, o texto digitado da página (quando tem), já como imagem.
export function desenharFolha(x, modelo, dim, cores, extras = {}) {
  desenharModelo(x, modelo, dim, cores, extras);
  if (extras.texto) x.drawImage(extras.texto, 0, 0, dim.largura, extras.texto.naturalHeight || extras.texto.height || dim.altura);
}

function desenharModelo(x, modelo, dim, cores, extras) {
  x.clearRect(0, 0, dim.largura, dim.altura);
  x.fillStyle = cores.papel;
  x.fillRect(0, 0, dim.largura, dim.altura);
  x.strokeStyle = cores.linha;
  x.fillStyle = cores.linha;
  x.lineWidth = 1.2;

  if (extras.imagem && (modelo === 'pdf' || String(modelo).startsWith('proprio:'))) {
    desenharImagem(x, dim, extras.imagem);
    return;
  }
  if (PAUTAS[modelo]) {
    linhasHorizontais(x, dim, PAUTAS[modelo] * dim.mm, 25 * dim.mm);
    x.strokeStyle = cores.margem;
    linha(x, 20 * dim.mm, 0, 20 * dim.mm, dim.altura);
    return;
  }
  DESENHOS[modelo]?.(x, dim, cores, extras);
}

// Espaço entre linhas do modelo (para alinhar à pauta depois); null se não tem linhas.
export function passoDaPauta(modelo, dim) {
  if (PAUTAS[modelo]) return PAUTAS[modelo] * dim.mm;
  if (modelo === 'quadriculada-5mm' || modelo === 'pontilhada') return 5 * dim.mm;
  if (modelo === 'quadriculada-1cm') return 10 * dim.mm;
  if (modelo === 'cornell' || modelo === 'resumo-aula' || modelo === 'revisao-prova') return 7 * dim.mm;
  if (modelo === 'substack-rascunho') return 8 * dim.mm;
  return null;
}

// <option>s agrupados por tipo de modelo (mais os modelos próprios da Carol).
export function opcoesDeModelo(atual, proprios = []) {
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const grupos = GRUPOS_MODELOS.map((g) => `<optgroup label="${esc(g.nome)}">${g.modelos.map((m) => `<option value="${m.id}"${m.id === atual ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</optgroup>`);
  if (proprios.length) grupos.push(`<optgroup label="Meus modelos">${proprios.map((m) => `<option value="proprio:${esc(m.id)}"${`proprio:${m.id}` === atual ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</optgroup>`);
  if (atual === 'pdf') grupos.unshift('<option value="pdf" selected>Página do PDF</option>');
  return grupos.join('');
}
