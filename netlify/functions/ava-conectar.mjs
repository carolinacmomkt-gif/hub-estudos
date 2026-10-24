// Teste de conexão com o AVA (Moodle da UniEVANGÉLICA).
//
// Recebe matrícula + senha UMA vez, pede o token do app mobile, consulta
// core_webservice_get_site_info e devolve só um relatório do que está liberado.
// A senha e o token nunca saem desta função, nunca são registrados em log e,
// nesta etapa, não são guardados em lugar nenhum.
//
// Variáveis de ambiente: AVA_BASE_URL e HUB_CODIGO_ACESSO (proteção temporária
// até existir o login do Supabase).

import { timingSafeEqual } from 'node:crypto';

const TEMPO_LIMITE_MS = 4500; // a função inteira precisa caber nos ~10 s da Netlify
const AGENTE = 'HubDeEstudos/1.0';

// Métodos de que o Hub precisa, com o que cada um traz.
const METODOS = [
  { nome: 'core_webservice_get_site_info', descricao: 'Seus dados e as funções liberadas' },
  { nome: 'core_enrol_get_users_courses', descricao: 'Disciplinas' },
  { nome: 'core_course_get_contents', descricao: 'Materiais e arquivos' },
  { nome: 'mod_assign_get_assignments', descricao: 'Trabalhos e prazos' },
  { nome: 'mod_assign_get_submission_status', descricao: 'Status de entrega dos trabalhos' },
  { nome: 'mod_quiz_get_quizzes_by_courses', descricao: 'Provas e questionários online' },
  { nome: 'core_calendar_get_action_events_by_timesort', descricao: 'Prazos do calendário' },
  { nome: 'core_calendar_get_calendar_upcoming_view', descricao: 'Próximos eventos' },
  { nome: 'gradereport_user_get_grade_items', descricao: 'Notas' },
  { nome: 'mod_forum_get_forums_by_courses', descricao: 'Fóruns das disciplinas' },
  { nome: 'mod_forum_get_forum_discussions', descricao: 'Avisos' },
];

// Alternativas que ajudam se algum dos principais vier bloqueado.
const RESERVAS = [
  { nome: 'gradereport_overview_get_course_grades', descricao: 'Nota final por disciplina' },
  { nome: 'core_calendar_get_calendar_events', descricao: 'Eventos do calendário (outro método)' },
  { nome: 'core_calendar_get_calendar_export_token', descricao: 'Link .ics do calendário' },
  { nome: 'mod_resource_get_resources_by_courses', descricao: 'Arquivos das disciplinas' },
  { nome: 'mod_folder_get_folders_by_courses', descricao: 'Pastas das disciplinas' },
  { nome: 'mod_url_get_urls_by_courses', descricao: 'Links das disciplinas' },
  { nome: 'mod_page_get_pages_by_courses', descricao: 'Páginas das disciplinas' },
];

const TIPOS_LOGIN = {
  1: 'Login com usuário e senha dentro do app',
  2: 'Login pelo navegador (o app abre a página do AVA)',
  3: 'Login pelo navegador embutido no app',
};

const ERROS_TOKEN = {
  invalidlogin: 'Matrícula ou senha incorretas. Confira e tente de novo.',
  enablewsdescription: 'O AVA não libera o acesso por aplicativos (web services desligados).',
  servicenotavailable: 'O serviço do app mobile não está disponível neste AVA.',
  sitemaintenance: 'O AVA está em manutenção agora. Tente mais tarde.',
  usernotfullysetup: 'Seu perfil no AVA está incompleto. Entre pelo site do AVA uma vez e complete o cadastro.',
  forcepasswordchangenotice: 'O AVA está pedindo para você trocar a senha. Troque pelo site e tente de novo.',
  restoredaccountresetpassword: 'O AVA está pedindo para você redefinir a senha pelo site.',
  passwordpolicy: 'A senha não atende às regras do AVA. Troque pelo site e tente de novo.',
};

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

async function postar(url, corpo, tipo = 'application/x-www-form-urlencoded') {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': tipo, Accept: 'application/json', 'User-Agent': AGENTE },
    body: corpo,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const texto = await resp.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Resposta inesperada do AVA (HTTP ${resp.status}).`);
  }
}

function explicarFalhaDeRede(erro) {
  if (erro?.name === 'TimeoutError' || erro?.name === 'AbortError') return 'O AVA demorou demais para responder.';
  return erro?.message?.startsWith('Resposta inesperada') ? erro.message : 'Não foi possível falar com o AVA.';
}

async function lerConfigPublica(base) {
  try {
    const dados = await postar(
      `${base}/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config&lang=pt_br`,
      JSON.stringify([{ index: 0, methodname: 'tool_mobile_get_public_config', args: {} }]),
      'application/json',
    );
    const item = Array.isArray(dados) ? dados[0] : null;
    if (!item || item.error) return { ok: false, detalhe: 'O AVA não informou a configuração pública.' };
    const c = item.data || {};
    return {
      ok: true,
      site: c.sitename || null,
      tipoLogin: c.typeoflogin ?? null,
      tipoLoginDescricao: TIPOS_LOGIN[c.typeoflogin] || 'Tipo de login desconhecido',
      appLiberado: c.enablemobilewebservice !== 0,
      manutencao: Boolean(c.maintenanceenabled),
      provedores: (c.identityproviders || []).map((p) => p.name).filter(Boolean),
    };
  } catch (erro) {
    return { ok: false, detalhe: explicarFalhaDeRede(erro) };
  }
}

async function pedirToken(base, matricula, senha) {
  try {
    const corpo = new URLSearchParams({ username: matricula, password: senha, service: 'moodle_mobile_app' });
    const dados = await postar(`${base}/login/token.php`, corpo.toString());
    if (dados.token) return { ok: true, token: dados.token };
    return {
      ok: false,
      codigo: dados.errorcode || 'desconhecido',
      detalhe: ERROS_TOKEN[dados.errorcode] || `O AVA recusou o login (${dados.errorcode || 'motivo não informado'}).`,
    };
  } catch (erro) {
    return { ok: false, codigo: 'rede', detalhe: explicarFalhaDeRede(erro) };
  }
}

async function lerSiteInfo(base, token) {
  try {
    const corpo = new URLSearchParams({
      wstoken: token,
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json',
    });
    const dados = await postar(`${base}/webservice/rest/server.php`, corpo.toString());
    if (dados.exception) {
      return { ok: false, detalhe: dados.errorcode === 'accessexception' ? 'Acesso bloqueado a core_webservice_get_site_info.' : (dados.message || dados.errorcode) };
    }
    return { ok: true, dados };
  } catch (erro) {
    return { ok: false, detalhe: explicarFalhaDeRede(erro) };
  }
}

function montarRelatorio(info) {
  const liberadas = new Set((info.functions || []).map((f) => f.name));
  const marcar = (lista) => lista.map((m) => ({ ...m, liberado: liberadas.has(m.nome) }));
  const funcoesFrequencia = [...liberadas].filter((n) => n.startsWith('mod_attendance_')).sort();

  return {
    site: { nome: info.sitename, versao: info.release || info.version || null },
    usuaria: { nome: info.fullname || info.firstname || null },
    baixarArquivos: Boolean(info.downloadfiles),
    totalFuncoes: liberadas.size,
    metodos: marcar(METODOS),
    reservas: marcar(RESERVAS),
    frequencia: { disponivel: funcoesFrequencia.length > 0, funcoes: funcoesFrequencia },
  };
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const base = (process.env.AVA_BASE_URL || '').replace(/\/+$/, '');
  const codigoEsperado = process.env.HUB_CODIGO_ACESSO;
  if (!base || !codigoEsperado) {
    return resposta(500, { ok: false, erro: 'Faltam as variáveis AVA_BASE_URL ou HUB_CODIGO_ACESSO na Netlify.' });
  }

  let entrada;
  try {
    entrada = await req.json();
  } catch {
    return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  }

  const matricula = typeof entrada?.matricula === 'string' ? entrada.matricula.trim() : '';
  let senha = typeof entrada?.senha === 'string' ? entrada.senha : '';
  const codigo = typeof entrada?.codigo === 'string' ? entrada.codigo : '';

  if (!codigoConfere(codigo, codigoEsperado)) {
    // Pequena espera para dificultar tentativas em sequência.
    await new Promise((r) => setTimeout(r, 1000));
    return resposta(401, { ok: false, erro: 'Código de acesso incorreto.' });
  }
  if (!matricula || !senha || matricula.length > 100 || senha.length > 200) {
    return resposta(400, { ok: false, erro: 'Preencha a matrícula e a senha.' });
  }

  // A configuração pública não depende do login: as duas consultas vão juntas.
  const [config, login] = await Promise.all([lerConfigPublica(base), pedirToken(base, matricula, senha)]);
  senha = null; // não é mais necessária

  const etapas = [
    { nome: 'Configuração pública do AVA', ok: config.ok, detalhe: config.ok ? config.tipoLoginDescricao : config.detalhe },
    { nome: 'Gerar o token do app (moodle_mobile_app)', ok: login.ok, detalhe: login.ok ? 'Token gerado. Ele não foi guardado.' : login.detalhe },
  ];

  if (!login.ok) {
    return resposta(200, { ok: false, etapas, config, erro: login.detalhe });
  }

  const info = await lerSiteInfo(base, login.token);
  etapas.push({ nome: 'Ler core_webservice_get_site_info', ok: info.ok, detalhe: info.ok ? 'Funções liberadas lidas.' : info.detalhe });

  if (!info.ok) {
    return resposta(200, { ok: false, etapas, config, erro: info.detalhe });
  }

  return resposta(200, { ok: true, etapas, config, ...montarRelatorio(info.dados) });
};
