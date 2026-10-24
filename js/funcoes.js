// Chama as Netlify Functions do app, sempre com o login (token do Supabase).
// O navegador nunca fala direto com o AVA nem com o Lyceum.

import { tokenDeAcesso } from './nuvem.js';

export async function chamar(nome, corpo) {
  if (!navigator.onLine) return { ok: false, erro: 'Sem internet agora. Isso precisa de conexão.' };
  const token = await tokenDeAcesso();
  if (!token) return { ok: false, erro: 'Entre no app de novo para continuar.' };

  let resp;
  try {
    resp = await fetch(`/.netlify/functions/${nome}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo || {}),
    });
  } catch {
    return { ok: false, erro: 'Não foi possível chegar à função do app. Confira a internet e tente de novo.' };
  }
  if (resp.status === 404) {
    return { ok: false, erro: 'A função não foi encontrada. Ela só roda no site publicado na Netlify (ou com "netlify dev").' };
  }
  try {
    return await resp.json();
  } catch {
    return { ok: false, erro: `Resposta inesperada da função (HTTP ${resp.status}).` };
  }
}

export const conectarAva = (matricula, senha) => chamar('ava-conectar', { matricula, senha });
export const conectarLyceum = (matricula, senha) => chamar('lyceum-conectar', { matricula, senha });
export const desconectar = (servico) => chamar('desconectar', { servico });
export const sincronizarServico = (corpo) => chamar('sincronizar', corpo);
