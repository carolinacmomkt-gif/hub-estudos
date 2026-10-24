// Teste de conexão com o Lyceum (portal do aluno da UniEVANGÉLICA).
//
// Faz UM login com matrícula e senha (do mesmo jeito que o portal), descobre os
// códigos de pessoa e de aluno e testa as rotas de notas, faltas, agenda e avisos.
// Devolve só a ESTRUTURA das respostas (nomes e tipos dos campos), nunca os valores.
// A senha e a sessão não saem desta função e não são guardadas.
//
// Variáveis de ambiente: HUB_CODIGO_ACESSO e, opcional, LYCEUM_BASE_URL.

import { timingSafeEqual } from 'node:crypto';

const BASE_PADRAO = 'https://portal.unievangelica.edu.br/aluno';
const TEMPO_LIMITE_MS = 4500;
const AGENTE = 'Mozilla/5.0 (compatible; HubDeEstudos/1.0)';

// {p} = código da pessoa, {a} = código do aluno
const ROTAS = [
  { id: 'boletim', descricao: 'Boletim (notas e faltas)', caminho: '/pessoas/{p}/alunos/{a}/boletim' },
  { id: 'disciplinasBoletim', descricao: 'Disciplinas do boletim', caminho: '/pessoas/{p}/alunos/{a}/disciplinasBoletim' },
  { id: 'ultimasNotas', descricao: 'Últimas notas', caminho: '/pessoas/{p}/alunos/{a}/qtddNotas/5/ultimasNotas' },
  { id: 'subPeriodos', descricao: 'Períodos do boletim (N1, N2…)', caminho: '/pessoas/alunos/{a}/listaSubPeriodos' },
  { id: 'frequencias', descricao: 'Frequência', caminho: '/api/rest/alunos/codAluno/{a}/codPessoa/{p}/Frequencias' },
  { id: 'disciplinasMatriculadas', descricao: 'Disciplinas matriculadas', caminho: '/matricula/codAluno/{a}/obterDisciplinasMatriculadas' },
  { id: 'dadosAcademicos', descricao: 'Dados acadêmicos (curso, período)', caminho: '/pessoas/codAluno/{a}/obterDadosAcademicos' },
  { id: 'eventos', descricao: 'Agenda (eventos)', caminho: '/api/rest/alunos/pessoa/{p}/events' },
  { id: 'agendaDiario', descricao: 'Agenda do diário', caminho: '/matricula/listar-agenda-diario?codAluno={a}' },
  { id: 'avisos', descricao: 'Avisos', caminho: '/pessoas/{p}/alunos/{a}/avisos' },
  { id: 'ultimasAtividades', descricao: 'Últimas atividades', caminho: '/pessoas/cod_pessoa/{p}/cod_aluno/{a}/lista_ultimas_atividades' },
];

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function codigoConfere(recebido, esperado) {
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Guarda os cookies da sessão só em memória, durante esta execução.
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
    cabecalho() {
      return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    ler(nome) {
      return cookies.get(nome);
    },
  };
}

function lerUserData(valor) {
  if (!valor) return null;
  try {
    const texto = Buffer.from(decodeURIComponent(valor), 'base64').toString('utf8');
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

// Descreve a forma de um JSON (nomes e tipos), sem nenhum valor.
function tipoDe(v) {
  if (Array.isArray(v)) return 'lista';
  if (v === null) return 'vazio';
  return { string: 'texto', number: 'número', boolean: 'sim/não', object: 'objeto' }[typeof v] || typeof v;
}

function estrutura(v, profundidade = 0) {
  if (Array.isArray(v)) {
    const primeiro = v.find((x) => x && typeof x === 'object');
    return { tipo: 'lista', itens: v.length, ...(primeiro && profundidade < 2 ? { item: estrutura(primeiro, profundidade + 1) } : {}) };
  }
  if (v && typeof v === 'object') {
    const campos = {};
    for (const [k, x] of Object.entries(v).slice(0, 60)) {
      campos[k] = (x && typeof x === 'object' && profundidade < 2) ? estrutura(x, profundidade + 1) : tipoDe(x);
    }
    return { tipo: 'objeto', campos };
  }
  return { tipo: tipoDe(v) };
}

// Procura o código do aluno na resposta de /pessoas/{p}/alunos.
function acharCodigoAluno(dados) {
  const lista = Array.isArray(dados) ? dados : (dados && typeof dados === 'object' ? Object.values(dados).find(Array.isArray) : null);
  const item = lista?.find((x) => x && typeof x === 'object') ?? (dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : null);
  if (!item) return null;
  for (const chave of ['codAluno', 'cod_aluno', 'aluno', 'codigoAluno', 'id']) {
    if (item[chave] !== undefined && item[chave] !== null && typeof item[chave] !== 'object') return String(item[chave]);
  }
  return null;
}

function descreverErro(dados) {
  if (!dados || typeof dados !== 'object') return null;
  const saida = { campos: Object.keys(dados).slice(0, 20) };
  for (const chave of ['message', 'mensagem', 'error', 'erro', 'error_description', 'detail', 'status']) {
    if (typeof dados[chave] === 'string' || typeof dados[chave] === 'number') saida[chave] = String(dados[chave]).slice(0, 200);
  }
  return saida;
}

const PREFIXOS = [
  '/aluno', '/aluno/api', '/aluno/rest', '/aluno/services', '/aluno/service', '/aluno/ws', '/aluno/backend',
  '/aluno/app', '/aluno/lyceum', '/api', '/rest', '/services', '/lyceum', '/portal', '/aluno-api', '',
];

// Testa em que prefixo a rota /pessoas/{p}/alunos existe (404 = não existe ali).
async function testarPrefixos(origem, codPessoa, usuario, pedir) {
  return Promise.all(PREFIXOS.map(async (prefixo) => {
    try {
      const r = await pedir(`${origem}${prefixo}/pessoas/${encodeURIComponent(codPessoa)}/alunos`, {
        headers: { 'X-Lyceum-Usuario': usuario },
      });
      const tipo = r.headers.get('content-type') || '';
      await r.arrayBuffer();
      return { prefixo, status: r.status, json: tipo.includes('json') };
    } catch {
      return { prefixo, status: 'erro', json: false };
    }
  }));
}

// Lê o código público do portal (sem dados da Carol) e devolve os trechos onde
// ele monta os endereços da API, para descobrir o prefixo certo.
async function lerTrechosDoCodigo(html, base, pedir) {
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => new URL(m[1], `${base}/`).href)
    .filter((u) => /\/_app\/app-[^/]*\.js/i.test(u) || /\/_app\/[^/]*config[^/]*\.js/i.test(u));
  const agulhas = ['getApiServer=', 'getApiServer:', 'X-Lyceum-Usuario', 'perfil=', 'perfil:', 'Authorization', 'Bearer', 'withCredentials', 'SessionData.user='];
  const trechos = [];
  for (const url of srcs.slice(0, 3)) {
    try {
      const r = await pedir(url);
      const texto = await r.text();
      for (const agulha of agulhas) {
        let i = texto.indexOf(agulha);
        let vezes = 0;
        while (i >= 0 && vezes < 3) {
          trechos.push({ agulha, trecho: texto.slice(Math.max(0, i - 300), i + 300).replace(/\s+/g, ' ') });
          i = texto.indexOf(agulha, i + agulha.length);
          vezes += 1;
        }
      }
    } catch {
      // segue sem os trechos
    }
  }
  return trechos.slice(0, 30);
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const codigoEsperado = process.env.HUB_CODIGO_ACESSO;
  if (!codigoEsperado) return resposta(500, { ok: false, erro: 'Falta a variável HUB_CODIGO_ACESSO na Netlify.' });
  const base = (process.env.LYCEUM_BASE_URL || BASE_PADRAO).replace(/\/+$/, '');

  let entrada;
  try {
    entrada = await req.json();
  } catch {
    return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  }

  const matricula = typeof entrada?.matricula === 'string' ? entrada.matricula.trim() : '';
  let senha = typeof entrada?.senha === 'string' ? entrada.senha : '';
  if (!codigoConfere(entrada?.codigo ?? '', codigoEsperado)) {
    await new Promise((r) => setTimeout(r, 1000));
    return resposta(401, { ok: false, erro: 'Código de acesso incorreto.' });
  }
  if (!matricula || !senha || matricula.length > 50 || senha.length > 200) {
    return resposta(400, { ok: false, erro: 'Preencha a matrícula e a senha.' });
  }

  const potinho = criarPotinhoDeCookies();
  const etapas = [];
  const cabecalhosBase = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language-Portal': 'pt_br',
    'User-Agent': AGENTE,
    Origin: new URL(base).origin,
    Referer: `${base}/`,
  };

  const pedir = async (url, opcoes = {}) => {
    const resp = await fetch(url, {
      ...opcoes,
      headers: { ...cabecalhosBase, Cookie: potinho.cabecalho(), ...(opcoes.headers || {}) },
      redirect: 'manual',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    potinho.guardar(resp);
    return resp;
  };

  // 1. Abre o portal (o portal cria uma sessão antes do login)
  let htmlInicial = '';
  try {
    const r = await pedir(`${base}/`);
    htmlInicial = await r.text();
  } catch {
    // segue mesmo assim: o login às vezes funciona sem a sessão prévia
  }

  // 2. Login: exatamente uma tentativa
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
    return resposta(200, { ok: false, erro: demorou ? 'O Lyceum demorou demais para responder.' : 'Não foi possível falar com o Lyceum.' });
  } finally {
    senha = null; // não é mais necessária
  }

  if (login.status !== 200) {
    const texto = (await login.text().catch(() => '')).slice(0, 2000);
    const pediuCaptcha = /captcha/i.test(texto);
    const erro = pediuCaptcha
      ? 'O Lyceum pediu captcha. O app não tenta contornar: me avise para seguirmos pelo plano B.'
      : login.status === 401 ? 'Matrícula ou senha incorretas. Confira e tente de novo.' : `O Lyceum recusou o login (HTTP ${login.status}).`;
    etapas.push({ nome: 'Entrar no Lyceum', ok: false, detalhe: erro });
    return resposta(200, { ok: false, etapas, erro });
  }
  etapas.push({ nome: 'Entrar no Lyceum', ok: true, detalhe: `Login aceito (sem captcha). Cookies da sessão: ${potinho.ler('JSESSIONID') ? 'JSESSIONID' : 'nenhum JSESSIONID'}${potinho.ler('user-data') ? ', user-data' : ''}.` });

  // 3. Descobre os códigos da pessoa e do aluno
  const usuario = lerUserData(potinho.ler('user-data'));
  const codPessoa = usuario?.id ? String(usuario.id) : null;
  let codAluno = null;
  let origemAluno = 'não encontrado';
  // O portal manda o cabeçalho X-Lyceum-Usuario; não sabemos qual valor ele espera depois do login.
  // No código do portal o formato é `${perfil}: ${usuario}`.
  const identidades = [
    { rotulo: 'matrícula', valor: usuario?.login ? String(usuario.login) : null },
    { rotulo: 'código da pessoa', valor: codPessoa },
  ].filter((o) => o.valor);
  const perfis = ['ALUNO', 'Aluno', 'aluno', 'ROLE_USER'];
  const opcoesUsuario = [
    ...identidades.flatMap((id) => perfis.map((perfil) => ({ rotulo: `${perfil}: ${id.rotulo}`, valor: `${perfil}: ${id.valor}` }))),
    ...identidades,
    { rotulo: 'null', valor: 'null' },
  ];
  let cabecalhoUsuario = { 'X-Lyceum-Usuario': opcoesUsuario[0]?.valor ?? 'null' };

  // Descobre o prefixo da API: lê o código público e testa prefixos comuns.
  const origem = new URL(base).origin;
  const [trechos, testesPrefixo] = await Promise.all([
    lerTrechosDoCodigo(htmlInicial, base, pedir),
    codPessoa ? testarPrefixos(origem, codPessoa, opcoesUsuario[0]?.valor ?? 'null', pedir) : [],
  ]);
  const escolhido = testesPrefixo.find((t) => t.status === 200 && t.json) || testesPrefixo.find((t) => t.json && t.status !== 404);
  const prefixo = escolhido ? escolhido.prefixo : new URL(base).pathname.replace(/\/+$/, '');
  const raizApi = `${origem}${prefixo}`;
  etapas.push({
    nome: 'Descobrir o endereço da API',
    ok: Boolean(escolhido),
    detalhe: escolhido ? `Prefixo encontrado: ${prefixo || '(raiz)'} (HTTP ${escolhido.status}).` : 'Nenhum prefixo comum respondeu. Veja os trechos do código no resultado.',
  });

  let usuarioQueFuncionou = 'nenhum';
  let testesCabecalho = [];
  if (codPessoa) {
    testesCabecalho = await Promise.all(opcoesUsuario.map(async (opcao) => {
      try {
        const r = await pedir(`${raizApi}/pessoas/${encodeURIComponent(codPessoa)}/alunos`, { headers: { 'X-Lyceum-Usuario': opcao.valor } });
        const tipo = r.headers.get('content-type') || '';
        const texto = await r.text();
        let dados = null;
        if (tipo.includes('json')) {
          try { dados = JSON.parse(texto); } catch { /* ignora */ }
        }
        return { opcao, status: r.status, dados };
      } catch {
        return { opcao, status: 'erro', dados: null };
      }
    }));
    const certo = testesCabecalho.find((t) => t.status === 200);
    if (certo) {
      cabecalhoUsuario = { 'X-Lyceum-Usuario': certo.opcao.valor };
      usuarioQueFuncionou = certo.opcao.rotulo;
      codAluno = acharCodigoAluno(certo.dados);
      if (codAluno) origemAluno = 'lista de alunos da pessoa';
    }
  }
  // Só rótulo e status (os valores têm a matrícula e o código da pessoa).
  const resumoCabecalho = testesCabecalho.map((t) => ({ formato: t.opcao.rotulo, status: t.status }));
  const erro401 = testesCabecalho.find((t) => t.status === 401 && t.dados);
  const mensagem401 = erro401 ? descreverErro(erro401.dados) : null;
  if (!codAluno && usuario?.login) {
    codAluno = String(usuario.login);
    origemAluno = 'matrícula (reserva)';
  }

  etapas.push({
    nome: 'Descobrir os códigos',
    ok: Boolean(codPessoa && codAluno),
    detalhe: `Código da pessoa: ${codPessoa ? 'encontrado' : 'não encontrado'}. Código do aluno: ${origemAluno}. Cabeçalho X-Lyceum-Usuario aceito: ${usuarioQueFuncionou}.`,
  });
  if (!codPessoa || !codAluno) {
    return resposta(200, { ok: false, etapas, prefixos: testesPrefixo, cabecalhos: resumoCabecalho, mensagem401, trechos, erro: 'Entrou no Lyceum, mas não achei os seus códigos. Me mande este resultado.' });
  }

  // 4. Testa as rotas (todas juntas, para caber no tempo da Netlify)
  const rotas = await Promise.all(ROTAS.map(async (rota) => {
    const caminho = rota.caminho.replace('{p}', encodeURIComponent(codPessoa)).replace('{a}', encodeURIComponent(codAluno));
    try {
      const r = await pedir(`${raizApi}${caminho}`, { headers: cabecalhoUsuario });
      const tipo = r.headers.get('content-type') || '';
      const texto = await r.text();
      const item = { id: rota.id, descricao: rota.descricao, rota: rota.caminho, status: r.status, ok: r.ok };
      if (tipo.includes('json')) {
        try {
          const dados = JSON.parse(texto);
          if (r.ok) item.estrutura = estrutura(dados);
          else if (dados && typeof dados.message === 'string') item.mensagem = dados.message.slice(0, 160);
        } catch {
          item.observacao = 'JSON inválido';
        }
      } else {
        item.observacao = `Resposta em ${tipo || 'formato desconhecido'} (${texto.length} caracteres)`;
      }
      return item;
    } catch (erro) {
      const demorou = erro?.name === 'TimeoutError' || erro?.name === 'AbortError';
      return { id: rota.id, descricao: rota.descricao, rota: rota.caminho, status: 'erro', ok: false, observacao: demorou ? 'demorou demais' : 'falha de rede' };
    }
  }));

  const funcionaram = rotas.filter((r) => r.ok).length;
  return resposta(200, {
    ok: true,
    etapas,
    resumo: `${funcionaram} de ${rotas.length} rotas responderam.`,
    rotas,
    prefixos: testesPrefixo,
    cabecalhos: resumoCabecalho,
    mensagem401,
    trechos,
  });
};
