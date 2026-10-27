// Exportar páginas de caderno em PNG ou PDF. Tudo no aparelho: cada página é desenhada
// num canvas (papel claro, para imprimir) e o PDF é montado aqui, com uma imagem JPEG por página.

import { desenharPaginaEm, coresDoPapel, carregarImagensDaPagina } from './editor-tinta.js';
import { imagemDoFundo } from './fundos.js';
import { imagemDoTexto, corDoTextoNoPapel } from './texto-imagem.js';

const LARGURA_PX = 1600; // ~190 dpi numa A4

// pagina: { tracos_json, modelo_folha, pdf_path }; dim: { largura, altura, mm }
async function desenharPagina(pagina, dim, largura = LARGURA_PX) {
  const canvas = document.createElement('canvas');
  const escala = largura / dim.largura;
  canvas.width = Math.round(dim.largura * escala);
  canvas.height = Math.round(dim.altura * escala);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  const json = { ...(pagina.tracos_json || {}), modelo: pagina.modelo_folha || pagina.tracos_json?.modelo };
  await carregarImagensDaPagina(json);
  const texto = await imagemDoTexto(pagina.tracos_json?.texto?.html, dim, corDoTextoNoPapel({ impressao: true }));
  desenharPaginaEm(ctx, json, dim, { imagem: await imagemDoFundo(pagina), texto: texto?.imagem, cores: coresDoPapel({ impressao: true }) });
  return canvas;
}

const comoBlob = (canvas, tipo, qualidade) => new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));

export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
}

export const nomeDeArquivo = (texto) => String(texto || 'caderno').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'caderno';

export async function pngDaPagina(pagina, dim) {
  return comoBlob(await desenharPagina(pagina, dim), 'image/png');
}

// ---------------------------------------------------------------------------
// PDF mínimo: catálogo, páginas e uma imagem JPEG (DCTDecode) em cada página.
// ---------------------------------------------------------------------------

const texto = new TextEncoder();
const pontos = (mmValor) => (mmValor * 72) / 25.4;

export async function pdfDasPaginas(lista, aoAndar = () => {}) {
  const partes = [];
  const posicoes = [];
  let tamanho = 0;
  const escrever = (dado) => {
    const bytes = typeof dado === 'string' ? texto.encode(dado) : dado;
    partes.push(bytes);
    tamanho += bytes.length;
  };
  const objeto = (n, corpo, fluxo = null) => {
    posicoes[n] = tamanho;
    escrever(`${n} 0 obj\n${corpo}\n`);
    if (fluxo) {
      escrever('stream\n');
      escrever(fluxo);
      escrever('\nendstream\n');
    }
    escrever('endobj\n');
  };

  escrever('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const total = lista.length;
  const idsPaginas = lista.map((_, i) => 3 + i * 3);
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, `<< /Type /Pages /Kids [${idsPaginas.map((n) => `${n} 0 R`).join(' ')}] /Count ${total} >>`);
  for (let i = 0; i < total; i += 1) {
    aoAndar(i + 1, total);
    const { pagina, dim } = lista[i];
    const canvas = await desenharPagina(pagina, dim);
    const jpeg = new Uint8Array(await (await comoBlob(canvas, 'image/jpeg', 0.88)).arrayBuffer());
    const mmPorUnidade = 1 / (dim.mm || 1000 / 210);
    const w = pontos(dim.largura * mmPorUnidade).toFixed(2);
    const h = pontos(dim.altura * mmPorUnidade).toFixed(2);
    const [nPag, nConteudo, nImagem] = [idsPaginas[i], idsPaginas[i] + 1, idsPaginas[i] + 2];
    objeto(nPag, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${nImagem} 0 R >> >> /Contents ${nConteudo} 0 R >>`);
    const desenho = texto.encode(`q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`);
    objeto(nConteudo, `<< /Length ${desenho.length} >>`, desenho);
    objeto(nImagem, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  }
  const ultimo = 2 + total * 3;
  const inicioXref = tamanho;
  let xref = `xref\n0 ${ultimo + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= ultimo; n += 1) xref += `${String(posicoes[n]).padStart(10, '0')} 00000 n \n`;
  escrever(xref);
  escrever(`trailer\n<< /Size ${ultimo + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}
