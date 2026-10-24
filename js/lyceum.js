// Conversa com as Netlify Functions do Lyceum. O navegador nunca fala direto com o portal.

const URL_TESTE = '/.netlify/functions/lyceum-teste';

export async function testarConexaoLyceum({ matricula, senha, codigo }) {
  if (!navigator.onLine) return { ok: false, erro: 'Sem internet agora. O teste precisa de conexão.' };

  let resp;
  try {
    resp = await fetch(URL_TESTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula, senha, codigo }),
    });
  } catch {
    return { ok: false, erro: 'Não foi possível chegar à função do app. Confira a internet e tente de novo.' };
  }

  if (resp.status === 404) {
    return { ok: false, erro: 'A função do Lyceum não foi encontrada. Ela só roda no site publicado na Netlify.' };
  }

  try {
    return await resp.json();
  } catch {
    return { ok: false, erro: `Resposta inesperada da função (HTTP ${resp.status}).` };
  }
}
