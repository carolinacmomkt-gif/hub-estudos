// Thumbnails do Hub do YouTube: reduz a imagem no aparelho, guarda no Storage e mostra.

import { enviarArquivo, baixarArquivo, apagarArquivo, idDaUsuaria } from './nuvem.js';

export const MAX_THUMBS = 3;
const LARGURA = 1280; // tamanho recomendado de thumbnail: 1280 × 720
const urls = new Map(); // caminho → URL local da imagem (para não baixar de novo)

// Reduz para no máximo 1280 px de largura, em JPEG (thumbnails ficam leves e rápidas de abrir).
export async function reduzirImagem(arquivo) {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LARGURA / imagem.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close?.();
  return new Promise((ok, falhou) => canvas.toBlob((b) => (b ? ok(b) : falhou(new Error('Não deu para ler a imagem.'))), 'image/jpeg', 0.86));
}

export async function enviarThumb(videoId, arquivo) {
  if (!/^image\//.test(arquivo.type || '')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).');
  const usuaria = idDaUsuaria();
  if (!usuaria) throw new Error('Entre no app para enviar imagens.');
  const blob = await reduzirImagem(arquivo);
  const id = crypto.randomUUID();
  const caminho = `${usuaria}/youtube/${videoId}/${id}.jpg`;
  await enviarArquivo(caminho, new File([blob], `${id}.jpg`, { type: 'image/jpeg' }));
  urls.set(caminho, URL.createObjectURL(blob));
  return { id, caminho, criado_em: new Date().toISOString() };
}

export async function urlDaThumb(caminho) {
  if (!urls.has(caminho)) urls.set(caminho, URL.createObjectURL(await baixarArquivo(caminho)));
  return urls.get(caminho);
}

export async function apagarThumb(caminho) {
  const url = urls.get(caminho);
  if (url) URL.revokeObjectURL(url);
  urls.delete(caminho);
  await apagarArquivo(caminho);
}

// Preenche as <img data-thumb="caminho"> da tela (baixa quando precisa).
export function carregarThumbsDaTela(raiz = document) {
  for (const img of raiz.querySelectorAll('img[data-thumb]')) {
    if (img.src) continue;
    urlDaThumb(img.dataset.thumb).then((url) => { img.src = url; }).catch(() => {
      img.alt = 'Imagem indisponível sem internet';
      img.classList.add('thumb-indisponivel');
    });
  }
}
