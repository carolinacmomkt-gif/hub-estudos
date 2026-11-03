// IA dos Cadernos (só quando a Carol pede, na seleção do laço): converter a letra em texto digitado e
// verificar a ortografia da letra. Recebe a imagem da seleção (PNG ou JPEG em base64).

import { pedirJson, lista, objeto, texto, limpar } from './ia-comum.mjs';

const SYSTEM = `Você lê a letra à mão da Carol em páginas de caderno (estudos, trabalho e vida). Ela escreve em português do Brasil.
Leia com cuidado, respeitando as quebras de linha. Nunca invente o que não está escrito: o que não der para ler fica como [?].`;

const imagem = ({ base64, tipo }) => ({ type: 'image', source: { type: 'base64', media_type: tipo === 'image/jpeg' ? 'image/jpeg' : 'image/png', data: base64 } });

export async function converterEmTexto({ base64, tipo }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: [imagem({ base64, tipo }), { type: 'text', text: 'Transcreva a letra da imagem em "texto", exatamente como está escrita (mesma ordem e quebras de linha; listas viram linhas com "- "). Em "duvidas", as palavras que você não teve certeza.' }],
    esquema: objeto({ texto, duvidas: lista('Palavras incertas', texto) }),
    maxTokens: 3000,
    cliente,
  });
  return { texto: String(r.texto || '').slice(0, 8000).trim(), duvidas: (r.duvidas || []).map((d) => limpar(d, 60)).filter(Boolean).slice(0, 12) };
}

export async function verificarOrtografia({ base64, tipo }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: [imagem({ base64, tipo }), { type: 'text', text: 'Leia a letra e aponte os erros de ortografia e de acentuação (não de estilo). Para cada um: "escrito" como está na imagem, "certo" como deveria ser e "porque" em poucas palavras. Se não houver erro, a lista vem vazia. Em "texto", a transcrição do que leu.' }],
    esquema: objeto({ texto, erros: lista('Erros de ortografia', objeto({ escrito: texto, certo: texto, porque: texto })) }),
    maxTokens: 2000,
    cliente,
  });
  return {
    texto: String(r.texto || '').slice(0, 6000).trim(),
    erros: (r.erros || []).map((e) => ({ escrito: limpar(e.escrito, 60), certo: limpar(e.certo, 60), porque: limpar(e.porque, 160) })).filter((e) => e.escrito && e.certo).slice(0, 30),
  };
}
