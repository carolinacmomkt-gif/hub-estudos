// Conversa com o AVA (Moodle da UniEVANGÉLICA) pela API de web services do app mobile.
// Tudo somente leitura. Usado por ava-conectar e, na Etapa 4, pela sincronização.

const TEMPO_LIMITE_MS = 4500; // a função inteira precisa caber nos ~10 s da Netlify
const AGENTE = 'HubDeEstudos/1.0';

// Métodos de que o Hub precisa, com o que cada um traz.
export const METODOS = [
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
export const RESERVAS = [
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

export async function lerConfigPublica(base) {
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

export async function pedirToken(base, matricula, senha) {
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

export async function lerSiteInfo(base, token) {
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

export function montarRelatorio(info) {
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

// ---------------------------------------------------------------------------
// Chamada genérica (usada pela sincronização)
// ---------------------------------------------------------------------------

export class ErroAva extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo; // 'token' (vencido/recusado), 'bloqueado' (accessexception), 'rede', 'outro'
  }
}

// O Moodle recebe listas assim: courseids[0]=1&courseids[1]=2&options[0][name]=x
function achatar(params, prefixo = '', saida = new URLSearchParams()) {
  for (const [chave, valor] of Object.entries(params)) {
    const nome = prefixo ? `${prefixo}[${chave}]` : chave;
    if (valor === undefined || valor === null) continue;
    if (typeof valor === 'object') achatar(valor, nome, saida);
    else saida.append(nome, String(valor));
  }
  return saida;
}

export async function chamarAva(base, token, funcao, params = {}) {
  const corpo = achatar(params);
  corpo.set('wstoken', token);
  corpo.set('wsfunction', funcao);
  corpo.set('moodlewsrestformat', 'json');
  let dados;
  try {
    dados = await postar(`${base}/webservice/rest/server.php`, corpo.toString());
  } catch (erro) {
    throw new ErroAva(`${funcao}: ${explicarFalhaDeRede(erro)}`, 'rede');
  }
  if (dados && dados.exception) {
    if (['invalidtoken', 'webservice_access_exception'].includes(dados.errorcode) && /token/i.test(dados.message || '')) {
      throw new ErroAva('O acesso ao AVA venceu ou foi recusado. Conecte o AVA de novo.', 'token');
    }
    if (dados.errorcode === 'invalidtoken') throw new ErroAva('O acesso ao AVA venceu. Conecte o AVA de novo.', 'token');
    if (dados.errorcode === 'accessexception') throw new ErroAva(`${funcao} está bloqueado no AVA.`, 'bloqueado');
    throw new ErroAva(`${funcao}: ${dados.message || dados.errorcode}`, 'outro');
  }
  return dados;
}
