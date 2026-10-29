// Livros da Biblioteca (PDF e EPUB), sem tela: ajustes de leitura, onde parou, progresso, tempo
// que falta, marcadores e destaques. O livro é um artigo com fonte "livro" e os detalhes em
// artigos.dados ({ formato, capa, posicao, pct, marcadores, ultima_leitura }).

export const MAX_LIVRO = 50 * 1024 * 1024; // limite de arquivo do Supabase no plano gratuito
export const PALAVRAS_POR_MINUTO = 230;
const CARACTERES_POR_PALAVRA = 5.8;

export const FONTES_LEITOR = [
  { id: 'serifa', nome: 'Serifada', css: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { id: 'sem-serifa', nome: 'Sem serifa', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'leitura', nome: 'Para cansaço', css: 'Verdana, "Atkinson Hyperlegible", Tahoma, sans-serif' },
];
export const TEMAS_LEITOR = [
  { id: 'claro', nome: 'Claro' },
  { id: 'sepia', nome: 'Sépia' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'preto', nome: 'Preto' },
];
export const MARGENS_LEITOR = [
  { id: 'estreita', nome: 'Estreita', px: 16 },
  { id: 'media', nome: 'Média', px: 36 },
  { id: 'larga', nome: 'Larga', px: 64 },
];
export const PREFS_LEITOR_PADRAO = {
  fonte: 'serifa', tamanho: 19, linhas: 1.6, margens: 'media', justificado: true, tema: 'auto', brilho: 1, modo: 'paginas', pdfNoite: false,
};

const entre = (v, min, max, padrao) => (Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : padrao);

export function prefsLeitor(v = {}) {
  const p = PREFS_LEITOR_PADRAO;
  return {
    fonte: FONTES_LEITOR.some((f) => f.id === v.fonte) ? v.fonte : p.fonte,
    tamanho: Math.round(entre(v.tamanho, 13, 34, p.tamanho)),
    linhas: Math.round(entre(v.linhas, 1.2, 2.2, p.linhas) * 10) / 10,
    margens: MARGENS_LEITOR.some((m) => m.id === v.margens) ? v.margens : p.margens,
    justificado: v.justificado !== false,
    tema: v.tema === 'auto' || TEMAS_LEITOR.some((t) => t.id === v.tema) ? v.tema : p.tema,
    brilho: Math.round(entre(v.brilho, 0.4, 1, p.brilho) * 100) / 100,
    modo: v.modo === 'rolagem' ? 'rolagem' : 'paginas',
    pdfNoite: v.pdfNoite === true,
  };
}

export function formatoDoArquivo(arquivo) {
  const nome = String(arquivo?.name || '').toLowerCase();
  const tipo = String(arquivo?.type || '').toLowerCase();
  if (tipo === 'application/epub+zip' || nome.endsWith('.epub')) return 'epub';
  if (tipo === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  return null;
}

// Título a partir do nome do arquivo ("o_nome-do-livro.epub" → "o nome do livro").
export const tituloDoArquivo = (nome) => String(nome || '').replace(/\.(epub|pdf)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const ehLivro = (a) => a?.fonte === 'livro' || Boolean(a?.dados?.formato);
export const formatoDoLivro = (a) => a?.dados?.formato || (a?.pdf_path ? 'pdf' : null);

// ---------------------------------------------------------------------------
// Onde parou e progresso
// ---------------------------------------------------------------------------

// EPUB: { capitulo, fracao } e o peso de cada capítulo (tamanho do arquivo) dá o total.
export function porcentagemEpub(capitulos, posicao) {
  const total = capitulos.reduce((s, c) => s + c.peso, 0) || 1;
  const i = Math.max(0, Math.min(capitulos.length - 1, Number(posicao?.capitulo) || 0));
  const antes = capitulos.slice(0, i).reduce((s, c) => s + c.peso, 0);
  return Math.max(0, Math.min(1, (antes + capitulos[i].peso * entre(posicao?.fracao, 0, 1, 0)) / total));
}

// O contrário: a posição de uma porcentagem (para a barra de progresso).
export function posicaoDaPorcentagem(capitulos, pct) {
  const total = capitulos.reduce((s, c) => s + c.peso, 0) || 1;
  let alvo = entre(pct, 0, 1, 0) * total;
  for (let i = 0; i < capitulos.length; i += 1) {
    if (alvo <= capitulos[i].peso || i === capitulos.length - 1) return { capitulo: i, fracao: Math.min(1, alvo / capitulos[i].peso) };
    alvo -= capitulos[i].peso;
  }
  return { capitulo: 0, fracao: 0 };
}

export const porcentagemPdf = (pagina, total) => (total > 1 ? Math.max(0, Math.min(1, (pagina - 1) / (total - 1))) : 1);

export const textoPct = (pct) => `${Math.round((Number(pct) || 0) * 100)}%`;

// Minutos para ler um tanto de caracteres (texto) ou de bytes de XHTML (os capítulos não abertos).
export const minutosDoTexto = (caracteres) => Math.max(0, Math.round(caracteres / CARACTERES_POR_PALAVRA / PALAVRAS_POR_MINUTO));
export const minutosDoXhtml = (bytes) => minutosDoTexto(bytes * 0.55); // tira as marcações

export function textoTempo(min) {
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// Quanto falta no capítulo e no livro (EPUB), a partir do texto do capítulo aberto.
export function tempoRestanteEpub(capitulos, posicao, caracteresDoCapitulo) {
  const i = Number(posicao?.capitulo) || 0;
  const fracao = entre(posicao?.fracao, 0, 1, 0);
  const capitulo = minutosDoTexto(caracteresDoCapitulo * (1 - fracao));
  const depois = capitulos.slice(i + 1).reduce((s, c) => s + minutosDoXhtml(c.peso), 0);
  return { capitulo, livro: capitulo + depois };
}

// ---------------------------------------------------------------------------
// Marcadores e destaques
// ---------------------------------------------------------------------------

// Marcador: { id, chave, rotulo, criado_em } — chave "p12" (PDF) ou "c3:0.42" (EPUB).
export const chaveDaPosicao = (formato, posicao) => (formato === 'pdf' ? `p${posicao.pagina}` : `c${posicao.capitulo}:${(Math.round((posicao.fracao || 0) * 100) / 100).toFixed(2)}`);

export function posicaoDaChave(chave) {
  const m = String(chave || '').match(/^p(\d+)$/);
  if (m) return { pagina: Number(m[1]) };
  const e = String(chave || '').match(/^c(\d+):([\d.]+)$/);
  return e ? { capitulo: Number(e[1]), fracao: Number(e[2]) } : null;
}

// Marcador perto da posição (mesma página do PDF; no EPUB, mesmo capítulo e até 2% de distância).
export function marcadorAqui(marcadores, formato, posicao, fracaoDaPagina = 0.02) {
  return (marcadores || []).find((m) => {
    const p = posicaoDaChave(m.chave);
    if (!p) return false;
    if (formato === 'pdf') return p.pagina === posicao.pagina;
    return p.capitulo === posicao.capitulo && Math.abs(p.fracao - (posicao.fracao || 0)) <= fracaoDaPagina;
  }) || null;
}

export function alternarMarcador(marcadores, formato, posicao, rotulo, fracaoDaPagina) {
  const atual = marcadorAqui(marcadores, formato, posicao, fracaoDaPagina);
  if (atual) return (marcadores || []).filter((m) => m.id !== atual.id);
  return [...(marcadores || []), { id: crypto.randomUUID().slice(0, 8), chave: chaveDaPosicao(formato, posicao), rotulo: String(rotulo || '').slice(0, 120), criado_em: new Date().toISOString() }]
    .sort((a, b) => ordemDaChave(a.chave) - ordemDaChave(b.chave));
}

const ordemDaChave = (chave) => { const p = posicaoDaChave(chave); return p ? (p.pagina ?? (p.capitulo + p.fracao)) : 0; };

// Destaque de livro EPUB: o mesmo formato dos artigos (aparece na aba Destaques e no fichamento),
// com onde está: { id, texto, cor, nota, criado_em, capitulo, inicio, fim }.
export function novoDestaque({ texto, cor = 'amarelo', capitulo, inicio, fim, rotulo = '' }) {
  return {
    id: crypto.randomUUID().slice(0, 8), texto: String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 2000), cor, nota: '',
    criado_em: new Date().toISOString(), capitulo, inicio, fim, onde: String(rotulo || '').slice(0, 120),
  };
}

export const destaquesDoCapitulo = (destaques, capitulo) => (destaques || []).filter((d) => d.capitulo === capitulo && Number.isFinite(d.inicio) && Number.isFinite(d.fim) && d.fim > d.inicio);

// Busca no texto de um capítulo: trechos com um pouco antes e depois.
export function buscarNoTexto(texto, termo, max = 20) {
  const alvo = semAcento(termo).trim();
  if (alvo.length < 2) return [];
  const base = semAcento(texto);
  const achados = [];
  let i = base.indexOf(alvo);
  while (i >= 0 && achados.length < max) {
    achados.push({ inicio: i, fim: i + alvo.length, trecho: `${i > 40 ? '…' : ''}${texto.slice(Math.max(0, i - 40), i + alvo.length + 60).replace(/\s+/g, ' ').trim()}…` });
    i = base.indexOf(alvo, i + alvo.length);
  }
  return achados;
}
// Mantém o tamanho do texto (cada letra vira uma só), para as posições baterem com o original.
export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\S\n]/g, ' ');

// Cores da caneta no PDF: a página é sempre clara (papel do livro), então as cores não mudam com
// o tema do app. Ficam em temas.css como --tinta-livro-* (o editor de tinta lê "--tinta-<id>").
export const CORES_TINTA_LIVRO = [
  { id: 'livro-preto', nome: 'Preto', variavel: '--tinta-livro-preto' },
  { id: 'livro-azul', nome: 'Azul', variavel: '--tinta-livro-azul' },
  { id: 'livro-vermelho', nome: 'Vermelho', variavel: '--tinta-livro-vermelho' },
  { id: 'livro-verde', nome: 'Verde', variavel: '--tinta-livro-verde' },
];
