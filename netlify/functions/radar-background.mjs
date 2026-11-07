// Radar do nicho em segundo plano (Netlify Background Function): responde 202 na hora e grava o
// resultado em config "radar:<nicho>", que o app acompanha. Corpo: { nicho: { id, nome, palavras, clientes } }.
// Só quando a Carol pede (ou ao abrir o Radar com o da semana velho).

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { montarRadar } from '../lib/radar.mjs';

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { nicho } = (await lerCorpo(req)) || {};
  if (!nicho || typeof nicho !== 'object') return;
  await montarRadar(usuaria.id, nicho);
};
