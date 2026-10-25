// Questões, modo fixação: a IA corrige a resposta dissertativa (nota de 0 a 10 e comentário).
// Corpo: { enunciado, esperada, resposta }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { corrigirResposta, ErroIa } from '../lib/ia-questoes.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const e = (await lerCorpo(req)) || {};
  if (!e.enunciado || !e.resposta) return resposta(400, { ok: false, erro: 'Escreva a sua resposta antes de pedir a correção.' });
  try {
    return resposta(200, { ok: true, correcao: await corrigirResposta(e) });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('questoes-corrigir:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não foi possível corrigir agora. Tente de novo.' });
  }
};
