// EPUB sem biblioteca: lê o pacote (OPF), a ordem dos capítulos, o sumário e a capa, e abre cada
// capítulo já limpo (só texto, títulos, listas, tabelas e imagens; sem scripts, estilos nem
// formulários). Quem desenha a página é o leitor (js/leitor-livro.js), com a tipografia da Carol.

import { abrirZip, ErroZip } from './zip.js';

const TAGS = new Set(['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'i', 'strong', 'b', 'u', 's', 'sup', 'sub',
  'br', 'hr', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'pre', 'code', 'section', 'article', 'small', 'cite', 'q', 'dl', 'dt', 'dd', 'abbr', 'mark', 'caption']);
const TROCAR = { aside: 'div', header: 'div', footer: 'div', main: 'div', nav: 'div', big: 'span', font: 'span', center: 'div' };
const FORA = new Set(['script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea',
  'audio', 'video', 'canvas', 'math', 'head', 'title', 'noscript', 'template']);
const TIPOS_IMAGEM = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

export { ErroZip as ErroEpub };

const dirDe = (caminho) => (caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/') + 1) : '');
function resolver(base, href) {
  const [semFrag, frag] = String(href || '').split('#');
  let caminho = semFrag;
  try { caminho = decodeURIComponent(semFrag); } catch { /* fica como veio */ }
  const partes = (caminho.startsWith('/') ? caminho.slice(1) : dirDe(base) + caminho).split('/');
  const saida = [];
  for (const p of partes) {
    if (p === '..') saida.pop();
    else if (p && p !== '.') saida.push(p);
  }
  return { caminho: saida.join('/'), frag: frag || '' };
}

function xml(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  return doc.querySelector('parsererror') ? new DOMParser().parseFromString(texto, 'text/html') : doc;
}
const porNome = (raiz, nome) => [...raiz.getElementsByTagName('*')].filter((e) => e.localName === nome);
const primeiro = (raiz, nome) => porNome(raiz, nome)[0] || null;
const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();

export async function abrirEpub(blob) {
  const zip = await abrirZip(blob);
  const container = await zip.texto('META-INF/container.xml');
  const opfCaminho = container && primeiro(xml(container), 'rootfile')?.getAttribute('full-path');
  if (!opfCaminho || !zip.tem(opfCaminho)) throw new ErroZip('Este EPUB está sem o índice do livro.');
  const opf = xml(await zip.texto(opfCaminho));

  const manifesto = new Map();
  for (const item of porNome(opf, 'item')) {
    manifesto.set(item.getAttribute('id'), {
      id: item.getAttribute('id'),
      caminho: resolver(opfCaminho, item.getAttribute('href')).caminho,
      tipo: item.getAttribute('media-type') || '',
      propriedades: item.getAttribute('properties') || '',
    });
  }
  const capitulos = porNome(opf, 'itemref')
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifesto.get(r.getAttribute('idref')))
    .filter((m) => m && zip.tem(m.caminho) && /x?html/.test(m.tipo || 'html'))
    .map((m) => ({ caminho: m.caminho, peso: Math.max(1, zip.tamanho(m.caminho)) }));
  if (!capitulos.length) throw new ErroZip('Não achei os capítulos deste EPUB.');

  const titulo = limpo(primeiro(opf, 'title')?.textContent);
  const autor = limpo(porNome(opf, 'creator').map((c) => c.textContent).join(', '));
  const idioma = limpo(primeiro(opf, 'language')?.textContent) || 'pt';

  // Capa: item "cover-image" (EPUB 3) ou <meta name="cover"> (EPUB 2).
  let capaItem = [...manifesto.values()].find((m) => /\bcover-image\b/.test(m.propriedades));
  if (!capaItem) {
    const meta = porNome(opf, 'meta').find((m) => m.getAttribute('name') === 'cover');
    capaItem = meta && manifesto.get(meta.getAttribute('content'));
  }
  if (!capaItem) capaItem = [...manifesto.values()].find((m) => m.tipo.startsWith('image/') && /cover|capa/i.test(m.caminho));
  const capa = async () => (capaItem && zip.tem(capaItem.caminho) ? zip.blob(capaItem.caminho, capaItem.tipo) : null);

  const sumario = await lerSumario(zip, opf, opfCaminho, manifesto, capitulos);

  const imagens = new Map(); // caminho → URL do blob (soltas no fechar)
  async function urlDaImagem(caminho) {
    if (!imagens.has(caminho)) {
      const ext = caminho.split('.').pop().toLowerCase();
      const b = TIPOS_IMAGEM[ext] && await zip.blob(caminho, TIPOS_IMAGEM[ext]);
      imagens.set(caminho, b ? URL.createObjectURL(b) : '');
    }
    return imagens.get(caminho);
  }

  async function capitulo(i) {
    const c = capitulos[i];
    if (!c) return null;
    const fonte = await zip.texto(c.caminho);
    let doc = new DOMParser().parseFromString(fonte, 'application/xhtml+xml');
    if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(fonte, 'text/html');
    const corpo = doc.body || primeiro(doc, 'body') || doc.documentElement;
    const saida = document.createElement('div');
    const pendentes = [];
    limparNo(corpo, saida, c.caminho, pendentes);
    for (const [img, caminho] of pendentes) {
      const url = await urlDaImagem(caminho);
      if (url) img.src = url;
      else img.remove();
    }
    return { elemento: saida, caminho: c.caminho, texto: saida.textContent.replace(/\s+/g, ' ').trim() };
  }

  return {
    titulo, autor, idioma, capitulos, sumario, capa, capitulo,
    indiceDe: (caminho) => capitulos.findIndex((c) => c.caminho === caminho),
    fechar: () => { for (const url of imagens.values()) if (url) URL.revokeObjectURL(url); imagens.clear(); },
  };
}

// Copia só o que é seguro, num elemento do próprio documento (nunca innerHTML do livro).
function limparNo(origem, destino, base, pendentes) {
  for (const no of [...origem.childNodes]) {
    if (no.nodeType === 3) { destino.append(no.textContent); continue; }
    if (no.nodeType !== 1) continue;
    let tag = no.localName.toLowerCase();
    if (FORA.has(tag)) continue;
    if (tag === 'svg') {
      const imagem = primeiro(no, 'image');
      const href = imagem?.getAttribute('href') || imagem?.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href');
      if (href) {
        const img = document.createElement('img');
        img.alt = '';
        pendentes.push([img, resolver(base, href).caminho]);
        destino.append(img);
      }
      continue;
    }
    tag = TROCAR[tag] || tag;
    if (!TAGS.has(tag)) { limparNo(no, destino, base, pendentes); continue; }
    const el = document.createElement(tag);
    const id = no.getAttribute('id');
    if (id) el.id = `l-${id.replace(/[^\w-]/g, '_')}`;
    if (tag === 'img') {
      const src = no.getAttribute('src');
      if (!src || /^(data|blob|javascript):/i.test(src)) continue;
      el.alt = no.getAttribute('alt') || '';
      pendentes.push([el, resolver(base, src).caminho]);
    } else if (tag === 'a') {
      const href = no.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        el.href = href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      } else if (href && !/^[a-z]+:/i.test(href)) {
        const r = href.startsWith('#') ? { caminho: base, frag: href.slice(1) } : resolver(base, href);
        el.dataset.livroLink = `${r.caminho}#${r.frag}`;
        el.href = '#';
      }
    } else if ((tag === 'td' || tag === 'th') && no.getAttribute('colspan')) {
      el.colSpan = Math.min(20, Number(no.getAttribute('colspan')) || 1);
    }
    // Pequenas pistas do livro que importam para ler (centralizado, versalete) viram classes nossas.
    const classe = `${no.getAttribute('class') || ''} ${no.getAttribute('style') || ''}`;
    if (/center|centr/i.test(classe)) el.classList.add('l-centro');
    if (/small-caps|versal/i.test(classe)) el.classList.add('l-versalete');
    limparNo(no, el, base, pendentes);
    destino.append(el);
  }
}

async function lerSumario(zip, opf, opfCaminho, manifesto, capitulos) {
  const itens = [];
  const nav = [...manifesto.values()].find((m) => /\bnav\b/.test(m.propriedades));
  if (nav && zip.tem(nav.caminho)) {
    const doc = xml(await zip.texto(nav.caminho));
    const lugar = porNome(doc, 'nav').find((n) => /toc/.test(n.getAttribute('epub:type') || n.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type') || n.getAttribute('type') || 'toc')) || primeiro(doc, 'nav');
    const andar = (lista, nivel) => {
      for (const li of [...(lista?.children || [])].filter((x) => x.localName === 'li')) {
        const a = [...li.children].find((x) => x.localName === 'a' || x.localName === 'span');
        const href = a?.getAttribute('href');
        if (href) itens.push({ titulo: limpo(a.textContent) || 'Sem título', ...resolver(nav.caminho, href), nivel });
        const sub = [...li.children].find((x) => x.localName === 'ol' || x.localName === 'ul');
        if (sub) andar(sub, nivel + 1);
      }
    };
    if (lugar) andar([...lugar.children].find((x) => x.localName === 'ol' || x.localName === 'ul'), 0);
  }
  if (!itens.length) {
    const spine = primeiro(opf, 'spine');
    const ncx = manifesto.get(spine?.getAttribute('toc')) || [...manifesto.values()].find((m) => /ncx/.test(m.tipo));
    if (ncx && zip.tem(ncx.caminho)) {
      const doc = xml(await zip.texto(ncx.caminho));
      const andar = (pai, nivel) => {
        for (const p of [...pai.children].filter((x) => x.localName === 'navPoint')) {
          const rotulo = limpo(primeiro(p, 'text')?.textContent);
          const src = primeiro(p, 'content')?.getAttribute('src');
          if (src) itens.push({ titulo: rotulo || 'Sem título', ...resolver(ncx.caminho, src), nivel });
          andar(p, nivel + 1);
        }
      };
      const mapa = primeiro(doc, 'navMap');
      if (mapa) andar(mapa, 0);
    }
  }
  // Sem sumário no livro: um item por capítulo.
  const lista = itens.length ? itens : capitulos.map((c, i) => ({ titulo: `Parte ${i + 1}`, caminho: c.caminho, frag: '', nivel: 0 }));
  return lista.map((x) => ({ ...x, capitulo: capitulos.findIndex((c) => c.caminho === x.caminho) })).filter((x) => x.capitulo >= 0).slice(0, 400);
}
