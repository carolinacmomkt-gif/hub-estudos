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
