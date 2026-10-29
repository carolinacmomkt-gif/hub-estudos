// Leitor de ZIP bem pequeno (o EPUB é um ZIP): lê o índice central e abre cada arquivo na hora
// em que precisa, com o DecompressionStream do navegador (sem biblioteca).

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

export class ErroZip extends Error {}

export async function abrirZip(blob) {
  const dados = new Uint8Array(await blob.arrayBuffer());
  const vista = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  // O "fim do índice" fica nos últimos 22 bytes (mais um comentário de até 64 KB).
  let fim = -1;
  for (let i = dados.length - 22; i >= Math.max(0, dados.length - 22 - 65535); i -= 1) {
    if (vista.getUint32(i, true) === ASSINATURA_FIM) { fim = i; break; }
  }
  if (fim < 0) throw new ErroZip('Este arquivo não parece um EPUB (não é um ZIP).');
  const total = vista.getUint16(fim + 10, true);
  let p = vista.getUint32(fim + 16, true);
  const entradas = new Map();
  const decodificador = new TextDecoder();
  for (let n = 0; n < total; n += 1) {
    if (p + 46 > dados.length || vista.getUint32(p, true) !== ASSINATURA_CENTRAL) throw new ErroZip('O EPUB está danificado.');
    const metodo = vista.getUint16(p + 10, true);
    const comprimido = vista.getUint32(p + 20, true);
    const tamanho = vista.getUint32(p + 24, true);
    const lNome = vista.getUint16(p + 28, true);
    const lExtra = vista.getUint16(p + 30, true);
    const lComentario = vista.getUint16(p + 32, true);
    const local = vista.getUint32(p + 42, true);
    const nome = decodificador.decode(dados.subarray(p + 46, p + 46 + lNome));
    entradas.set(nome, { nome, metodo, comprimido, tamanho, local });
    p += 46 + lNome + lExtra + lComentario;
  }

  async function bytes(nome) {
    const e = entradas.get(nome);
    if (!e) return null;
    if (vista.getUint32(e.local, true) !== ASSINATURA_LOCAL) throw new ErroZip('O EPUB está danificado.');
    const inicio = e.local + 30 + vista.getUint16(e.local + 26, true) + vista.getUint16(e.local + 28, true);
    const pedaco = dados.subarray(inicio, inicio + e.comprimido);
    if (e.metodo === 0) return pedaco;
    if (e.metodo !== 8) throw new ErroZip('Este EPUB usa uma compressão que o app não lê.');
    const fluxo = new Blob([pedaco]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  }

  return {
    nomes: () => [...entradas.keys()],
    tamanho: (nome) => entradas.get(nome)?.tamanho || 0,
    tem: (nome) => entradas.has(nome),
    bytes,
    texto: async (nome) => { const b = await bytes(nome); return b ? new TextDecoder().decode(b) : null; },
    blob: async (nome, tipo = '') => { const b = await bytes(nome); return b ? new Blob([b], { type: tipo }) : null; },
  };
}
