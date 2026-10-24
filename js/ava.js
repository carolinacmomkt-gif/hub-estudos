// Conversa com as Netlify Functions do AVA. O navegador nunca fala direto com o AVA.

const URL_CONECTAR = '/.netlify/functions/ava-conectar';

export async function testarConexaoAva({ matricula, senha, codigo }) {
  if (!navigator.onLine) {
    return { ok: false, erro: 'Sem internet agora. O teste precisa de conexão.' };
  }

  let resp;
  try {
    resp = await fetch(URL_CONECTAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula, senha, codigo }),
    });
  } catch {
    return { ok: false, erro: 'Não foi possível chegar à função do app. Confira a internet e tente de novo.' };
  }

  if (resp.status === 404) {
    return {
      ok: false,
      erro: 'A função do AVA não foi encontrada. Ela só roda no site publicado na Netlify (ou com "netlify dev" no computador).',
    };
  }

  try {
    return await resp.json();
  } catch {
    return { ok: false, erro: `Resposta inesperada da função (HTTP ${resp.status}).` };
  }
}
