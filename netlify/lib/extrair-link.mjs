// Biblioteca: baixa uma página da web e tira o texto principal (sem menus, anúncios e scripts).
// Só aceita http(s) para endereços públicos (nada de localhost ou rede interna).

import { lookup } from 'node:dns/promises';
import net from 'node:net';

export class ErroLink extends Error {}

const MAX_BYTES = 4 * 1024 * 1024;
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };

function decodificar(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, c) => {
    if (c[0] === '#') {
      const n = c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTIDADES[c.toLowerCase()] ?? m;
  });
}

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  // IPv4 dentro de IPv6 (::ffff:10.0.0.1): confere a parte IPv4.
  const v4 = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (v4) return ipPrivado(v4);
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') || x.startsWith('::ffff:');
}

export async function conferirEndereco(url, { permitirLocal = false } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new ErroLink('Esse link não parece um endereço válido.');
  }
  if (!/^https?:$/.test(u.protocol)) throw new ErroLink('Só dá para salvar links http ou https.');
  if (permitirLocal) return u;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new ErroLink('Esse endereço não é público.');
  const literal = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal)) {
    if (ipPrivado(literal)) throw new ErroLink('Esse endereço não é público.');
    return u;
  }
  const enderecos = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!enderecos.length) throw new ErroLink('Não achei esse site. Confira o link.');
  if (enderecos.some((e) => ipPrivado(e.address))) throw new ErroLink('Esse endereço não é público.');
  return u;
}

function meta(html, nomes) {
  for (const nome of nomes) {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nome}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const conteudo = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (conteudo) return decodificar(conteudo).trim();
  }
  return '';
}

// Texto principal de um HTML: <article>, senão <main>, senão o <body>, sem o que não é conteúdo.
export function textoDoHtml(html) {
  let corpo = html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    || html.match(/<main[\s\S]*?<\/main>/i)?.[0]
    || html.match(/<body[\s\S]*?<\/body>/i)?.[0]
    || html;
  corpo = corpo
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|figure)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|h[1-6]|li|blockquote|tr|pre)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');
  return decodificar(corpo)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Lê a resposta aos pedaços e para se passar do limite (sem baixar uma página gigante inteira).
async function lerComLimite(r) {
  const partes = [];
  let total = 0;
  const leitor = r.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await leitor.cancel().catch(() => {});
      throw new ErroLink('A página é grande demais. Cole só o texto do artigo.');
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    bytes.set(p, pos);
    pos += p.length;
  }
  return bytes;
}

export async function extrairDeLink(url, { permitirLocal = false } = {}) {
  let endereco = await conferirEndereco(url, { permitirLocal });
  let r;
  // Redirecionamentos um a um: cada endereço é conferido ANTES de ser acessado.
  for (let saltos = 0; ; saltos += 1) {
    try {
      r = await fetch(endereco, {
        headers: { 'User-Agent': 'Mozilla/5.0 (HubDeEstudos; leitura pessoal)', Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: AbortSignal.timeout(9000),
      });
    } catch {
      throw new ErroLink('O site não respondeu. Tente de novo ou cole o texto.');
    }
    const destino = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
    if (!destino) break;
    if (saltos >= 5) throw new ErroLink('O link redireciona vezes demais. Cole o texto do artigo.');
    endereco = await conferirEndereco(new URL(destino, endereco).href, { permitirLocal });
  }
  if (!r.ok) throw new ErroLink(`O site recusou a leitura (HTTP ${r.status}). Cole o texto do artigo.`);
  const tipo = r.headers.get('content-type') || '';
  if (/pdf/i.test(tipo)) throw new ErroLink('Esse link é de um PDF: baixe o arquivo e use "Enviar PDF".');
  if (!/html|text/i.test(tipo)) throw new ErroLink('Esse link não é uma página de texto.');
  const bytes = await lerComLimite(r);
  const html = new TextDecoder(/charset=iso-8859-1|latin1/i.test(tipo) ? 'latin1' : 'utf-8').decode(bytes);
  const titulo = meta(html, ['og:title', 'twitter:title']) || decodificar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const autor = meta(html, ['author', 'article:author', 'og:article:author', 'twitter:creator']);
  const site = meta(html, ['og:site_name']) || endereco.hostname.replace(/^www\./, '');
  const resumo = meta(html, ['og:description', 'description']);
  const texto = textoDoHtml(html).slice(0, 400000);
  if (texto.length < 200) throw new ErroLink('Não achei o texto do artigo nessa página (pode precisar de login). Cole o texto.');
  return { titulo: titulo.slice(0, 300) || site, autor: autor.slice(0, 200), site, resumo: resumo.slice(0, 1000), texto, url: endereco.href };
}
