// Entrega ao app o endereço do Supabase e a chave pública (anon).
// A chave anon é pública por natureza (o RLS protege os dados), mas fica na Netlify
// para nada de configuração ir para o repositório.

import { resposta } from '../lib/http.mjs';

export default async () => {
  // Usa só a origem (https://xxxx.supabase.co): a página "Data API" do Supabase mostra o
  // endereço com /rest/v1 no fim, e com ele os pedidos de login iriam para o lugar errado.
  let url = '';
  try {
    url = new URL(process.env.SUPABASE_URL || '').origin;
  } catch {
    url = '';
  }
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anon) return resposta(200, { ok: false, erro: 'O Supabase ainda não foi configurado na Netlify.' });
  const avaBaseUrl = (process.env.AVA_BASE_URL || '').replace(/\/+$/, '') || null; // para os links "Abrir no AVA"
  return resposta(200, { ok: true, supabaseUrl: url, supabaseAnonKey: anon, avaBaseUrl });
};
