// Ajuda da IA no Hub do YouTube: títulos, ganchos, roteiro, pacote de publicação,
// ideias de thumbnail e cortes para Shorts. Respostas em JSON com esquema garantido.

import Anthropic from '@anthropic-ai/sdk';

export const MODELO = 'claude-sonnet-5-5';

const lista = (descricao, itens) => ({ type: 'array', description: descricao, items: itens });
const texto = { type: 'string' };
const objeto = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });

const PEDIDOS = {
  titulos: {
    instrucao: 'Sugira 8 títulos para este vídeo: curtos (até 60 caracteres), específicos, que despertem curiosidade sem enganar. Varie os ângulos (número, pergunta, resultado, erro comum, história). Para cada um, diga em poucas palavras por que funciona.',
    esquema: objeto({ titulos: lista('títulos sugeridos', objeto({ titulo: texto, porque: texto })) }),
  },
  ganchos: {
    instrucao: 'Escreva 5 ganchos para os primeiros 10 segundos do vídeo, cada um com no máximo 2 frases faladas, em tom natural e direto. Varie: promessa, pergunta, dado surpreendente, contraste, história em andamento.',
    esquema: objeto({ ganchos: lista('ganchos', objeto({ gancho: texto, tipo: texto })) }),
  },
  roteiro: {
    instrucao: 'Monte um rascunho de roteiro em blocos para o formato indicado: gancho curto, promessa, blocos com mini-ganchos entre eles, uma chamada lá pelos 60–70% (inscrição ou comentário) e final que indica o próximo vídeo. Escreva como fala (frases curtas), em português do Brasil. Se já houver texto no roteiro, aproveite e melhore em vez de ignorar.',
    esquema: objeto({ blocos: lista('blocos do roteiro', objeto({ tipo: { type: 'string', enum: ['gancho', 'intro', 'bloco', 'cta', 'final'] }, titulo: texto, texto })) }),
  },
  publicacao: {
    instrucao: 'Escreva o pacote de publicação: um resumo de 2 a 3 frases para o começo da descrição (as 2 primeiras linhas aparecem antes do "mais", então comece pelo que a pessoa ganha), até 15 tags (palavras-chave que alguém buscaria, sem #) e até 3 hashtags (com #).',
    esquema: objeto({ resumo: texto, tags: lista('tags', texto), hashtags: lista('hashtags', texto) }),
  },
  thumbs: {
    instrucao: 'Sugira 4 conceitos de thumbnail: o que aparece na imagem, expressão ou objeto principal, e o texto curto (até 4 palavras) que vai na thumb. O texto não deve repetir o título; ele completa a curiosidade.',
    esquema: objeto({ ideias: lista('conceitos de thumbnail', objeto({ imagem: texto, texto_na_thumb: texto, porque: texto })) }),
  },
  cortes: {
    instrucao: 'A partir do roteiro, sugira até 5 cortes que funcionam sozinhos como Shorts (até 60 s): um título curto para cada, o gancho de abertura do Short e de qual bloco do roteiro ele sai.',
    esquema: objeto({ cortes: lista('cortes para Shorts', objeto({ titulo: texto, gancho: texto, de_onde: texto })) }),
  },
};

export const ACOES_IA = Object.keys(PEDIDOS);

export class ErroIaYoutube extends Error {}

const limpar = (v, max) => String(v ?? '').slice(0, max);

function descreverVideo(v) {
  const roteiro = (v.roteiro?.blocos || []).map((b) => `[${b.tipo}] ${b.titulo || ''}\n${b.texto || ''}`).join('\n\n');
  return [
    `Título de trabalho: ${limpar(v.titulo, 120)}`,
    `Formato: ${v.formato === 'short' ? 'Short (vertical, até 60 s)' : v.formato === 'live' ? 'Live' : 'vídeo longo'}`,
    v.pilar ? `Pilar do canal: ${limpar(v.pilar, 60)}` : '',
    v.publico ? `Para quem: ${limpar(v.publico, 300)}` : '',
    v.gancho ? `Gancho atual: ${limpar(v.gancho, 500)}` : '',
    v.notas ? `Notas da criadora: ${limpar(v.notas, 3000)}` : '',
    roteiro.trim() ? `Roteiro atual:\n${limpar(roteiro, 30000)}` : 'Roteiro ainda vazio.',
  ].filter(Boolean).join('\n');
}

export async function ajudaDaIa(acao, video, { cliente } = {}) {
  const pedido = PEDIDOS[acao];
  if (!pedido) throw new ErroIaYoutube('Pedido desconhecido.');
  if (!process.env.ANTHROPIC_API_KEY && !cliente) throw new ErroIaYoutube('Falta a variável ANTHROPIC_API_KEY na Netlify.');
  const anthropic = cliente || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let mensagem;
  try {
    mensagem = await anthropic.beta.messages.stream({
      model: MODELO,
      max_tokens: acao === 'roteiro' ? 8000 : 3000,
      // Se o modelo recusar o pedido, a API tenta de novo com o modelo reserva recomendado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'Você ajuda uma criadora brasileira a planejar vídeos do YouTube. Escreva sempre em português do Brasil, em tom direto e acolhedor, sem clichês de marketing e sem prometer o que o vídeo não entrega.',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: pedido.esquema } },
      messages: [{ role: 'user', content: `${descreverVideo(video)}\n\nPedido: ${pedido.instrucao}` }],
    }).finalMessage();
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) throw new ErroIaYoutube('A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY na Netlify.');
    if (erro instanceof Anthropic.RateLimitError) throw new ErroIaYoutube('A IA está com muitos pedidos agora. Tente de novo em alguns minutos.');
    if (erro instanceof Anthropic.APIError) throw new ErroIaYoutube(`A IA não respondeu agora (${erro.status || 'sem status'}). Tente de novo.`);
    throw erro;
  }
  if (mensagem.stop_reason === 'refusal') throw new ErroIaYoutube('A IA não quis responder a este pedido. Ajuste o texto e tente de novo.');
  const bloco = mensagem.content.find((b) => b.type === 'text');
  if (!bloco) throw new ErroIaYoutube('A IA não devolveu nada.');
  try {
    return JSON.parse(bloco.text);
  } catch {
    throw new ErroIaYoutube('A resposta da IA veio num formato inesperado. Tente de novo.');
  }
}
