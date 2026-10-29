// IA do leitor de livros (só quando a Carol pede): explicar um trecho e resumir um capítulo.

import { pedirJson, lista, objeto, texto, limpar } from './ia-comum.mjs';

const SYSTEM = `Você ajuda a Carol a entender o que ela está lendo. Ela estuda Publicidade, é sócia de uma agência de marketing para médicos e lê de tudo.
Responda em português do Brasil, direto e acolhedor, sem travessão e sem enrolar. Não invente o que não está no texto: quando usar conhecimento de fora, diga.`;

export async function explicarTrecho({ trecho, contexto, livro }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: `Livro: ${limpar(livro, 200)}\n\nTrecho que ela marcou:\n"""${String(trecho).slice(0, 3000)}"""\n\nTexto em volta (para entender o contexto):\n"""${String(contexto || '').slice(0, 6000)}"""\n\nExplique o trecho em poucas linhas (palavras difíceis, a ideia central e por que importa ali). Em "exemplo", um exemplo simples do dia a dia, se ajudar.`,
    esquema: objeto({ explicacao: texto, exemplo: texto }),
    maxTokens: 1500,
    cliente,
  });
  return { explicacao: limpar(r.explicacao, 2000), exemplo: limpar(r.exemplo, 600) };
}

export async function resumirCapitulo({ texto: corpo, capitulo, livro }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: `Livro: ${limpar(livro, 200)}\nCapítulo: ${limpar(capitulo, 200)}\n\nTexto do capítulo:\n"""${String(corpo).slice(0, 80000)}"""\n\nFaça o resumo do capítulo: "resumo" em um parágrafo curto e "pontos" com as ideias principais (até 6, uma frase cada).`,
    esquema: objeto({ resumo: texto, pontos: lista('Ideias principais', texto) }),
    maxTokens: 2000,
    cliente,
  });
  return { resumo: limpar(r.resumo, 2000), pontos: (r.pontos || []).map((p) => limpar(p, 300)).filter(Boolean).slice(0, 6) };
}
