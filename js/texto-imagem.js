// O texto digitado de uma página vira uma imagem do tamanho da folha, com a mesma tipografia
// do documento (css/texto.css, regras de .folha-texto). Assim, no tablet, a escrita à mão fica por
// cima do texto, e a miniatura e a exportação mostram os dois juntos.
// A imagem é um SVG em data: (com as fotos embutidas): o canvas continua exportável.

import { urlDaThumb } from './thumbs-youtube.js';

const cache = new Map(); // chave → Promise<{ imagem, altura }>
let regras = null;

// As regras de .folha-texto da folha de estilos (uma fonte só para a tela e para a imagem).
function cssDaFolha() {
  if (regras !== null) return regras;
  const partes = [];
  for (const folha of document.styleSheets) {
    let lista;
    try {
      lista = folha.cssRules;
    } catch {
      continue;
    }
    for (const r of lista || []) if (r.selectorText?.includes('.folha-texto')) partes.push(r.cssText);
  }
  regras = partes.join('\n');
  return regras;
}

const paraDataUrl = (blob) => new Promise((ok) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(leitor.result);
  leitor.onerror = () => ok('');
  leitor.readAsDataURL(blob);
});

async function embutirImagens(raiz) {
  await Promise.all([...raiz.querySelectorAll('img[data-thumb]')].map(async (img) => {
    try {
      const url = await urlDaThumb(img.dataset.thumb);
      img.setAttribute('src', await paraDataUrl(await (await fetch(url)).blob()));
    } catch {
      img.remove();
    }
    img.removeAttribute('data-thumb');
  }));
}

// Altura que o texto ocupa, em unidades da página (a largura da página é dim.largura).
export function alturaDoTexto(html, dim) {
  const caixa = document.createElement('div');
  caixa.className = 'folha-texto';
  caixa.style.cssText = `--u: 1px; position: absolute; left: -100000px; top: 0; width: ${dim.largura}px; visibility: hidden;`;
  caixa.innerHTML = html;
  for (const img of caixa.querySelectorAll('img')) img.style.minHeight = '200px';
  document.body.append(caixa);
  const altura = caixa.scrollHeight;
  caixa.remove();
  return altura;
}

async function montar(html, dim, cor) {
  const corpo = document.createElement('div');
  corpo.innerHTML = html;
  await embutirImagens(corpo);
  const altura = Math.max(dim.altura, alturaDoTexto(corpo.innerHTML, dim));
  const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  div.setAttribute('class', 'folha-texto');
  div.setAttribute('style', `--u: 1px; width: ${dim.largura}px; color: ${cor};`);
  div.innerHTML = corpo.innerHTML;
  const estilo = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  estilo.textContent = cssDaFolha();
  const xhtml = new XMLSerializer().serializeToString(estilo) + new XMLSerializer().serializeToString(div);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim.largura}" height="${altura}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const imagem = new Image();
  imagem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await imagem.decode();
  return { imagem, altura };
}

// { imagem, altura } ou null (sem texto). "cor" é a cor da tinta do texto (papel claro ou escuro).
export function imagemDoTexto(html, dim, cor) {
  if (!html) return Promise.resolve(null);
  const chave = `${dim.largura}|${dim.altura}|${cor}|${html}`;
  if (!cache.has(chave)) {
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    const p = montar(html, dim, cor).catch(() => null);
    cache.set(chave, p);
    p.then((r) => { if (!r) cache.delete(chave); });
  }
  return cache.get(chave);
}

// Cor do texto no papel do tema (ou no papel de impressão).
export function corDoTextoNoPapel({ impressao = false } = {}) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(impressao ? '--impressao-tinta-tinta' : '--tinta-tinta').trim();
  return v || '#2B1E16';
}
