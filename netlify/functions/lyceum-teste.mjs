// Teste de conexão com o Lyceum (portal do aluno da UniEVANGÉLICA).
//
// Repete o caminho do próprio portal:
//   1. POST /aluno/auth com matrícula e senha (base64), captcha vazio;
//   2. lê o cookie user-data para achar o código da pessoa;
//   3. GET apix/pessoas/{pessoa}/alunos (ainda sem identificação) para achar o código do aluno;
//   4. daí em diante manda X-Lyceum-Usuario no formato "perfil: códigoDoAluno".
// Os endereços do portal são relativos a /aluno/ ("apix" vem de Configs.getApiServer()).
//
// Devolve só a ESTRUTURA das respostas (nomes e tipos dos campos), nunca os valores.
// A senha e a sessão não saem desta função e não são guardadas.
//
// Variáveis de ambiente: HUB_CODIGO_ACESSO e, opcional, LYCEUM_BASE_URL.

import { timingSafeEqual } from 'node:crypto';

const BASE_PADRAO = 'https://portal.unievangelica.edu.br/aluno';
const TEMPO_LIMITE_MS = 4500;
const AGENTE = 'Mozilla/5.0 (compatible; HubDeEstudos/1.0)';
const PERFIS = ['aluno', 'ALUNO', 'Aluno'];

// {p} = código da pessoa, {a} = código do aluno.
// "apix": rotas montadas com Configs.getApiServer() (= "apix").
// "apiUrl": rotas montadas com ${API_URL}, trocado por AppCfg.getApiServer() (ainda não sabemos o valor).
const ROTAS = [
  { id: 'boletim', base: 'apix', descricao: 'Boletim (notas e faltas)', caminho: '/pessoas/{p}/alunos/{a}/boletim' },
  { id: 'subPeriodos', base: 'apix', descricao: 'Períodos do boletim (N1, N2…)', caminho: '/pessoas/alunos/{a}/listaSubPeriodos' },
  { id: 'disciplinasBoletim', base: 'apix', descricao: 'Disciplinas do boletim', caminho: '/pessoas/{p}/alunos/{a}/disciplinasBoletim' },
  { id: 'ultimasNotas', base: 'apix', descricao: 'Últimas notas', caminho: '/pessoas/{p}/alunos/{a}/qtddNotas/5/ultimasNotas' },
  { id: 'dadosAcademicos', base: 'apix', descricao: 'Dados acadêmicos (curso, período)', caminho: '/pessoas/codAluno/{a}/obterDadosAcademicos' },
  { id: 'avisos', base: 'apix', descricao: 'Avisos', caminho: '/pessoas/{p}/alunos/{a}/avisos' },
  { id: 'ultimasAtividades', base: 'apix', descricao: 'Últimas atividades', caminho: '/pessoas/cod_pessoa/{p}/cod_aluno/{a}/lista_ultimas_atividades' },
  { id: 'agendaDiario', base: 'apix', descricao: 'Agenda do diário', caminho: '/matricula/listar-agenda-diario' },
  { id: 'frequencias', base: 'apiUrl', descricao: 'Frequência', caminho: '/api/rest/alunos/codAluno/{a}/codPessoa/{p}/Frequencias?page=0&size=1000' },
  { id: 'boletins', base: 'apiUrl', descricao: 'Boletins (outro caminho)', caminho: '/api/rest/alunos/{a}/pessoa/{p}/boletins' },
  { id: 'disciplinasBoletimRest', base: 'apiUrl', descricao: 'Disciplinas do boletim (outro caminho)', caminho: '/api/rest/alunos/{a}/pessoa/{p}/disciplinasBoletim?page=0&size=1000' },
  { id: 'eventos', base: 'apiUrl', descricao: 'Agenda (eventos)', caminho: '/api/rest/alunos/pessoa/{p}/events' },
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
    return JSON.parse(Buffer.from(decodeURIComponent(valor), 'base64').toString('utf8'));
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
    return { tipo: 'lista', itens: v.length, ...(primeiro && profundidade < 3 ? { item: estrutura(primeiro, profundidade + 1) } : {}) };
  }
  if (v && typeof v === 'object') {
    const campos = {};
    for (const [k, x] of Object.entries(v).slice(0, 60)) {
      campos[k] = (x && typeof x === 'object' && profundidade < 3) ? estrutura(x, profundidade + 1) : tipoDe(x);
    }
    return { tipo: 'objeto', campos };
  }
  return { tipo: tipoDe(v) };
}

function descreverErro(dados) {
  if (!dados || typeof dados !== 'object') return null;
  const saida = { campos: Object.keys(dados).slice(0, 20) };
  for (const chave of ['message', 'mensagem', 'error', 'erro', 'error_description', 'detail', 'status']) {
    if (typeof dados[chave] === 'string' || typeof dados[chave] === 'number') saida[chave] = String(dados[chave]).slice(0, 200);
  }
  return saida;
}

// Procura o código do aluno na resposta de /pessoas/{p}/alunos.
function acharCodigoAluno(dados) {
  const lista = Array.isArray(dados) ? dados : (dados && typeof dados === 'object' ? Object.values(dados).find(Array.isArray) : null);
  const item = lista?.find((x) => x && typeof x === 'object') ?? (dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : null);
  if (!item) return null;
  for (const chave of ['codAluno', 'cod_aluno', 'aluno', 'codigoAluno']) {
    if (item[chave] !== undefined && item[chave] !== null && typeof item[chave] !== 'object') return String(item[chave]);
  }
  return null;
}

// Lê o código público do portal (sem dados da Carol) e devolve os trechos onde
// ele define o servidor da API, para o caso de algo ainda não responder.
async function lerTrechosDoCodigo(html, base, pedir) {
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => new URL(m[1], `${base}/`).href)
    .filter((u) => /\/_app\/[^/]*\.js/i.test(u));
  const agulhas = ['"AppCfg"', 'AppCfg=', 'getApiServer'];
  const textos = await Promise.all(srcs.slice(0, 4).map(async (url) => {
    try {
      return await (await pedir(url)).text();
    } catch {
      return ''; // segue sem os trechos deste arquivo
    }
  }));
  const trechos = [];
  for (const texto of textos) {
    for (const agulha of agulhas) {
      let i = texto.indexOf(agulha);
      let vezes = 0;
      while (i >= 0 && vezes < 2) {
        trechos.push({ agulha, trecho: texto.slice(Math.max(0, i - 200), i + 300).replace(/\s+/g, ' ') });
        i = texto.indexOf(agulha, i + agulha.length);
        vezes += 1;
      }
    }
  }
  return trechos.slice(0, 10);
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const codigoEsperado = process.env.HUB_CODIGO_ACESSO;
  if (!codigoEsperado) return resposta(500, { ok: false, erro: 'Falta a variável HUB_CODIGO_ACESSO na Netlify.' });
  const base = (process.env.LYCEUM_BASE_URL || BASE_PADRAO).replace(/\/+$/, '');
  const origem = new URL(base).origin;

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
  const lerJson = async (r) => {
    const tipo = r.headers.get('content-type') || '';
    const texto = await r.text();
    if (!tipo.includes('json')) return { json: false, tamanho: texto.length, tipo };
    try {
      return { json: true, dados: JSON.parse(texto) };
    } catch {
      return { json: false, tamanho: texto.length, tipo };
    }
  };

  // 1. Abre o portal (ele cria uma sessão antes do login)
  let htmlInicial = '';
  try {
    htmlInicial = await (await pedir(`${base}/`)).text();
  } catch {
    // segue mesmo assim
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
    const erro = /captcha/i.test(texto)
      ? 'O Lyceum pediu captcha. O app não tenta contornar: me avise para seguirmos pelo plano B.'
      : login.status === 401 ? 'Matrícula ou senha incorretas. Confira e tente de novo.' : `O Lyceum recusou o login (HTTP ${login.status}).`;
    etapas.push({ nome: 'Entrar no Lyceum', ok: false, detalhe: erro });
    return resposta(200, { ok: false, etapas, erro });
  }
  etapas.push({ nome: 'Entrar no Lyceum', ok: true, detalhe: 'Login aceito (sem captcha).' });

  // 3. Código da pessoa (cookie user-data) e código do aluno (lista de alunos da pessoa)
  const usuario = lerUserData(potinho.ler('user-data'));
  const codPessoa = usuario?.id ? String(usuario.id) : null;
  const apix = `${base}/apix`;
  const transacao = { 'X-Lyceum-Transacao': `${base}/#/home/avisos` };

  let codAluno = null;
  let statusAlunos = 'não testado';
  if (codPessoa) {
    try {
      const r = await pedir(`${apix}/pessoas/${encodeURIComponent(codPessoa)}/alunos`, { headers: { ...transacao, 'X-Lyceum-Usuario': 'null' } });
      statusAlunos = r.status;
      const { json, dados } = await lerJson(r);
      if (r.ok && json) codAluno = acharCodigoAluno(dados);
    } catch {
      statusAlunos = 'erro';
    }
  }
  etapas.push({
    nome: 'Descobrir os códigos',
    ok: Boolean(codPessoa && codAluno),
    detalhe: `Código da pessoa: ${codPessoa ? 'encontrado' : 'não encontrado'}. Lista de alunos (apix): HTTP ${statusAlunos}. Código do aluno: ${codAluno ? 'encontrado' : 'não encontrado'}.`,
  });
  if (!codPessoa || !codAluno) {
    const trechos = await lerTrechosDoCodigo(htmlInicial, base, pedir);
    return resposta(200, { ok: false, etapas, trechos, erro: 'Entrou no Lyceum, mas não achei os seus códigos. Me mande este resultado.' });
  }

  const montar = (caminho) => caminho.replace('{p}', encodeURIComponent(codPessoa)).replace('{a}', encodeURIComponent(codAluno));

  // 4. Qual perfil o portal aceita no cabeçalho "perfil: códigoDoAluno"
  const testesPerfil = await Promise.all(PERFIS.map(async (perfil) => {
    try {
      const r = await pedir(`${apix}${montar('/pessoas/codAluno/{a}/obterDadosAcademicos')}`, {
        headers: { ...transacao, 'X-Lyceum-Usuario': `${perfil}: ${codAluno}` },
      });
      await r.arrayBuffer();
      return { perfil, status: r.status };
    } catch {
      return { perfil, status: 'erro' };
    }
  }));
  const perfilCerto = testesPerfil.find((t) => t.status === 200)?.perfil || PERFIS[0];
  etapas.push({
    nome: 'Identificação no portal',
    ok: testesPerfil.some((t) => t.status === 200),
    detalhe: `Formato "perfil: código do aluno". ${testesPerfil.map((t) => `${t.perfil}: HTTP ${t.status}`).join(' · ')}.`,
  });
  const identificacao = { ...transacao, 'X-Lyceum-Usuario': `${perfilCerto}: ${codAluno}` };

  // 5. Testa as rotas. As de ${API_URL} vão em três servidores possíveis.
  const servidoresApiUrl = [
    { rotulo: '/aluno/apix', url: apix },
    { rotulo: '/aluno/api', url: `${base}/api` },
    { rotulo: '/api', url: `${origem}/api` },
  ];
  const testar = async (rota, servidor) => {
    try {
      const r = await pedir(`${servidor.url}${montar(rota.caminho)}`, { headers: identificacao });
      const lido = await lerJson(r);
      const item = { servidor: servidor.rotulo, status: r.status, ok: r.ok && lido.json };
      if (item.ok) item.estrutura = estrutura(lido.dados);
      else if (lido.json) item.erro = descreverErro(lido.dados);
      else item.observacao = `Resposta em ${lido.tipo || 'formato desconhecido'} (${lido.tamanho} caracteres)`;
      return item;
    } catch (erro) {
      const demorou = erro?.name === 'TimeoutError' || erro?.name === 'AbortError';
      return { servidor: servidor.rotulo, status: 'erro', ok: false, observacao: demorou ? 'demorou demais' : 'falha de rede' };
    }
  };

  const rotas = await Promise.all(ROTAS.map(async (rota) => {
    const servidores = rota.base === 'apix' ? [{ rotulo: '/aluno/apix', url: apix }] : servidoresApiUrl;
    const tentativas = await Promise.all(servidores.map((s) => testar(rota, s)));
    const certa = tentativas.find((t) => t.ok);
    return {
      id: rota.id,
      descricao: rota.descricao,
      rota: rota.caminho,
      ok: Boolean(certa),
      ...(certa ? { servidor: certa.servidor, estrutura: certa.estrutura } : { tentativas }),
    };
  }));

  const funcionaram = rotas.filter((r) => r.ok).length;
  const corpo = { ok: true, etapas, resumo: `${funcionaram} de ${rotas.length} rotas responderam.`, rotas };
  if (funcionaram < rotas.length) corpo.trechos = await lerTrechosDoCodigo(htmlInicial, base, pedir);
  return resposta(200, corpo);
};
