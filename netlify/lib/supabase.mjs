// Acesso ao Supabase a partir das funções (sem dependências: só fetch).
//
// - usuariaDaRequisicao: confere o login (token "Authorization: Bearer ..." enviado pelo app).
// - banco: lê e grava com a chave service_role, que passa por cima do RLS.
//   Por isso toda chamada aqui filtra pelo user_id da usuária logada.

import { resposta } from './http.mjs';

function configuracao() {
  let url = '';
  try {
    url = new URL(process.env.SUPABASE_URL || '').origin; // aceita o endereço com ou sem /rest/v1
  } catch {
    url = '';
  }
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

// Arquivos do Storage (bucket "arquivos"), também com a service_role.
async function pedirStorage(caminho, { metodo = 'GET' } = {}) {
  const cfg = configuracao();
  const r = await fetch(`${cfg.url}/storage/v1/object/arquivos/${caminho.split('/').map(encodeURIComponent).join('/')}`, {
    method: metodo,
    headers: {
      apikey: cfg.servico,
      ...(cfg.servico.startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.servico}` }),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Storage respondeu ${r.status}`);
  return r;
}

const filtroUsuaria = (userId, servico) =>
  `user_id=eq.${encodeURIComponent(userId)}&servico=eq.${encodeURIComponent(servico)}`;

// O arquivo precisa estar na pasta da usuária, sem "..", "." ou barras vazias no caminho.
function daUsuaria(userId, caminho) {
  const partes = String(caminho || '').split('/');
  return partes[0] === userId && partes.length > 1 && partes.every((p) => p && p !== '.' && p !== '..' && !p.includes('\\'));
}

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

  async lerConexao(userId, servico) {
    const linhas = await pedirRest(`conexoes?select=*&${filtroUsuaria(userId, servico)}`);
    return linhas?.[0] || null;
  },

  // Quem tem algum segredo guardado (usado pela sincronização agendada).
  async listarCredenciais() {
    return (await pedirRest('credenciais?select=user_id,servico')) || [];
  },

  // Linhas da usuária numa tabela (sem as excluídas). filtros: texto extra do PostgREST.
  async listar(tabela, userId, filtros = '') {
    return (await pedirRest(`${tabela}?select=*&user_id=eq.${encodeURIComponent(userId)}&excluido_em=is.null${filtros ? `&${filtros}` : ''}`)) || [];
  },

  async lerPorId(tabela, userId, id) {
    const linhas = await pedirRest(`${tabela}?select=*&user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(id)}`);
    return linhas?.[0] || null;
  },

  // Só arquivos dentro da pasta da usuária ("{user_id}/...").
  async baixarArquivo(userId, caminho) {
    if (!daUsuaria(userId, caminho)) throw new Error('Arquivo fora da pasta da usuária.');
    return Buffer.from(await (await pedirStorage(caminho)).arrayBuffer());
  },

  async apagarArquivo(userId, caminho) {
    if (!daUsuaria(userId, caminho)) return;
    await pedirStorage(caminho, { metodo: 'DELETE' });
  },

  // Tudo de uma tabela da usuária, inclusive o que está na lixeira (para o backup), em páginas.
  async listarTudo(tabela, userId) {
    const linhas = [];
    for (let desde = 0; desde < 200000; desde += 1000) {
      const pagina = (await pedirRest(`${tabela}?select=*&user_id=eq.${encodeURIComponent(userId)}&order=id&limit=1000&offset=${desde}`)) || [];
      linhas.push(...pagina);
      if (pagina.length < 1000) break;
    }
    return linhas;
  },

  // Quem usa o app (as funções agendadas passam por todas; na prática é só a Carol).
  async idsDasUsuarias() {
    return [...new Set(((await pedirRest('config?select=user_id')) || []).map((l) => l.user_id))];
  },

  // Grava um arquivo na pasta da usuária no Storage (substitui se já existir).
  async subirArquivo(userId, caminho, conteudo, tipo = 'application/octet-stream') {
    if (!daUsuaria(userId, caminho)) throw new Error('Arquivo fora da pasta da usuária.');
    const cfg = configuracao();
    const r = await fetch(`${cfg.url}/storage/v1/object/arquivos/${caminho.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: {
        apikey: cfg.servico,
        ...(cfg.servico.startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.servico}` }),
        'Content-Type': tipo,
        'x-upsert': 'true',
      },
      body: conteudo,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`Storage respondeu ${r.status}`);
  },

  // Arquivos de uma pasta da usuária: [{ name, created_at, metadata: { size } }].
  async listarArquivos(userId, pasta) {
    const cfg = configuracao();
    const r = await fetch(`${cfg.url}/storage/v1/object/list/arquivos`, {
      method: 'POST',
      headers: {
        apikey: cfg.servico,
        ...(cfg.servico.startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.servico}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: `${userId}/${pasta}`, limit: 200, offset: 0, sortBy: { column: 'name', order: 'desc' } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Storage respondeu ${r.status}`);
    return (await r.json()) || [];
  },

  // Leitura sem filtro de usuária (só para as funções agendadas, que passam por todas).
  async listarTodas(tabela, filtros = '') {
    return (await pedirRest(`${tabela}?select=*${filtros ? `&${filtros}` : ''}`)) || [];
  },

  async apagar(tabela, filtros) {
    if (!filtros) throw new Error('apagar precisa de filtros');
    await pedirRest(`${tabela}?${filtros}`, { metodo: 'DELETE', prefer: 'return=minimal' });
  },

  // Atualiza alguns campos de uma linha da usuária (sem precisar mandar os obrigatórios).
  async atualizarPorId(tabela, userId, id, campos) {
    await pedirRest(`${tabela}?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(id)}`, {
      metodo: 'PATCH',
      corpo: campos,
      prefer: 'return=minimal',
    });
  },

  // Atualiza só o campo status de linhas que vêm de fora (identificadas por origem + origem_id).
  async atualizarStatus(tabela, linhas) {
    const fila = [...linhas];
    const trabalhador = async () => {
      while (fila.length) {
        const l = fila.shift();
        await pedirRest(`${tabela}?user_id=eq.${encodeURIComponent(l.user_id)}&origem=eq.${encodeURIComponent(l.origem)}&origem_id=eq.${encodeURIComponent(l.origem_id)}`, {
          metodo: 'PATCH',
          corpo: { status: l.status },
          prefer: 'return=minimal',
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, fila.length) }, trabalhador));
  },

  // Grava em lote. conflito: colunas da chave única (ex.: "user_id,origem,origem_id").
  // Só as colunas enviadas mudam; as que o app edita (pesos, faltas_manuais…) ficam como estão.
  async gravar(tabela, linhas, conflito) {
    if (!linhas.length) return;
    // O envio em lote exige que todas as linhas tenham as mesmas colunas.
    const grupos = new Map();
    for (const linha of linhas) {
      const chave = Object.keys(linha).sort().join(',');
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(linha);
    }
    for (const grupo of grupos.values()) {
      for (let i = 0; i < grupo.length; i += 200) {
        await pedirRest(`${tabela}?on_conflict=${conflito}`, {
          metodo: 'POST',
          corpo: grupo.slice(i, i + 200),
          prefer: 'resolution=merge-duplicates,return=minimal',
        });
      }
    }
  },
};
