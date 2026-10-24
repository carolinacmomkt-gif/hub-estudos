// Entrega ao app o endereço do Supabase e a chave pública (anon).
// A chave anon é pública por natureza (o RLS protege os dados), mas fica na Netlify
// para nada de configuração ir para o repositório.

import { resposta } from '../lib/http.mjs';

export default async () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anon) return resposta(200, { ok: false, erro: 'O Supabase ainda não foi configurado na Netlify.' });
  return resposta(200, { ok: true, supabaseUrl: url, supabaseAnonKey: anon });
};
