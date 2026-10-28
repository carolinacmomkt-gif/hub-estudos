// "Planejar meu dia" (só quando a Carol toca no botão). Corpo: { entrada, prefs, agoraMin }.
// A entrada é o resumo do dia que o app monta (js/dados-dia.js, entradaDoDia).

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { planejarComIa } from '../lib/ia-dia.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const { entrada, prefs, agoraMin } = (await lerCorpo(req)) || {};
  if (!entrada || !Array.isArray(entrada.tarefas) || !Array.isArray(entrada.compromissos) || !Number.isFinite(agoraMin)) {
    return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  }
  try {
    return resposta(200, { ok: true, ...(await planejarComIa(entrada, prefs, Math.max(0, Math.min(1439, agoraMin)))) });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('planejar-dia:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não foi possível falar com a IA agora. Use "Planejar sem IA" ou tente de novo.' });
  }
};
