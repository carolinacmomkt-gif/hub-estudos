// O que o robô do Google manda (Carol, 17/11/2026) vira acompanhamento da R7, sem DOM e sem IA:
// os vídeos de cada briefing e o que já foi editado/usado, a demanda de vídeos da segunda pronta para
// mandar, e o resumo do Trello dos designers por cliente. Os dados chegam em config "r7-robo:videos" e
// "r7-robo:trello" (pela função receber_do_robo do Supabase); os pedidos ficam em config "r7-videos".

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIA_MS = 864e5;

export const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// A palavra é um mês? Abreviação ("set", "nov") ou o nome com erro de digitação ("setermbro", "outbro"):
// as 3 primeiras letras iguais e quase todas as letras do mês na ordem ("outra" não é outubro).
function lcs(a, b) {
  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  return d[a.length][b.length];
}
function indiceDoMes(p) {
  if (!p || p.length < 3) return -1;
  return MESES.findIndex((m) => m.slice(0, 3) === p.slice(0, 3) && (p.length <= 4 ? m.startsWith(p) : lcs(p, m) / Math.max(p.length, m.length) >= 0.75));
}

// "Dra. Fulana Exemplo" / "DRA. FULANA EXEMPLO" / "BRIENF Dra Fulana  SETEMBRO.docx" → palavras do nome.
const VAZIAS = new Set(['dr', 'dra', 'doutor', 'doutora', 'de', 'da', 'do', 'das', 'dos', 'e', 'brienf', 'brienfd', 'briefing', 'brief', 'videos', 'video', 'docx', 'doc', 'mp4', 'mov', 'clinica']);
export function palavrasDoNome(t) {
  return sem(t).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((p) => p.length > 1 && !VAZIAS.has(p) && !/^\d+$/.test(p) && indiceDoMes(p) < 0);
}

// O arquivo é deste cliente? Todas as palavras do primeiro nome (e do sobrenome, se o arquivo trouxer) batem.
export function ehDoCliente(nomeArquivo, nomeCliente) {
  const doCliente = palavrasDoNome(nomeCliente);
  const doArquivo = new Set(palavrasDoNome(nomeArquivo));
  if (!doCliente.length || !doArquivo.size) return false;
  const [primeiro, ...resto] = doCliente;
  if (!doArquivo.has(primeiro)) return false;
  const outros = resto.filter((p) => doArquivo.has(p)).length;
  const sobrenomesNoArquivo = [...doArquivo].filter((p) => p !== primeiro && !doCliente.includes(p)).length;
  return outros > 0 || sobrenomesNoArquivo === 0;
}

// Mês pelo nome (aceita erro de digitação: "setermbro", "outbro"): as 3 primeiras letras.
export function mesDoTexto(t) {
  const palavras = sem(t).replace(/[^a-z ]+/g, ' ').split(' ');
  for (const p of palavras) {
    const i = indiceDoMes(p);
    if (i >= 0) return i + 1;
  }
  return null;
}

// Número do vídeo no nome do editado: o de 1 ou 2 dígitos colado antes ou depois do mês.
// "Dra.Fulana Exemplo 12 setembro.MP4" → 12; "Fulana Exemplo - Novembro 04.mp4" → 4; "Fulana - 1.mp4" → null.
export function numeroDoVideo(nome) {
  const base = sem(nome).replace(/\.(mp4|mov|m4v)\b.*$/, '').replace(/\(\d+\)/g, ' ');
  const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);
  const iMes = tokens.findIndex((p) => indiceDoMes(p) >= 0);
  if (iMes < 0) return null;
  for (const j of [iMes - 1, iMes + 1]) {
    if (/^\d{1,2}$/.test(tokens[j] || '')) return Number(tokens[j]);
  }
  return null;
}

const TIPO = (t) => {
  const s = sem(t);
  if (/trend/.test(s)) return 'Trend';
  if (/conteudo|conteudo|conte\w*do|caixinha/.test(s)) return 'Conteúdo';
  return String(t || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Conteúdo';
};

// Lê o texto de um briefing: um bloco por "Vídeo N", com o tipo e o título.
export function lerBriefing(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n');
  const videos = [];
  let atual = null;
  for (const linha of linhas) {
    const m = linha.match(/^\s*#*\s*\**\s*v[ií]deo\s+(\d{1,2})\b\s*[-–—:.]?\s*(.*)$/i);
    if (m) {
      atual = { n: Number(m[1]), tipo: TIPO(m[2].replace(/\*/g, '')), titulo: '' };
      if (!videos.some((v) => v.n === atual.n)) videos.push(atual);
      continue;
    }
    if (atual && !atual.titulo && /^\s*\**\s*t[ií]tulo/i.test(linha)) {
      atual.titulo = linha.replace(/^\s*\**\s*t[ií]tulo\**/i, '').replace(/^[^\p{L}\d]*\d{0,2}\s*[-–—:.]?\s*/u, '').replace(/\*/g, '').trim().slice(0, 140);
    }
  }
  const total = Number((String(texto).match(/total de\s+(\d{1,2})\s+v[ií]deos/i) || [])[1]) || videos.length;
  return { videos: videos.sort((a, z) => a.n - z.n), total };
}

// Mês do briefing: pelo nome do arquivo, senão pela pasta. Devolve "AAAA-MM".
export function mesDoBriefing(b) {
  const m = mesDoTexto(b.arquivo) || mesDoTexto(b.pasta);
  if (!m) return null;
  return `${b.ano || new Date(b.modificado || Date.now()).getFullYear()}-${String(m).padStart(2, '0')}`;
}

const nomeDoMes = (am) => (am ? `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(am.slice(5, 7)) - 1]}` : '');

// Situação dos vídeos de um cliente: o briefing em uso (o mais recente que ainda tem vídeo para pedir),
// o que já foi editado ou usado, o que foi pedido e os próximos a pedir.
export function videosDoCliente(nomeCliente, robo, pedidos = [], { porSemana = 2, hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const briefings = (robo?.briefings || []).filter((b) => ehDoCliente(b.arquivo, nomeCliente))
    .map((b) => ({ ...b, mes: mesDoBriefing(b), ...lerBriefing(b.texto) }))
    .filter((b) => b.mes && b.videos.length)
    .filter((b, _, todos) => b.anexado || !todos.some((x) => x.anexado && x.mes === b.mes))
    .sort((a, z) => z.mes.localeCompare(a.mes));
  const producao = (robo?.producao || []).filter((p) => ehDoCliente(p.cliente, nomeCliente));
  const mesDaPasta = (p) => mesDoTexto(p.pasta);
  const situacao = (b) => {
    const m = Number(b.mes.slice(5, 7));
    const pastas = producao.filter((p) => mesDaPasta(p) === m);
    const numeros = (lista) => new Set(lista.map((n) => numeroDoVideo(n)).filter((n) => n !== null));
    const usados = numeros(pastas.flatMap((p) => p.usados || []));
    const editados = numeros(pastas.flatMap((p) => p.editados || []));
    const naoIdentificados = pastas.flatMap((p) => [...(p.editados || []), ...(p.usados || [])]).filter((n) => numeroDoVideo(n) === null);
    const pedidosDoMes = pedidos.filter((x) => sem(x.cliente) === sem(nomeCliente) && x.mes === b.mes);
    const videos = b.videos.map((v) => {
      const pedido = pedidosDoMes.find((x) => x.n === v.n);
      const estado = usados.has(v.n) ? 'usado' : editados.has(v.n) ? 'editado' : pedido ? 'pedido' : 'falta';
      const atrasado = estado === 'pedido' && (Date.parse(`${hoje}T12:00:00Z`) - Date.parse(pedido.em)) > 7 * DIA_MS;
      return { ...v, estado, pedidoEm: pedido?.em || null, atrasado };
    });
    return { ...b, videos, naoIdentificados };
  };
  const lidos = briefings.map(situacao);
  const emUso = [...lidos].reverse().find((b) => b.videos.some((v) => v.estado === 'falta')) || lidos[0] || null;
  if (!emUso) return { briefing: null, pedir: [], estoque: 0, restam: 0, semanas: 0, captacao: briefings.length === 0 ? 'sem-briefing' : 'acabou' };
  const pedir = emUso.videos.filter((v) => v.estado === 'falta').slice(0, porSemana);
  const restam = emUso.videos.filter((v) => v.estado === 'falta').length;
  const estoque = lidos.reduce((n, b) => n + b.videos.filter((v) => v.estado === 'editado').length, 0);
  return {
    briefing: emUso, pedir, estoque, restam, semanas: Math.floor(restam / Math.max(1, porSemana)),
    captacao: restam === 0 ? 'acabou' : restam <= porSemana ? 'acabando' : '',
    atrasados: lidos.flatMap((b) => b.videos.filter((v) => v.atrasado).map((v) => ({ ...v, mes: b.mes }))),
  };
}

// Texto da demanda de vídeos (formato curto da R7: número e tipo, por cliente e mês do briefing).
export function textoDaDemanda(linhas) {
  const blocos = linhas.filter((l) => l.pedir.length).map((l) => [
    `${l.nome} (briefing de ${nomeDoMes(l.mes)})`,
    ...l.pedir.map((v) => `Vídeo ${v.n} – ${v.tipo}`),
  ].join('\n'));
  return blocos.join('\n\n');
}

// ---------------------------------------------------------------------------
// Trello dos designers
// ---------------------------------------------------------------------------

const tem = (etiquetas, re) => (etiquetas || []).some((e) => re.test(sem(e)));

export function estadoDoCartao(c, hoje) {
  const e = c.etiquetas || [];
  if (tem(e, /^finalizado/)) return 'pronta';
  if (tem(e, /^altera/)) return 'ajuste';
  const venceu = c.vence && c.vence.slice(0, 10) < hoje && !c.feito;
  if (venceu) return 'vencida';
  if (tem(e, /^(demanda|em andamento|encaminhado)/)) return 'designer';
  return 'designer';
}

// Os cartões da lista do cliente (cada lista é um cliente; a ficha diz qual), em qualquer quadro de design.
export function trelloDoCliente(robo, { nome, lista = '' }, hoje = new Date().toISOString().slice(0, 10)) {
  const alvo = lista ? sem(lista) : '';
  const cartoes = (robo?.quadros || []).flatMap((q) => (q.cartoes || []).map((c) => ({ ...c, quadro: q.quadro })))
    .filter((c) => (alvo ? sem(c.lista) === alvo || sem(c.lista).startsWith(alvo) : ehDoCliente(c.lista, nome)));
  const conta = { designer: 0, ajuste: 0, pronta: 0, vencida: 0 };
  const itens = cartoes.map((c) => ({ ...c, estado: estadoDoCartao(c, hoje) }));
  for (const c of itens) conta[c.estado] += 1;
  return { itens: itens.sort((a, z) => String(a.vence || '9').localeCompare(String(z.vence || '9'))), conta, total: itens.length };
}

export function frasesDoTrello(t) {
  if (!t.total) return '';
  return [t.conta.designer && `${t.conta.designer} com o designer`, t.conta.ajuste && `${t.conta.ajuste} em ajuste`, t.conta.vencida && `${t.conta.vencida} vencida${t.conta.vencida > 1 ? 's' : ''}`, t.conta.pronta && `${t.conta.pronta} pronta${t.conta.pronta > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
}

export function dadosDoRobo(config = [], tipo) {
  const linha = config.find((c) => c.chave === `r7-robo:${tipo}` && !c.excluido_em);
  return linha ? { ...(linha.valor?.dados || {}), recebido_em: linha.valor?.recebido_em || null } : null;
}

export function pedidosDeVideo(config = []) {
  return config.find((c) => c.chave === 'r7-videos' && !c.excluido_em)?.valor?.pedidos || [];
}

// ---------------------------------------------------------------------------
// Cadastro automático pelos briefings (Carol, 17/11/2026): cada briefing de vídeo da R7 é de um cliente, e a
// primeira linha traz a profissão e o registro ("Briefing Dr Fulano Médico – CRM/GO 12.345"). O app cria a
// ficha de quem ainda não está na Bússola, com o selo "confira"; o que ela escreveu nunca é trocado.
// ---------------------------------------------------------------------------

const CONSELHOS = 'CRM|CRO|CRP|CRN|CREFITO|CREFONO|CRFA|CRF|COREN|CRBM|CRMV';
const PROFISSOES = [
  [/m[eé]dic[oa]/i, (f) => (f ? 'Médica' : 'Médico')], [/cirurgi[aã]o?-?dentista|dentista/i, (f) => (f ? 'Cirurgiã-dentista' : 'Cirurgião-dentista')],
  [/psic[oó]log[oa]/i, (f) => (f ? 'Psicóloga' : 'Psicólogo')], [/nutricionista/i, () => 'Nutricionista'], [/fisioterapeuta/i, () => 'Fisioterapeuta'],
  [/fonoaudi[oó]log[oa]/i, (f) => (f ? 'Fonoaudióloga' : 'Fonoaudiólogo')], [/biom[eé]dic[oa]/i, (f) => (f ? 'Biomédica' : 'Biomédico')],
  [/farmac[eê]utic[oa]/i, (f) => (f ? 'Farmacêutica' : 'Farmacêutico')], [/enfermeir[oa]/i, (f) => (f ? 'Enfermeira' : 'Enfermeiro')],
];
const PELO_CONSELHO = { CRM: (f) => (f ? 'Médica' : 'Médico'), CRO: (f) => (f ? 'Cirurgiã-dentista' : 'Cirurgião-dentista'), CRP: (f) => (f ? 'Psicóloga' : 'Psicólogo'), CRN: () => 'Nutricionista', CREFITO: () => 'Fisioterapeuta' };

const titulo = (t) => t.split(' ').map((p) => (p.length <= 3 && /^(de|da|do|das|dos|e)$/i.test(p) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join(' ');

// "BRIENF Briefing Dra Fulana  - Março.docx" → "Dra. Fulana"
export function nomeDoBriefing(arquivo) {
  let t = String(arquivo || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ');
  t = t.replace(/^\s*((brienf|briefing|brief)\b[\s:–—-]*)+/i, '');
  t = t.split(/\s[-–—]\s*|\s{2,}[-–—]|[-–—]\s+/)[0];
  t = t.replace(/\s+(m[eé]dic[oa]|cirurgi[aã]o?|dentista|psic[oó]log[oa]|nutricionista)\b.*$/i, '');
  t = t.split(' ').filter((p) => p && indiceDoMes(sem(p)) < 0).join(' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t === t.toUpperCase()) t = titulo(t);
  return t.replace(/^(dra|dr)\.?\s+/i, (m) => (/dra/i.test(m) ? 'Dra. ' : 'Dr. '));
}

// O registro da primeira linha: { conselho, uf, numero, profissao } ou null.
export function registroDoBriefing(texto, nome = '') {
  const topo = String(texto || '').split('\n').slice(0, 4).join(' ');
  const m = new RegExp(`\\b(${CONSELHOS})\\s*[/-]?\\s*([A-Z]{2})?\\s*[:nº°-]*\\s*(\\d[\\d.]{1,9}\\d)`, 'i').exec(topo);
  if (!m) return null;
  const fem = /^dra\b/i.test(nome);
  const conselho = m[1].toUpperCase();
  const achada = PROFISSOES.find(([re]) => re.test(topo));
  const profissao = achada ? achada[1](fem) : (PELO_CONSELHO[conselho] ? PELO_CONSELHO[conselho](fem) : '');
  return { conselho, uf: (m[2] || '').toUpperCase(), numero: m[3].replace(/[.\s]/g, ''), profissao };
}

export function assinaturaDoRegistro(nome, r) {
  if (!r) return '';
  return [nome, r.profissao, `${r.conselho}${r.uf ? `-${r.uf}` : ''} ${r.numero}`].filter(Boolean).join(' | ');
}

// Os clientes que os briefings mostram (o briefing mais recente de cada um, dos últimos "dias").
export function clientesDosBriefings(robo, { hoje = new Date().toISOString().slice(0, 10), dias = 150 } = {}) {
  const limite = Date.parse(`${hoje}T12:00:00Z`) - dias * DIA_MS;
  const porNome = new Map();
  for (const b of robo?.briefings || []) {
    if (b.modificado && Date.parse(b.modificado) < limite) continue;
    const nome = nomeDoBriefing(b.arquivo);
    if (palavrasDoNome(nome).length === 0) continue;
    const chave = palavrasDoNome(nome).join(' ');
    const atual = porNome.get(chave);
    if (atual && String(atual.modificado || '') >= String(b.modificado || '')) continue;
    const reg = registroDoBriefing(b.texto, nome);
    porNome.set(chave, { chave, nome, registro: reg, assinatura: assinaturaDoRegistro(nome, reg), topo: String(b.texto || '').split('\n').slice(0, 3).join(' '), arquivo: b.arquivo, modificado: b.modificado || '' });
  }
  return [...porNome.values()].sort((a, z) => a.nome.localeCompare(z.nome));
}

// Quem dos briefings ainda não está na Bússola (nem foi recusado antes).
export function clientesNovosDoRobo(robo, existentes = [], vistos = [], opcoes) {
  const jaVistos = new Set(vistos);
  return clientesDosBriefings(robo, opcoes).filter((c) => !jaVistos.has(c.chave)
    && !existentes.some((e) => ehDoCliente(c.nome, e.nome) || ehDoCliente(e.nome, c.nome)));
}

// A lista do cliente nos quadros dos designers (pelo nome) → { quadro, lista } ou null.
export function listaDoCliente(roboTrello, nome) {
  for (const q of roboTrello?.quadros || []) {
    const lista = [...new Set((q.cartoes || []).map((c) => c.lista))].find((l) => ehDoCliente(l, nome));
    if (lista) return { quadro: q.quadro, lista };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Artes do Trello no cronograma: o card do designer tem a copy na descrição (a que a Bússola montou com
// "Copiar para o Trello"); a peça é a de copy mais parecida, e as imagens entram na ordem das lâminas.
// ---------------------------------------------------------------------------

const palavras = (t) => new Set(sem(t).replace(/\*\*|capa|card \d+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((p) => p.length > 3));

export function parecido(a, b) {
  const x = palavras(a);
  const y = palavras(b);
  if (!x.size || !y.size) return 0;
  let comum = 0;
  for (const p of x) if (y.has(p)) comum += 1;
  return comum / Math.min(x.size, y.size);
}

// Os cartões com arte (anexos de imagem guardados pelo robô) → [{ peca, cartao, anexos }].
// Só casa peça de feed com a copy, ou pelo tema no nome do card; cada card vai para uma peça só.
export function artesDoTrelloParaCronograma(cron, roboTrello, { nome = '', lista = '' } = {}) {
  const alvo = lista ? sem(lista) : '';
  const cartoes = (roboTrello?.quadros || []).flatMap((q) => (q.cartoes || []).map((c) => ({ ...c, quadro: q.quadro })))
    .filter((c) => (c.anexos || []).some((a) => a.caminho))
    .filter((c) => (alvo ? sem(c.lista) === alvo || sem(c.lista).startsWith(alvo) : ehDoCliente(c.lista, nome)));
  const usados = new Set();
  const saida = [];
  for (const p of cron.pecas) {
    if (!(p.tipo === 'post' || p.tipo === 'reels')) continue;
    const copy = [p.slides, p.tema].join('\n');
    let melhor = null;
    for (const c of cartoes) {
      if (usados.has(c.url || c.nome)) continue;
      const nota = Math.max(parecido(c.desc || '', copy), p.tema ? parecido(c.nome, p.tema) : 0);
      if (nota >= 0.6 && (!melhor || nota > melhor.nota)) melhor = { c, nota };
    }
    if (!melhor) continue;
    usados.add(melhor.c.url || melhor.c.nome);
    const anexos = [...melhor.c.anexos].filter((a) => a.caminho)
      .sort((a, z) => (numeroNoNome(a.nome) - numeroNoNome(z.nome)) || ((a.pos ?? 0) - (z.pos ?? 0)));
    saida.push({ peca: p.id, cartao: melhor.c.nome, anexos });
  }
  return saida;
}

function numeroNoNome(n) {
  const m = /(\d+)(?!.*\d)/.exec(String(n || '').replace(/\.[a-z0-9]+$/i, ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

// ---------------------------------------------------------------------------
// Briefings anexados à mão (Carol, 18/11/2026): quando o robô não acha o briefing novo de um cliente, ela
// anexa o arquivo na demanda de vídeos. Fica em config "r7-briefings" { lista: [{ id, cliente, nome, mes,
// original, texto, em }] } e entra junto com os do robô (o nome do cliente e o mês vão no "arquivo", que é
// por onde a demanda acha o briefing de cada um).
// ---------------------------------------------------------------------------

export function briefingsAnexados(config = []) {
  return config.find((c) => c.chave === 'r7-briefings' && !c.excluido_em)?.valor?.lista || [];
}

export function comBriefingsAnexados(robo, anexados = []) {
  const extras = anexados.map((b) => ({
    arquivo: `Briefing ${b.nome} - ${nomeDoMes(b.mes)}.docx`,
    original: b.original,
    ano: b.mes.slice(0, 4),
    pasta: nomeDoMes(b.mes),
    modificado: b.em,
    texto: b.texto,
    anexado: true,
  }));
  if (!robo && !extras.length) return null;
  return { ...(robo || {}), briefings: [...(robo?.briefings || []), ...extras] };
}

// O briefing do mês anexado substitui o do robô do mesmo cliente e mês (o anexado é o que vale).
export function briefingAnexadoNovo(lista, { cliente, nome, mes, original, texto, em = new Date().toISOString() }) {
  const id = `${cliente}:${mes}`;
  return [...lista.filter((b) => b.id !== id), { id, cliente, nome, mes, original: String(original || '').slice(0, 160), texto: String(texto || '').slice(0, 40000), em }];
}
