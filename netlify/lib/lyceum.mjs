// Conversa com o portal do aluno do Lyceum (UniEVANGÉLICA), somente leitura.
//
// Caminho confirmado no teste de 24/10/2026, igual ao do próprio portal:
//   1. POST /aluno/auth com matrícula e senha (base64) e captcha vazio;
//   2. código da pessoa = "id" do cookie user-data;
//   3. GET /aluno/apix/pessoas/{pessoa}/alunos (X-Lyceum-Usuario: null) → código do aluno;
//   4. demais pedidos com X-Lyceum-Usuario "aluno: {códigoDoAluno}".
// Nunca tenta contornar captcha: se o portal pedir, para e avisa.

const BASE_PADRAO = 'https://portal.unievangelica.edu.br/aluno';
const TEMPO_LIMITE_MS = 4500;
const AGENTE = 'Mozilla/5.0 (compatible; HubDeEstudos/1.0)';

// Rotas usadas na sincronização (base /aluno/apix). {p} = pessoa, {a} = aluno.
export const ROTAS_LYCEUM = {
  boletim: '/pessoas/{p}/alunos/{a}/boletim',
  disciplinasBoletim: '/pessoas/{p}/alunos/{a}/disciplinasBoletim',
  ultimasNotas: '/pessoas/{p}/alunos/{a}/qtddNotas/5/ultimasNotas',
  frequencias: '/api/rest/alunos/codAluno/{a}/codPessoa/{p}/Frequencias?page=0&size=1000',
  dadosAcademicos: '/pessoas/codAluno/{a}/obterDadosAcademicos',
  avisos: '/pessoas/{p}/alunos/{a}/avisos',
};

function baseLyceum() {
  return (process.env.LYCEUM_BASE_URL || BASE_PADRAO).replace(/\/+$/, '');
}

function criarPotinhoDeCookies() {
  const cookies = new Map();
  return {
    guardar(resp) {
      const lista = typeof resp.headers.getSetCookie === 'function' ? resp.headers.getSetCookie() : [];
      for (const linha of lista) {
        const [par] = linha.split(';');
        const i = par.indexOf('=');
        if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
      }
    },
    cabecalho: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    ler: (nome) => cookies.get(nome),
  };
}

function lerUserData(valor) {
  if (!valor) return null;
  try {
    return JSON.parse(Buffer.from(decodeURIComponent(valor), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function acharCodigoAluno(dados) {
  const lista = Array.isArray(dados) ? dados : (dados && typeof dados === 'object' ? Object.values(dados).find(Array.isArray) : null);
  const item = lista?.find((x) => x && typeof x === 'object') ?? (dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : null);
  for (const chave of ['codAluno', 'cod_aluno', 'aluno', 'codigoAluno']) {
    if (item && item[chave] != null && typeof item[chave] !== 'object') return String(item[chave]);
  }
  return null;
}

// Faz UM login e devolve uma sessão pronta para ler dados, ou { ok: false, erro, motivo }.
export async function entrarNoLyceum(matricula, senha) {
  const base = baseLyceum();
  const origem = new URL(base).origin;
  const potinho = criarPotinhoDeCookies();

  const pedir = async (url, opcoes = {}) => {
    const resp = await fetch(url, {
      ...opcoes,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language-Portal': 'pt_br',
        'User-Agent': AGENTE,
        Origin: origem,
        Referer: `${base}/`,
        Cookie: potinho.cabecalho(),
        ...(opcoes.headers || {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    potinho.guardar(resp);
    return resp;
  };

  try {
    await (await pedir(`${base}/`)).arrayBuffer(); // o portal cria uma sessão antes do login
  } catch {
    // segue mesmo assim
  }

  let login;
  try {
    login = await pedir(`${base}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Lyceum-Transacao': `${base}/#/login`,
        'X-Lyceum-Usuario': 'null',
      },
      body: new URLSearchParams({
        username: matricula,
        password: Buffer.from(senha, 'utf8').toString('base64'),
        recaptchaResponse: '',
      }).toString(),
    });
  } catch (erro) {
    const demorou = erro?.name === 'TimeoutError' || erro?.name === 'AbortError';
    return { ok: false, motivo: 'rede', erro: demorou ? 'O Lyceum demorou demais para responder.' : 'Não foi possível falar com o Lyceum.' };
  }

  if (login.status !== 200) {
    const corpo = (await login.text().catch(() => '')).slice(0, 2000);
    if (/captcha/i.test(corpo)) {
      return { ok: false, motivo: 'captcha', erro: 'O Lyceum passou a pedir captcha. O app não tenta contornar: entre no portal pelo navegador e me avise.' };
    }
    if (login.status === 401) return { ok: false, motivo: 'senha', erro: 'Matrícula ou senha do Lyceum incorretas.' };
    return { ok: false, motivo: 'recusado', erro: `O Lyceum recusou o login (HTTP ${login.status}).` };
  }

  const usuario = lerUserData(potinho.ler('user-data'));
  const codPessoa = usuario?.id ? String(usuario.id) : null;
  if (!codPessoa) return { ok: false, motivo: 'codigos', erro: 'Entrou no Lyceum, mas não achei o código da pessoa.' };

  const apix = `${base}/apix`;
  const transacao = `${base}/#/home/avisos`;
  let codAluno = null;
  try {
    const r = await pedir(`${apix}/pessoas/${encodeURIComponent(codPessoa)}/alunos`, {
      headers: { 'X-Lyceum-Transacao': transacao, 'X-Lyceum-Usuario': 'null' },
    });
    if (r.ok) codAluno = acharCodigoAluno(await r.json());
  } catch {
    // tratado abaixo
  }
  if (!codAluno) return { ok: false, motivo: 'codigos', erro: 'Entrou no Lyceum, mas não achei o código do aluno.' };

  const identificacao = { 'X-Lyceum-Transacao': transacao, 'X-Lyceum-Usuario': `aluno: ${codAluno}` };

  // Lê uma rota da lista ROTAS_LYCEUM e devolve o JSON (ou lança erro).
  const ler = async (nomeRota) => {
    const caminho = ROTAS_LYCEUM[nomeRota]
      .replace('{p}', encodeURIComponent(codPessoa))
      .replace('{a}', encodeURIComponent(codAluno));
    const r = await pedir(`${apix}${caminho}`, { headers: identificacao });
    if (!r.ok) throw new Error(`Lyceum: ${nomeRota} respondeu HTTP ${r.status}`);
    return r.json();
  };

  return { ok: true, ler };
}
