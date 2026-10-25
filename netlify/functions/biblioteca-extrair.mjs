// Biblioteca: tira o texto de um link para salvar e ler no app.
// Corpo: { url }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { extrairDeLink, ErroLink } from '../lib/extrair-link.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const { url } = (await lerCorpo(req)) || {};
  if (typeof url !== 'string' || url.length > 2000) return resposta(400, { ok: false, erro: 'Mande o link do artigo.' });
  try {
    // Só no simulador local os testes leem páginas de localhost.
    return resposta(200, { ok: true, artigo: await extrairDeLink(url, { permitirLocal: process.env.HUB_TESTE_LOCAL === '1' }) });
  } catch (falha) {
    if (falha instanceof ErroLink) return resposta(200, { ok: false, erro: falha.message });
    console.error('biblioteca-extrair:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não foi possível ler esse link agora. Cole o texto do artigo.' });
  }
};
