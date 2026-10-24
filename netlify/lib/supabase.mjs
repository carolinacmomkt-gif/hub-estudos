// Acesso ao Supabase a partir das funções (sem dependências: só fetch).
//
// - usuariaDaRequisicao: confere o login (token "Authorization: Bearer ..." enviado pelo app).
// - banco: lê e grava com a chave service_role, que passa por cima do RLS.
//   Por isso toda chamada aqui filtra pelo user_id da usuária logada.

import { resposta } from './http.mjs';

function configuracao() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !servico) {
    throw new Error('Faltam SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY na Netlify.');
  }
  return { url, anon, servico };
}

// Devolve { usuaria } ou { erro: Response } pronto para retornar.
export async function exigirLogin(req) {
  let cfg;
  try {
    cfg = configuracao();
  } catch (erro) {
    return { erro: resposta(500, { ok: false, erro: erro.message }) };
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { erro: resposta(401, { ok: false, erro: 'Entre no app de novo para continuar.' }) };

  try {
    const r = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { erro: resposta(401, { ok: false, erro: 'Sua sessão expirou. Entre no app de novo.' }) };
    const usuaria = await r.json();
    if (!usuaria?.id) return { erro: resposta(401, { ok: false, erro: 'Sessão inválida.' }) };
    return { usuaria };
  } catch {
    return { erro: resposta(502, { ok: false, erro: 'Não foi possível confirmar o login agora. Tente de novo.' }) };
  }
}

async function pedirRest(caminho, { metodo = 'GET', corpo, prefer } = {}) {
  const cfg = configuracao();
  const r = await fetch(`${cfg.url}/rest/v1/${caminho}`, {
    method: metodo,
    headers: {
      apikey: cfg.servico,
      // As chaves novas (sb_secret_...) vão só no apikey; as antigas (JWT) também no Authorization.
      ...(cfg.servico.startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.servico}` }),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    const detalhe = await r.text().catch(() => '');
    throw new Error(`Supabase respondeu ${r.status}: ${detalhe.slice(0, 200)}`);
  }
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

const filtroUsuaria = (userId, servico) =>
  `user_id=eq.${encodeURIComponent(userId)}&servico=eq.${encodeURIComponent(servico)}`;

export const banco = {
  async salvarCredencial(userId, servico, dadosCifrados) {
    await pedirRest('credenciais?on_conflict=user_id,servico', {
      metodo: 'POST',
      corpo: { user_id: userId, servico, dados_cifrados: dadosCifrados },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  },

  async lerCredencial(userId, servico) {
    const linhas = await pedirRest(`credenciais?select=dados_cifrados&${filtroUsuaria(userId, servico)}`);
    return linhas?.[0]?.dados_cifrados || null;
  },

  async apagarCredencial(userId, servico) {
    await pedirRest(`credenciais?${filtroUsuaria(userId, servico)}`, { metodo: 'DELETE', prefer: 'return=minimal' });
  },

  async salvarConexao(userId, servico, campos) {
    await pedirRest('conexoes?on_conflict=user_id,servico', {
      metodo: 'POST',
      corpo: { user_id: userId, servico, ...campos },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  },
};
