// IA do leitor de livros. Corpo: { acao: 'explicar', trecho, contexto, livro }
//                              ou { acao: 'resumir', texto, capitulo, livro }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { explicarTrecho, resumirCapitulo } from '../lib/ia-livro.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const corpo = (await lerCorpo(req)) || {};
  try {
    if (corpo.acao === 'explicar') {
      if (!String(corpo.trecho || '').trim()) return resposta(400, { ok: false, erro: 'Selecione um trecho.' });
      return resposta(200, { ok: true, ...(await explicarTrecho(corpo)) });
    }
    if (corpo.acao === 'resumir') {
      if (String(corpo.texto || '').trim().length < 200) return resposta(400, { ok: false, erro: 'Este capítulo é curto demais para resumir.' });
      return resposta(200, { ok: true, ...(await resumirCapitulo(corpo)) });
    }
    return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('livro-ia:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não consegui falar com a IA agora. Tente de novo.' });
  }
};
