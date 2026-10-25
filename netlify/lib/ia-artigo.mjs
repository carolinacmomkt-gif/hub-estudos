// Biblioteca: lê um PDF com a IA e devolve título, autor, resumo e o texto principal.

import { pedirJson, objeto, texto, limpar, ErroIa } from './ia-comum.mjs';

export { ErroIa };

const ESQUEMA = objeto({ titulo: texto, autor: texto, resumo: texto, texto });

export async function lerPdf(pdf, opcoes = {}) {
  const r = await pedirJson({
    system: 'Você transcreve artigos e capítulos para leitura em um app de estudos.',
    conteudo: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
      { type: 'text', text: 'Devolva o título, o autor (vazio se não houver), um resumo de 3 a 5 frases em português e o texto principal fiel ao original, em parágrafos separados por linha em branco (sem cabeçalhos de página, rodapés e números de página). Se o texto for muito longo, transcreva até onde couber e termine com "[continua no PDF]".' },
    ],
    esquema: ESQUEMA,
    maxTokens: 32000,
    ...opcoes,
  });
  return { titulo: limpar(r.titulo, 300), autor: limpar(r.autor, 200), resumo: limpar(r.resumo, 2000), texto: String(r.texto || '').slice(0, 400000) };
}
