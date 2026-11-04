// IA do Foco acompanhado. Corpo: { acao: 'dividir' | 'destravar', titulo, minutos?, passo?, feitos? }
// Só roda quando a Carol pede. O foco funciona inteiro sem ela.

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { dividirEmPassos, destravar } from '../lib/ia-foco.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const corpo = (await lerCorpo(req)) || {};
  const titulo = String(corpo.titulo || '').trim();
  if (!titulo) return resposta(400, { ok: false, erro: 'Escreva o que você vai fazer.' });
  try {
    if (corpo.acao === 'dividir') return resposta(200, { ok: true, ...(await dividirEmPassos({ titulo, minutos: corpo.minutos })) });
    if (corpo.acao === 'destravar') {
      const feitos = Array.isArray(corpo.feitos) ? corpo.feitos.map(String) : [];
      return resposta(200, { ok: true, ...(await destravar({ titulo, passo: String(corpo.passo || ''), feitos })) });
    }
    return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('foco-ia:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não consegui falar com a IA agora. Tente de novo.' });
  }
};
