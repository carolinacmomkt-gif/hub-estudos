// IA dos Cadernos. Corpo: { acao: 'texto' | 'ortografia', imagem: 'data:image/png;base64,...' }
// Só roda quando a Carol pede, com a imagem da seleção do laço.

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { converterEmTexto, verificarOrtografia } from '../lib/ia-caderno.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const corpo = (await lerCorpo(req)) || {};
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(corpo.imagem || ''));
  if (!m) return resposta(400, { ok: false, erro: 'Selecione a escrita com o laço.' });
  if (m[2].length > 5_500_000) return resposta(400, { ok: false, erro: 'A seleção ficou grande demais. Selecione um trecho menor.' });
  const img = { tipo: m[1], base64: m[2] };
  try {
    if (corpo.acao === 'texto') return resposta(200, { ok: true, ...(await converterEmTexto(img)) });
    if (corpo.acao === 'ortografia') return resposta(200, { ok: true, ...(await verificarOrtografia(img)) });
    return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('caderno-ia:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não consegui falar com a IA agora. Tente de novo.' });
  }
};
