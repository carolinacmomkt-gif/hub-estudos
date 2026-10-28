// "Pergunte à Bússola" (só quando a Carol toca em "Perguntar"). Corpo: { contexto }, montado no
// app (js/dados-busca.js, contextoDaPergunta) só com o que importa para a pergunta.

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { responderPergunta } from '../lib/ia-perguntar.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

const LIMITE = 60000; // caracteres do resumo (para a pergunta não ficar cara nem lenta)

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const { contexto } = (await lerCorpo(req)) || {};
  if (!contexto?.pergunta || !contexto?.hoje) return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  if (JSON.stringify(contexto).length > LIMITE) return resposta(400, { ok: false, erro: 'A pergunta trouxe dados demais. Tente algo mais específico.' });
  try {
    return resposta(200, { ok: true, ...(await responderPergunta(contexto)) });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('perguntar:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não consegui falar com a IA agora. A busca acima continua funcionando sem internet.' });
  }
};
