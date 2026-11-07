// Radar do nicho em segundo plano (Netlify Background Function): responde 202 na hora e grava o
// resultado em config "radar:<nicho>", que o app acompanha. Corpo: { nicho: { id, nome, palavras, clientes } }.
// Chamada pelo app (com login) ou pela radar-agendado (assinatura interna + { usuaria }).

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { montarRadar, conferirInterno } from '../lib/radar.mjs';

export default async (req) => {
  if (req.method !== 'POST') return;
  const corpo = (await lerCorpo(req)) || {};
  const { nicho } = corpo;
  if (!nicho || typeof nicho !== 'object') return;
  let userId = null;
  const interno = req.headers.get('x-bussola-interno');
  if (interno) {
    if (typeof corpo.usuaria === 'string' && conferirInterno(interno, corpo.usuaria, String(nicho.id || ''))) userId = corpo.usuaria;
  } else {
    const { usuaria, erro } = await exigirLogin(req);
    if (!erro) userId = usuaria.id;
  }
  if (!userId) return;
  await montarRadar(userId, nicho);
};
