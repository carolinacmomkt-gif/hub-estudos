// Gerador e corretor de questões (área Questões).
// Gera a partir de um tema (com pesquisa na web), de um texto da Biblioteca ou da imagem
// de uma página de caderno. Tudo volta em JSON validado antes de ir para a tela.

import { pedirJson, lista, texto, objeto, limpar, ErroIa } from './ia-comum.mjs';

export { ErroIa };

const ESQUEMA = objeto({
  questoes: lista('questões', objeto({
    tipo: { type: 'string', enum: ['multipla', 'vf', 'dissertativa'] },
    enunciado: texto,
    alternativas: lista('alternativas (só na múltipla escolha; vazio nos outros tipos)', texto),
    resposta_correta: { type: 'string', description: 'Múltipla: a letra (A, B, C…). V/F: "V" ou "F". Dissertativa: a resposta esperada, em poucas frases.' },
    explicacao: { type: 'string', description: 'Gabarito comentado: por que a certa está certa e por que as outras estão erradas' },
    fontes: lista('fontes consultadas', objeto({ titulo: texto, url: texto })),
    nivel: { type: 'string', enum: ['facil', 'medio', 'dificil'] },
  })),
});

const NOMES_NIVEL = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };

// Confere e arruma o que voltou: tipo certo, alternativas, letra da resposta e URLs seguras.
export function validarQuestoes(bruto, { modo, alternativas = 4 } = {}) {
  const saida = [];
  for (const q of Array.isArray(bruto?.questoes) ? bruto.questoes : []) {
    const enunciado = limpar(q?.enunciado, 2000);
    if (!enunciado) continue;
    let tipo = ['multipla', 'vf', 'dissertativa'].includes(q?.tipo) ? q.tipo : null;
    if (!tipo) continue;
    if (modo === 'fixacao') tipo = 'dissertativa';
    const item = {
      tipo,
      enunciado,
      alternativas: [],
      resposta_correta: limpar(q?.resposta_correta, 1500),
      explicacao: limpar(q?.explicacao, 3000),
      fontes: (Array.isArray(q?.fontes) ? q.fontes : [])
        .map((f) => ({ titulo: limpar(f?.titulo, 200), url: limpar(f?.url, 500) }))
        .filter((f) => /^https?:\/\//i.test(f.url))
        .slice(0, 5),
      nivel: ['facil', 'medio', 'dificil'].includes(q?.nivel) ? q.nivel : 'medio',
    };
    if (tipo === 'multipla') {
      item.alternativas = (Array.isArray(q?.alternativas) ? q.alternativas : []).map((a) => limpar(a, 500).replace(/^[A-Ea-e][).:-]\s*/, '')).filter(Boolean).slice(0, alternativas);
      const letra = item.resposta_correta.trim().charAt(0).toUpperCase();
      const indice = 'ABCDE'.indexOf(letra);
      if (item.alternativas.length < 3 || indice < 0 || indice >= item.alternativas.length) continue;
      item.resposta_correta = letra;
    } else if (tipo === 'vf') {
      const r = item.resposta_correta.trim().toUpperCase();
      item.resposta_correta = r.startsWith('V') || r.startsWith('T') ? 'V' : r.startsWith('F') ? 'F' : '';
      if (!item.resposta_correta) continue;
    } else if (!item.resposta_correta) continue;
    saida.push(item);
  }
  return saida;
}

// entrada: { fonte: 'tema'|'texto'|'imagem', tema, texto, imagem (base64 PNG), quantidade, dificuldade,
//            modo: 'prova'|'fixacao', tipos: ['multipla','vf'], alternativas: 4|5, disciplina, pesquisar }
export async function gerarQuestoes(entrada, opcoes = {}) {
  const quantidade = Math.max(1, Math.min(20, Number(entrada.quantidade) || 5));
  const alternativas = Number(entrada.alternativas) === 5 ? 5 : 4;
  const modo = entrada.modo === 'fixacao' ? 'fixacao' : 'prova';
  const tipos = modo === 'fixacao' ? ['dissertativa'] : (entrada.tipos?.length ? entrada.tipos.filter((t) => ['multipla', 'vf'].includes(t)) : ['multipla']);
  const nivel = NOMES_NIVEL[entrada.dificuldade] || 'médio';
  const pedido = [
    `Crie ${quantidade} questões de nível ${nivel}${entrada.disciplina ? ` para a disciplina "${limpar(entrada.disciplina, 120)}"` : ''}.`,
    modo === 'fixacao'
      ? 'Todas dissertativas (resposta curta, de 2 a 5 frases), para fixar o conteúdo. Em resposta_correta, escreva a resposta esperada.'
      : `Tipos: ${tipos.map((t) => (t === 'vf' ? 'verdadeiro ou falso' : `múltipla escolha com ${alternativas} alternativas`)).join(' e ')}. Na múltipla escolha, só uma alternativa certa e as erradas plausíveis.`,
    'Cada questão precisa de explicação comentada (por que a certa está certa e o erro de cada outra).',
    'Escreva em português do Brasil, com enunciados claros e sem pegadinha de português.',
  ];
  const conteudo = [];
  let ferramentas;
  if (entrada.fonte === 'imagem' && entrada.imagem) {
    conteudo.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: entrada.imagem } });
    pedido.unshift('A imagem é uma página de caderno escrita à mão. Use o conteúdo dela como base das questões.');
  } else if (entrada.fonte === 'texto' && entrada.texto) {
    conteudo.push({ type: 'text', text: `<texto>\n${String(entrada.texto).slice(0, 120000)}\n</texto>` });
    pedido.unshift('Baseie as questões no texto acima. Nas fontes, deixe a lista vazia (o texto é a fonte).');
  } else {
    pedido.unshift(`Tema: ${limpar(entrada.tema, 500)}.`);
  }
  if (entrada.pesquisar !== false && entrada.fonte !== 'imagem') {
    ferramentas = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];
    pedido.push('Pesquise na web para conferir os fatos e cite as fontes (título e URL) de cada questão.');
  }
  conteudo.push({ type: 'text', text: pedido.join('\n') });
  const bruto = await pedirJson({
    system: 'Você prepara questões de estudo para uma estudante universitária brasileira. Seja exata nos fatos e didática nas explicações.',
    conteudo,
    esquema: ESQUEMA,
    maxTokens: 16000,
    ferramentas,
    ...opcoes,
  });
  const questoes = validarQuestoes(bruto, { modo, alternativas });
  if (!questoes.length) throw new ErroIa('A IA não devolveu questões válidas. Tente de novo ou mude o tema.');
  return questoes;
}

const ESQUEMA_CORRECAO = objeto({
  nota: { type: 'number', description: 'de 0 a 10' },
  comentario: { type: 'string', description: 'o que ficou bom e o que faltou, em 2 a 5 frases, falando direto com a estudante' },
  correta: { type: 'boolean', description: 'true se a nota for 6 ou mais' },
});

export async function corrigirResposta({ enunciado, esperada, resposta }, opcoes = {}) {
  const r = await pedirJson({
    system: 'Você corrige respostas dissertativas de uma estudante universitária brasileira. Seja justa, direta e acolhedora; valorize o que está certo mesmo com outras palavras.',
    conteudo: `Questão: ${limpar(enunciado, 2000)}\nResposta esperada: ${limpar(esperada, 1500)}\nResposta da estudante: ${limpar(resposta, 4000)}\n\nDê uma nota de 0 a 10 e um comentário.`,
    esquema: ESQUEMA_CORRECAO,
    maxTokens: 1500,
    ...opcoes,
  });
  const nota = Math.max(0, Math.min(10, Math.round(Number(r.nota) * 10) / 10 || 0));
  return { nota, comentario: limpar(r.comentario, 1500), correta: nota >= 6 };
}
