// Páginas digitadas dos cadernos (documento no computador, notas no celular) e o jeito de abrir
// cada caderno em cada aparelho. O texto fica em tracos_json.texto ({ html, plano, atualizado_em }),
// ao lado das camadas de tinta: a mesma página pode ter texto e escrita à mão por cima.

export const FORMATOS = [
  { id: 'tinta', nome: 'À mão', descricao: 'Escrita com a S Pen' },
  { id: 'documento', nome: 'Documento', descricao: 'Texto digitado, como um documento' },
  { id: 'notas', nome: 'Notas', descricao: 'Notas rápidas, uma por página' },
];

// Tipos que só fazem sentido à mão (por cima do PDF, quadro sem fim e planner com datas).
const SO_TINTA = ['pdf', 'infinito', 'planner'];
const CHAVE = 'bussola.cadernos.formato';

export const soTinta = (caderno) => SO_TINTA.includes(caderno?.tipo);

// Celular: notas. Tablet (toque e tela grande): à mão. Computador: documento.
export function formatoDoAparelho() {
  if (typeof matchMedia !== 'function') return 'documento';
  // Pelo tamanho da tela do aparelho (o tablet em tela dividida continua abrindo à mão).
  if (Math.min(screen?.width || innerWidth, screen?.height || innerHeight) < 600) return 'notas';
  if (matchMedia('(any-pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0) return 'tinta';
  return 'documento';
}

function lerEscolhas() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {};
  } catch {
    return {};
  }
}

// A escolha vale para este aparelho e este caderno (no tablet pode ser à mão; no computador, documento).
export function formatoDoCaderno(caderno) {
  if (!caderno || soTinta(caderno)) return 'tinta';
  const escolhido = lerEscolhas()[caderno.id];
  return FORMATOS.some((f) => f.id === escolhido) ? escolhido : formatoDoAparelho();
}

export function escolherFormato(cadernoId, formato) {
  const escolhas = lerEscolhas();
  escolhas[cadernoId] = formato;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(escolhas));
  } catch {
    // sem armazenamento: vale só até fechar
  }
}

// ---------------------------------------------------------------------------
// Conteúdo das páginas
// ---------------------------------------------------------------------------

export const temTexto = (p) => Boolean(p?.tracos_json?.texto?.html);
export const temTinta = (p) => (p?.tracos_json?.camadas || []).some((c) => c.tipo === 'desenho' && (c.itens || []).length);
// Página nova e vazia (sem texto e sem tinta) pode virar página digitada sem perder nada.
export const paginaVazia = (p) => !temTexto(p) && !temTinta(p) && !p?.pdf_path && p?.modelo_folha !== 'pdf';
export const editavelComoTexto = (p) => temTexto(p) || paginaVazia(p);

export function htmlDaPagina(p) {
  return p?.tracos_json?.texto?.html || '';
}

// Título de uma nota: o primeiro título ou a primeira linha.
export function tituloDaPagina(p) {
  const plano = String(p?.tracos_json?.texto?.plano || '').trim();
  const primeira = plano.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return primeira.slice(0, 80);
}

export function resumoDaPagina(p) {
  const linhas = String(p?.tracos_json?.texto?.plano || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return linhas.slice(1).join(' · ').slice(0, 140);
}

export function contarPalavras(texto) {
  return (String(texto || '').match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || []).length;
}

// ---------------------------------------------------------------------------
// Limpeza do HTML (o que vem de colar da internet e o que abre do banco)
// ---------------------------------------------------------------------------

const PERMITIDAS = new Set(['P', 'H1', 'H2', 'H3', 'STRONG', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'MARK']);
const TROCAS = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', DIV: 'P', H4: 'H3', H5: 'H3', H6: 'H3', SECTION: 'P', ARTICLE: 'P' };
const BLOCOS = new Set(['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR']);

function limparNo(no, doc) {
  if (no.nodeType === 3) return doc.createTextNode(no.textContent);
  if (no.nodeType !== 1) return null;
  let nome = no.tagName.toUpperCase();
  nome = TROCAS[nome] || nome;
  // Negrito/itálico do Google Docs e do Word vêm como <span style>.
  if (nome === 'SPAN') {
    const estilo = no.getAttribute('style') || '';
    if (/font-weight:\s*(bold|[6-9]00)/.test(estilo)) nome = 'STRONG';
    else if (/font-style:\s*italic/.test(estilo)) nome = 'EM';
  }
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'META', 'LINK', 'TITLE', 'HEAD'].includes(nome)) return null;
  const filhos = [...no.childNodes].map((f) => limparNo(f, doc)).filter(Boolean);
  if (!PERMITIDAS.has(nome)) {
    const frag = doc.createDocumentFragment();
    filhos.forEach((f) => frag.append(f));
    return frag;
  }
  const el = doc.createElement(nome.toLowerCase());
  if (nome === 'A') {
    const href = no.getAttribute('href') || '';
    // Link sem endereço seguro vira texto comum.
    if (!/^(https?:|mailto:)/i.test(href)) {
      const frag = doc.createDocumentFragment();
      filhos.forEach((f) => frag.append(f));
      return frag;
    }
    el.setAttribute('href', href);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  }
  if (nome === 'IMG') {
    // Só imagens guardadas no Storage do app (caminho em data-thumb).
    const caminho = no.getAttribute('data-thumb') || '';
    if (!/^[\w-]+\/cadernos\/[\w-]+\/[\w.-]+$/.test(caminho)) return null;
    el.setAttribute('data-thumb', caminho);
    el.setAttribute('alt', (no.getAttribute('alt') || '').slice(0, 200));
    return el;
  }
  if (nome === 'UL' && no.hasAttribute('data-check')) el.setAttribute('data-check', '');
  if (nome === 'LI' && no.getAttribute('data-feito') === '1') el.setAttribute('data-feito', '1');
  if ((nome === 'TD' || nome === 'TH') && no.getAttribute('colspan')) el.setAttribute('colspan', String(Math.min(20, Number(no.getAttribute('colspan')) || 1)));
  filhos.forEach((f) => el.append(f));
  return el;
}

export function limparHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const saida = document.implementation.createHTMLDocument('');
  const raiz = saida.createElement('div');
  for (const f of [...doc.body.childNodes]) {
    const limpo = limparNo(f, saida);
    if (limpo) raiz.append(limpo);
  }
  // Texto solto no nível de cima vira parágrafo (o editor sempre trabalha com blocos).
  let solto = null;
  for (const f of [...raiz.childNodes]) {
    const bloco = f.nodeType === 1 && BLOCOS.has(f.tagName);
    if (bloco) {
      solto = null;
    } else if (f.nodeType === 3 && !f.textContent.trim() && !solto) {
      f.remove();
    } else {
      if (!solto) {
        solto = saida.createElement('p');
        raiz.insertBefore(solto, f);
      }
      solto.append(f);
    }
  }
  // Linha vazia guarda um <br> (senão some ao abrir de novo).
  for (const b of raiz.querySelectorAll('p, h1, h2, h3, li, td, th')) if (!b.childNodes.length) b.append(saida.createElement('br'));
  return raiz.innerHTML;
}

// Texto puro (para a busca, o título da nota e a contagem de palavras): um bloco por linha.
export function textoPlano(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  const linhas = [];
  const andar = (no) => {
    for (const f of no.childNodes) {
      if (f.nodeType === 3) {
        if (!linhas.length) linhas.push('');
        linhas[linhas.length - 1] += f.textContent;
      } else if (f.nodeType === 1) {
        const bloco = /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|TR|DIV|BR|HR)$/.test(f.tagName);
        if (bloco) linhas.push('');
        andar(f);
        if (bloco) linhas.push('');
      }
    }
  };
  andar(doc.body);
  return linhas.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Títulos da página, para o índice do documento.
export function titulosDoHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html');
  return [...doc.body.querySelectorAll('h1, h2, h3')].map((h) => ({ nivel: Number(h.tagName[1]), texto: h.textContent.trim() })).filter((h) => h.texto);
}

// Página digitada atualizada, sem mexer na tinta.
export function comTexto(p, html) {
  const limpo = limparHtml(html);
  return {
    ...p,
    tracos_json: {
      versao: 1,
      camadas: [],
      ...(p.tracos_json || {}),
      texto: { html: limpo, plano: textoPlano(limpo), atualizado_em: new Date().toISOString() },
    },
  };
}
