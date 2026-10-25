// Pedido à IA (API da Anthropic) que devolve JSON com esquema garantido.
// Cuida do modelo reserva, das pausas da pesquisa na web e das mensagens de erro em português.

import Anthropic from '@anthropic-ai/sdk';

export const MODELO = 'claude-sonnet-5-5';
export class ErroIa extends Error {}

export async function pedirJson({ system, conteudo, esquema, maxTokens = 8000, ferramentas, esforco = 'low', cliente } = {}) {
  if (!process.env.ANTHROPIC_API_KEY && !cliente) throw new ErroIa('Falta a variável ANTHROPIC_API_KEY na Netlify.');
  const anthropic = cliente || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const mensagens = [{ role: 'user', content: conteudo }];
  let mensagem;
  try {
    // Com a pesquisa na web, a API pode pausar o turno (pause_turn): continua até 4 vezes.
    for (let volta = 0; volta < 4; volta += 1) {
      mensagem = await anthropic.beta.messages.stream({
        model: MODELO,
        max_tokens: maxTokens,
        // Se o modelo recusar o pedido, a API tenta de novo com o modelo reserva recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        ...(ferramentas ? { tools: ferramentas } : {}),
        output_config: { effort: esforco, format: { type: 'json_schema', schema: esquema } },
        messages: mensagens,
      }).finalMessage();
      if (mensagem.stop_reason !== 'pause_turn') break;
      mensagens.push({ role: 'assistant', content: mensagem.content });
    }
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) throw new ErroIa('A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY na Netlify.');
    if (erro instanceof Anthropic.RateLimitError) throw new ErroIa('A IA está com muitos pedidos agora. Tente de novo em alguns minutos.');
    if (erro instanceof Anthropic.BadRequestError && /pdf|document|image/i.test(String(erro.message))) {
      throw new ErroIa('A IA não conseguiu abrir este arquivo. Tente outro, ou cole o texto.');
    }
    if (erro instanceof Anthropic.APIError) throw new ErroIa(`A IA não respondeu agora (${erro.status || 'sem status'}). Tente de novo.`);
    throw erro;
  }
  if (mensagem.stop_reason === 'refusal') throw new ErroIa('A IA não quis responder a este pedido. Ajuste o texto e tente de novo.');
  if (mensagem.stop_reason === 'max_tokens') throw new ErroIa('O pedido ficou grande demais para uma resposta só. Peça menos itens ou um texto menor.');
  const bloco = [...mensagem.content].reverse().find((b) => b.type === 'text');
  if (!bloco) throw new ErroIa('A IA não devolveu nada.');
  try {
    return JSON.parse(bloco.text);
  } catch {
    throw new ErroIa('A resposta da IA veio num formato inesperado. Tente de novo.');
  }
}

export const lista = (descricao, itens) => ({ type: 'array', description: descricao, items: itens });
export const texto = { type: 'string' };
export const objeto = (props) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
export const limpar = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
