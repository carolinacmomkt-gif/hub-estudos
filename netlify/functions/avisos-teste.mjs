// Manda um aviso de teste para os aparelhos da Carol (botão em Configurações).

import { resposta } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { enviarPush, ErroPush } from '../lib/avisos.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;

  const assinaturas = await banco.listar('assinaturas_push', usuaria.id);
  if (!assinaturas.length) return resposta(200, { ok: false, erro: 'Nenhum aparelho com avisos ativados.' });
  const aviso = { titulo: 'Avisos ligados', texto: 'É assim que os prazos vão chegar neste aparelho.', tag: 'teste', url: '/#configuracoes' };
  let entregues = 0;
  try {
    for (const a of assinaturas) {
      const r = await enviarPush(a, aviso);
      if (r === 'ok') entregues += 1;
      if (r === 'expirada') await banco.apagar('assinaturas_push', `user_id=eq.${usuaria.id}&id=eq.${a.id}`);
    }
  } catch (falha) {
    if (falha instanceof ErroPush) return resposta(200, { ok: false, erro: falha.message });
    throw falha;
  }
  if (!entregues) return resposta(200, { ok: false, erro: 'O aviso não chegou a nenhum aparelho. Desative e ative de novo neste aparelho.' });
  return resposta(200, { ok: true, aparelhos: entregues });
};
