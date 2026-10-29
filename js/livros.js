// Livro novo na Biblioteca: confere o arquivo (PDF ou EPUB, até 50 MB), tira o título, o autor e
// uma capa pequena (JPEG em data URL, uns 20 KB) do próprio livro e sobe o arquivo para o Storage.

import { abrirEpub } from './epub.js';
import { abrirPdf, guardarNoAparelho } from './fundos.js';
import { enviarArquivo } from './nuvem.js';
import { formatoDoArquivo, tituloDoArquivo, MAX_LIVRO } from './dados-livros.js';

const LARGURA_CAPA = 320;

async function capaDeImagem(fonte) {
  const escala = Math.min(1, LARGURA_CAPA / fonte.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(fonte.width * escala));
  canvas.height = Math.max(1, Math.round(fonte.height * escala));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

// { formato, titulo, autor, capa } (capa pode faltar; o livro abre do mesmo jeito)
export async function lerLivro(arquivo) {
  const formato = formatoDoArquivo(arquivo);
  if (!formato) throw new Error('O arquivo precisa ser PDF ou EPUB.');
  if (arquivo.size > MAX_LIVRO) throw new Error(`O livro tem ${Math.round(arquivo.size / 1024 / 1024)} MB; o limite é 50 MB. Tente uma versão mais leve (EPUB costuma ser bem menor que PDF).`);
  const base = { formato, titulo: tituloDoArquivo(arquivo.name), autor: '', capa: null };
  if (formato === 'epub') {
    const livro = await abrirEpub(arquivo);
    let capa = null;
    try {
      const blob = await livro.capa();
      if (blob) capa = await capaDeImagem(await createImageBitmap(blob));
    } catch { /* sem capa */ }
    livro.fechar();
    return { ...base, titulo: livro.titulo || base.titulo, autor: livro.autor, capa, capitulos: livro.capitulos.length };
  }
  const doc = await abrirPdf(arquivo);
  let titulo = base.titulo;
  let autor = '';
  let capa = null;
  try {
    const { info } = await doc.getMetadata();
    if (String(info?.Title || '').trim().length > 2) titulo = String(info.Title).trim().slice(0, 300);
    autor = String(info?.Author || '').trim().slice(0, 200);
  } catch { /* sem metadados */ }
  try {
    const pagina = await doc.getPage(1);
    const base1 = pagina.getViewport({ scale: 1 });
    const vista = pagina.getViewport({ scale: LARGURA_CAPA / base1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vista.width);
    canvas.height = Math.round(vista.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    capa = canvas.toDataURL('image/jpeg', 0.72);
  } catch { /* sem capa */ }
  const paginas = doc.numPages;
  doc.destroy();
  return { ...base, titulo, autor, capa, paginas };
}

// Sobe o arquivo e já deixa uma cópia no aparelho (o livro abre na hora e sem internet).
export async function guardarLivro(caminho, arquivo, formato) {
  const tipo = formato === 'epub' ? 'application/epub+zip' : 'application/pdf';
  const blob = arquivo.type === tipo ? arquivo : new Blob([arquivo], { type: tipo });
  try {
    await enviarArquivo(caminho, blob);
  } catch (erro) {
    if (erro.status === 413 || /too large|exceeded|maximum/i.test(erro.detalhe || '')) throw new Error('O Supabase recusou o tamanho do arquivo. No plano gratuito o limite é 50 MB por arquivo.');
    throw erro;
  }
  await guardarNoAparelho(caminho, blob);
}
