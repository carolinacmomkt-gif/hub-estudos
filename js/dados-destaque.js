// Cor de destaque escolhida pela Carol (17/11/2026), sem DOM: a partir de uma cor base, monta os
// tokens de destaque do tema escuro e do claro, sempre com contraste mínimo (AA para texto, 3:1
// para detalhes). O padrão (Areia) não gera nada: fica a cor original de temas.css.

export const TONS_DESTAQUE = [
  { id: 'areia', nome: 'Areia', cor: '#D9C6B3' },
  { id: 'salvia', nome: 'Sálvia', cor: '#9DB8A2' },
  { id: 'oliva', nome: 'Oliva', cor: '#ADB27C' },
  { id: 'azul', nome: 'Azul-noite', cor: '#93ABCB' },
  { id: 'lavanda', nome: 'Lavanda', cor: '#AFA2CF' },
  { id: 'rosa', nome: 'Rosa queimado', cor: '#CFA3AC' },
  { id: 'terracota', nome: 'Terracota', cor: '#CF977A' },
  { id: 'mostarda', nome: 'Mostarda', cor: '#D6B86E' },
];

const FUNDO_ESCURO = '#191919';
const CARD_ESCURO = '#242424';
const FUNDO_CLARO = '#F1F1F1';
const CARD_CLARO = '#FFFFFF';

export function corValida(hex) {
  return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex.trim());
}

function paraRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function paraHsl(hex) {
  const [r, g, b] = paraRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function deHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return paraHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

function luminancia(hex) {
  const [r, g, b] = paraRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Anda a luminosidade (para cima ou para baixo) até bater o contraste com todos os fundos.
function ajustar(h, s, l, fundos, alvo, passo) {
  let cor = deHsl(h, s, l);
  for (let i = 0; i < 100 && fundos.some((f) => contraste(cor, f) < alvo); i++) {
    l = Math.max(0, Math.min(1, l + passo));
    cor = deHsl(h, s, l);
  }
  return cor;
}

const rgba = (hex, a) => `rgba(${paraRgb(hex).join(', ')}, ${a})`;

export function tokensDoDestaque(base) {
  if (!corValida(base)) return null;
  const [h, s0] = paraHsl(base);
  const s = Math.min(s0, 0.5);

  const destaqueEscuro = ajustar(h, s, 0.72, [CARD_ESCURO, FUNDO_ESCURO], 3, 0.01);
  const textoEscuro = ajustar(h, s, 0.8, [CARD_ESCURO, FUNDO_ESCURO], 4.5, 0.01);
  const sobrePreenchidoEscuro = deHsl(h, Math.min(s, 0.35), 0.88);
  const preenchidoEscuro = ajustar(h, Math.min(s, 0.3), 0.28, [sobrePreenchidoEscuro], 4.5, -0.01);

  const destaqueClaro = deHsl(h, Math.min(s0, 0.55), 0.85);
  const textoClaro = ajustar(h, Math.min(s0, 0.45), 0.34, [FUNDO_CLARO, CARD_CLARO, destaqueClaro], 4.5, -0.01);
  const sobreClaro = ajustar(h, Math.min(s0, 0.3), 0.16, [destaqueClaro], 4.5, -0.01);
  const focoClaro = ajustar(h, Math.min(s0, 0.5), 0.42, [FUNDO_CLARO, CARD_CLARO], 3, -0.01);

  return {
    escuro: {
      '--cor-destaque': destaqueEscuro,
      '--cor-destaque-suave': rgba(destaqueEscuro, 0.13),
      '--cor-texto-destaque': textoEscuro,
      '--cor-sobre-destaque': contraste(destaqueEscuro, FUNDO_ESCURO) >= 4.5 ? FUNDO_ESCURO : '#000000',
      '--cor-foco': textoEscuro,
      '--cor-preenchido': preenchidoEscuro,
      '--cor-sobre-preenchido': sobrePreenchidoEscuro,
    },
    claro: {
      '--cor-destaque': destaqueClaro,
      '--cor-destaque-suave': rgba(destaqueClaro, 0.5),
      '--cor-texto-destaque': textoClaro,
      '--cor-sobre-destaque': sobreClaro,
      '--cor-foco': focoClaro,
      '--cor-preenchido': destaqueClaro,
      '--cor-sobre-preenchido': sobreClaro,
    },
  };
}

// CSS que vence o temas.css pela especificidade (html:root[...]), mesmo carregado antes dele.
export function cssDoDestaque(base) {
  const t = tokensDoDestaque(base);
  if (!t) return '';
  const bloco = (sel, obj) => `${sel}{${Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  return bloco('html:root,html:root[data-tema="escuro"]', t.escuro) + bloco('html:root[data-tema="claro"]', t.claro);
}

// O padrão (Areia ou nada escolhido) não muda nada.
export function destaqueEscolhido(valor) {
  const cor = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!corValida(cor) || cor === TONS_DESTAQUE[0].cor) return null;
  return cor;
}
