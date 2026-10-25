// Ajuda da IA no Hub do YouTube (só quando a Carol pede, pelo botão "Sugerir com IA").
// Corpo: { acao: 'titulos' | 'ganchos' | 'roteiro' | 'publicacao' | 'thumbs' | 'cortes', video: {...} }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { ajudaDaIa, ACOES_IA, ErroIaYoutube } from '../lib/ia-youtube.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const entrada = (await lerCorpo(req)) || {};
  if (!ACOES_IA.includes(entrada.acao) || typeof entrada.video !== 'object' || !entrada.video) {
    return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  }
  try {
    return resposta(200, { ok: true, resultado: await ajudaDaIa(entrada.acao, entrada.video) });
  } catch (falha) {
    if (falha instanceof ErroIaYoutube) return resposta(200, { ok: false, erro: falha.message });
    console.error('youtube-ia:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não foi possível falar com a IA agora. Tente de novo.' });
  }
};
