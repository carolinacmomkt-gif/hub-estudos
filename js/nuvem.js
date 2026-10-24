// Conexão com o Supabase: login por código no e-mail e acesso ao banco (REST).
// Sem bibliotecas: só fetch, para o app abrir offline e continuar sem etapa de build.
//
// O endereço e a chave pública (anon) vêm da função config-publica e ficam guardados
// no aparelho. A sessão (tokens) também fica no aparelho, para abrir sem internet.

const URL_CONFIG = '/.netlify/functions/config-publica';
const CHAVE_CONFIG = 'hub.nuvem.config';
const CHAVE_SESSAO = 'hub.nuvem.sessao';

let config = lerGuardado(CHAVE_CONFIG);
let sessao = lerGuardado(CHAVE_SESSAO);
let renovando = null;

function lerGuardado(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave) || 'null');
  } catch {
    return null;
  }
}

function guardar(chave, valor) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export class ErroNuvem extends Error {
  constructor(mensagem, status = 0, codigo = '', detalhe = '') {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.detalhe = detalhe; // motivo técnico, para diagnóstico
  }
}

// Busca a configuração na Netlify; sem internet, usa a guardada.
export async function carregarConfig() {
  try {
    const r = await fetch(URL_CONFIG, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const dados = r.ok ? await r.json() : null;
    if (dados?.ok) {
      config = { supabaseUrl: dados.supabaseUrl, supabaseAnonKey: dados.supabaseAnonKey };
      guardar(CHAVE_CONFIG, config);
    }
  } catch {
    // offline ou rodando sem as funções: segue com o que estiver guardado
  }
  return config;
}

export function nuvemConfigurada() {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey);
}

export function sessaoAtual() {
  return sessao;
}

export function emailDaSessao() {
  return sessao?.user?.email || null;
}

function guardarSessao(dados) {
  sessao = {
    access_token: dados.access_token,
    refresh_token: dados.refresh_token,
    expires_at: dados.expires_at || Math.floor(Date.now() / 1000) + (dados.expires_in || 3600),
    user: { id: dados.user?.id ?? sessao?.user?.id, email: dados.user?.email ?? sessao?.user?.email },
  };
  guardar(CHAVE_SESSAO, sessao);
}

export function encerrarSessaoLocal() {
  sessao = null;
  guardar(CHAVE_SESSAO, null);
}

const MENSAGENS = {
  otp_expired: 'Código incorreto ou expirado. Peça um novo.',
  otp_disabled: 'Este e-mail não tem acesso ao Hub.',
  signup_disabled: 'Este e-mail não tem acesso ao Hub.',
  user_not_found: 'Este e-mail não tem acesso ao Hub.',
  over_email_send_rate_limit: 'Muitos códigos pedidos. Espere alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  email_address_invalid: 'Confira o e-mail digitado.',
  email_address_not_authorized: 'O Supabase gratuito só manda e-mail para quem é da equipe do projeto. Use o e-mail da sua conta do Supabase ou configure um envio de e-mail próprio (SMTP).',
  validation_failed: 'Confira o e-mail digitado.',
};

async function pedirAuth(caminho, corpo, token) {
  if (!nuvemConfigurada()) throw new ErroNuvem('O Supabase ainda não foi configurado.');
  let r;
  try {
    r = await fetch(`${config.supabaseUrl}/auth/v1/${caminho}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(corpo || {}),
    });
  } catch {
    throw new ErroNuvem('Sem conexão com a internet.', 0, 'rede');
  }
  const texto = await r.text();
  let dados = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    // resposta vazia
  }
  if (!r.ok) {
    const codigo = dados.error_code || dados.code || dados.error || '';
    const bruto = String(dados.msg || dados.error_description || dados.message || '');
    let mensagem = MENSAGENS[codigo];
    if (!mensagem && /signups not allowed|not found/i.test(bruto)) mensagem = MENSAGENS.signup_disabled;
    if (!mensagem && /expired|invalid/i.test(bruto) && caminho === 'verify') mensagem = MENSAGENS.otp_expired;
    if (!mensagem && /not authorized/i.test(bruto)) mensagem = MENSAGENS.email_address_not_authorized;
    if (!mensagem && /sending|smtp|email/i.test(bruto)) mensagem = 'O Supabase não conseguiu enviar o e-mail com o código.';
    const detalhe = `HTTP ${r.status}${codigo ? ` · ${codigo}` : ''}${bruto ? ` · ${bruto.slice(0, 160)}` : ''}`;
    throw new ErroNuvem(mensagem || 'Não deu certo agora. Tente de novo em instantes.', r.status, codigo, detalhe);
  }
  return dados;
}

export async function enviarCodigo(email) {
  await pedirAuth('otp', { email, create_user: false });
}

export async function confirmarCodigo(email, codigo) {
  const dados = await pedirAuth('verify', { type: 'email', email, token: codigo });
  if (!dados.access_token) throw new ErroNuvem(MENSAGENS.otp_expired);
  guardarSessao(dados);
  return sessao;
}

async function renovarSessao() {
  if (!renovando) {
    renovando = pedirAuth('token?grant_type=refresh_token', { refresh_token: sessao.refresh_token })
      .then(guardarSessao)
      .catch((erro) => {
        // Refresh recusado = sessão acabou de verdade. Falta de internet não encerra nada.
        if (erro.status >= 400 && erro.status < 500) {
          encerrarSessaoLocal();
          window.dispatchEvent(new CustomEvent('hub:sessao-expirada'));
        }
        throw erro;
      })
      .finally(() => {
        renovando = null;
      });
  }
  return renovando;
}

// Token válido para chamar o Supabase ou as funções (renova se faltar menos de 1 minuto).
export async function tokenDeAcesso() {
  if (!sessao) return null;
  if (sessao.expires_at * 1000 - Date.now() < 60 * 1000) {
    try {
      await renovarSessao();
    } catch {
      if (!sessao) return null;
    }
  }
  return sessao?.access_token || null;
}

export async function sair() {
  const token = sessao?.access_token;
  encerrarSessaoLocal();
  if (token) {
    try {
      await pedirAuth('logout', {}, token);
    } catch {
      // a sessão local já foi encerrada
    }
  }
}

// Acesso ao banco (PostgREST). caminho: "tabela?filtros".
export async function rest(caminho, { metodo = 'GET', corpo, prefer } = {}) {
  const token = await tokenDeAcesso();
  if (!token) throw new ErroNuvem('Entre no app para sincronizar.', 401, 'sem_sessao');
  const executar = (bearer) => fetch(`${config.supabaseUrl}/rest/v1/${caminho}`, {
    method: metodo,
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  let r;
  try {
    r = await executar(token);
    if (r.status === 401 && sessao) {
      await renovarSessao();
      r = await executar(sessao.access_token);
    }
  } catch (erro) {
    if (erro instanceof ErroNuvem) throw erro;
    throw new ErroNuvem('Sem conexão com a internet.', 0, 'rede');
  }
  const texto = await r.text();
  if (!r.ok) {
    let mensagem = texto.slice(0, 200);
    try {
      mensagem = JSON.parse(texto).message || mensagem;
    } catch {
      // texto puro
    }
    throw new ErroNuvem(`O Supabase recusou (${r.status}): ${mensagem}`, r.status);
  }
  return texto ? JSON.parse(texto) : null;
}
