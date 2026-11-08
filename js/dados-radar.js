// Radar do nicho (Trabalho; decisão da Carol, 07/11/2026): o que está subindo em cada nicho nas
// próximas 2 semanas, sem hashtag e sem áudio. Sinais oficiais: vídeos e Shorts do YouTube dos
// últimos 7 dias (visualizações por hora), a velocidade das notícias no Google Notícias, as datas
// da saúde e campanhas do mês, e a IA com pesquisa na web cruzando tudo. Sem DOM: usado pelo app
// e pela função radar-background.

import { areasDoNicho, datasEntre } from './datas-especiais.js';
import { especialidadeDoTexto, especialidade as espPorId } from './especialidades.js';

export const TEMPERATURAS = [
  { id: 'subindo_forte', nome: 'Subindo forte', curto: 'Forte' },
  { id: 'subindo', nome: 'Subindo', curto: 'Subindo' },
  { id: 'data_certa', nome: 'Data certa', curto: 'Data' },
  { id: 'momento', nome: 'Assunto do momento', curto: 'Momento' },
];
const IDS_TEMP = TEMPERATURAS.map((t) => t.id);
export const MAX_PALAVRAS = 6;
const HORA = 3600e3;
const DIA = 24 * HORA;

const limpo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const linkOk = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u).slice(0, 500) : null);
export const idDoNicho = (nome) => semAcento(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'nicho';
export const chaveDoRadar = (id) => `radar:${id}`;

// ---------------------------------------------------------------------------
// Nichos (config "radar" { nichos: [{ id, nome, palavras, clientes }] })
// ---------------------------------------------------------------------------

export function conferirNicho(n) {
  const nome = limpo(n?.nome, 60);
  const palavras = [...new Set((Array.isArray(n?.palavras) ? n.palavras : String(n?.palavras || '').split(/[,\n;]/))
    .map((p) => limpo(p, 60)).filter((p) => p.length >= 2))].slice(0, MAX_PALAVRAS);
  return { id: limpo(n?.id, 40) || idDoNicho(nome), nome, palavras: palavras.length ? palavras : (nome ? [nome] : []), clientes: (n?.clientes || []).map((c) => limpo(c, 80)).filter(Boolean).slice(0, 30) };
}

export function nichosDoRadar(config) {
  const v = (config || []).find((c) => c.chave === 'radar' && !c.excluido_em)?.valor || {};
  return (Array.isArray(v.nichos) ? v.nichos : []).map(conferirNicho).filter((n) => n.nome);
}

// A lista de especialidades (todas as médicas do CFM, áreas de atuação e outras da saúde) fica em
// js/especialidades.js; o Radar usa o nome e as palavras do público de cada uma.
export { ESPECIALIDADES, especialidade, GRUPOS_ESPECIALIDADE, idPeloNome } from './especialidades.js';

// Qual especialidade da lista a ficha da cliente já diz (o nicho escrito), se diz.
export function especialidadeDaCliente(c) {
  return especialidadeDoTexto(c?.dados?.nicho)?.id || '';
}

// Junta as escolhas (cliente → especialidade) nos nichos que já existem: cria o que falta,
// acrescenta e tira clientes. Devolve { nichos, novos } (ids dos nichos criados agora).
export function nichosPelasEscolhas(existentes, escolhas) {
  const nichos = existentes.map((n) => ({ ...n, clientes: n.clientes.filter((c) => !(c in escolhas)) }));
  const novos = [];
  for (const [cliente, esp] of Object.entries(escolhas)) {
    const e = espPorId(esp);
    if (!e) continue;
    let n = nichos.find((x) => x.id === e.id);
    if (!n) { n = conferirNicho({ id: e.id, nome: e.nome, palavras: e.palavras, clientes: [] }); nichos.push(n); novos.push(e.id); }
    if (!n.clientes.includes(cliente)) n.clientes.push(cliente);
  }
  return { nichos, novos };
}

export function sugerirNichos(clientes, ja = []) {
  const usados = new Set(ja.map((n) => n.id));
  const porEsp = new Map();
  for (const c of clientes || []) {
    if (c.excluido_em) continue;
    const e = especialidadeDoTexto(c.dados?.nicho);
    if (!e) continue;
    if (!porEsp.has(e.id)) porEsp.set(e.id, { e, nomes: [] });
    porEsp.get(e.id).nomes.push(c.nome);
  }
  return [...porEsp.values()].map(({ e, nomes }) => conferirNicho({ id: e.id, nome: e.nome, palavras: e.palavras, clientes: nomes }))
    .filter((n) => !usados.has(n.id));
}

// Datas da saúde e campanhas do nicho nas próximas semanas (as "datas certas").
export function datasDoNicho(nicho, hoje, dias = 21) {
  // Nicho de uma especialidade da lista: as áreas dela; nicho à mão: pelo nome e pelas palavras.
  const esp = espPorId(nicho.id);
  const areas = new Set(esp ? [...esp.areas, ...areasDoNicho(nicho.nome)] : areasDoNicho(`${nicho.nome} ${nicho.palavras.join(' ')}`));
  const ate = new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  return datasEntre(inicioMes, ate)
    .filter((d) => d.tipo !== 'feriado' && d.tipo !== 'facultativo')
    .filter((d) => (d.tipo === 'campanha' ? d.data <= ate : d.data >= hoje))
    .filter((d) => (d.areas || []).some((a) => areas.has(a) || (a === 'todas' && areas.size)))
    .map((d) => ({ data: d.data, titulo: d.nome || d.titulo, tipo: d.tipo, conferir: d.conferir || '' }))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Sinais
// ---------------------------------------------------------------------------

// Google Notícias (RSS): título, link, fonte e data de cada item.
const entidade = (t) => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const campo = (item, nome) => entidade((item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`)) || [])[1] || '').trim();

export function lerRss(xml) {
  return [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const fonte = campo(item, 'source');
    let titulo = campo(item, 'title');
    if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3));
    const quando = Date.parse(campo(item, 'pubDate'));
    return { titulo: limpo(titulo, 200), link: linkOk(campo(item, 'link')), fonte: limpo(fonte, 80), data: Number.isFinite(quando) ? new Date(quando).toISOString() : null };
  }).filter((n) => n.titulo && n.link);
}

// Velocidade de um termo: matérias nas últimas 48 h × a média de 48 h dos 5 dias antes.
export function velocidade(noticias, agora = Date.now()) {
  const t = (n) => Date.parse(n.data || 0);
  const recentes = noticias.filter((n) => agora - t(n) <= 2 * DIA).length;
  const antes = noticias.filter((n) => agora - t(n) > 2 * DIA && agora - t(n) <= 7 * DIA).length;
  const base = antes / 2.5; // 5 dias = 2,5 janelas de 48 h
  return { recentes, antes, subida: base ? Math.round((recentes / base) * 10) / 10 : (recentes ? recentes : 0) };
}

// YouTube: visualizações por hora desde a publicação (o que acelera, não o que é só grande).
export function porHora(video, agora = Date.now()) {
  const horas = Math.max(1, (agora - Date.parse(video.publicado)) / HORA);
  return Math.round((Number(video.views) || 0) / horas);
}

// Duração ISO-8601 (PT1M3S) em segundos; até 3 min conta como Short.
export function segundos(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 86400 + (Number(m[2]) || 0) * 3600 + (Number(m[3]) || 0) * 60 + (Number(m[4]) || 0);
}

// ---------------------------------------------------------------------------
// Resultado (o que a IA devolveu, ou o jeito simples sem IA)
// ---------------------------------------------------------------------------

export function conferirRadar(r) {
  const itens = (Array.isArray(r?.itens) ? r.itens : []).map((x) => ({
    tema: limpo(x?.tema, 120),
    temperatura: IDS_TEMP.includes(x?.temperatura) ? x.temperatura : 'subindo',
    porque: limpo(x?.porque, 400),
    janela: limpo(x?.janela, 80),
    formato: limpo(x?.formato, 60),
    gancho: limpo(x?.gancho, 200),
    serve_para: (Array.isArray(x?.serve_para) ? x.serve_para : []).map((c) => limpo(c, 80)).filter(Boolean).slice(0, 8),
    links: (Array.isArray(x?.links) ? x.links : []).map(linkOk).filter(Boolean).slice(0, 4),
  })).filter((x) => x.tema).slice(0, 10);
  const noticias = (Array.isArray(r?.noticias) ? r.noticias : []).map((n) => ({
    titulo: limpo(n?.titulo, 200), link: linkOk(n?.link), fonte: limpo(n?.fonte, 80), porque: limpo(n?.porque, 240), data: limpo(n?.data, 30) || null,
  })).filter((n) => n.titulo && n.link).slice(0, 10);
  const clientes = {};
  for (const c of Array.isArray(r?.clientes) ? r.clientes : []) {
    const nome = limpo(c?.cliente, 80);
    if (!nome) continue;
    clientes[nome] = { sugestoes: (Array.isArray(c?.sugestoes) ? c.sugestoes : []).map(conferirSugestao).filter((x) => x.titulo).slice(0, 4) };
  }
  return { itens, noticias, briefing: limpo(r?.briefing, 900), clientes };
}

export const LINHAS = ['técnico', 'posicionamento', 'conexão', 'venda'];
export function conferirSugestao(x) {
  return {
    titulo: limpo(x?.titulo, 140),
    formato: limpo(x?.formato, 40),
    linha: limpo(x?.linha, 40),
    estrutura: limpo(x?.estrutura, 60),
    gap: limpo(x?.gap, 240),
    gancho: limpo(x?.gancho, 200),
    esqueleto: (Array.isArray(x?.esqueleto) ? x.esqueleto : []).map((e) => limpo(e, 220)).filter(Boolean).slice(0, 10),
    cta: limpo(x?.cta, 160),
    cuidado: limpo(x?.cuidado, 220),
    porque_agora: limpo(x?.porque_agora, 240),
    link: linkOk(x?.link),
    // A notícia de onde a sugestão partiu (o fato vem dela) e o caso contado a partir dela.
    noticia: conferirNoticiaDaSugestao(x?.noticia),
    caso: limpo(x?.caso, 400),
  };
}
function conferirNoticiaDaSugestao(n) {
  const link = linkOk(n?.link);
  const titulo = limpo(n?.titulo, 200);
  return link && titulo ? { titulo, link, fonte: limpo(n?.fonte, 80), data: limpo(n?.data, 30) || null } : null;
}

// As notícias na ordem do que mais cresce: as que acabaram de chegar, depois as do termo que mais
// subiu, depois as mais novas. Cada uma leva a subida do termo dela (para a IA e para a tela).
export function noticiasQueCrescem(noticias = [], termos = []) {
  const subida = new Map(termos.map((t) => [t.termo, t.subida || 0]));
  return noticias.map((n) => ({ ...n, subida: subida.get(n.termo) || 0 }))
    .sort((a, b) => Number(Boolean(b.nova)) - Number(Boolean(a.nova)) || b.subida - a.subida || String(b.data || '').localeCompare(String(a.data || '')));
}

// A sugestão só fica com a notícia se ela veio mesmo dos sinais (o título e a fonte são os nossos,
// não os reescritos pela IA). Sem notícia de verdade, o caso contado sai junto.
export function amarrarNoticias(clientes, noticias) {
  const porLink = new Map(noticias.filter((n) => n.link).map((n) => [n.link, n]));
  const saida = {};
  for (const [nome, c] of Object.entries(clientes || {})) {
    saida[nome] = {
      ...c,
      sugestoes: (c.sugestoes || []).map((x) => {
        const n = x.noticia && porLink.get(x.noticia.link);
        return n ? { ...x, noticia: { titulo: n.titulo, link: n.link, fonte: n.fonte || '', data: n.data || null } } : { ...x, noticia: null, caso: '' };
      }),
    };
  }
  return saida;
}

// Sem IA: os vídeos que mais aceleram, os termos com notícia subindo e as datas do período.
export function radarSimples({ nicho, videos = [], noticias = [], termos = [], datas = [] }) {
  const itens = [];
  for (const d of datas.slice(0, 3)) {
    itens.push({ tema: d.titulo, temperatura: 'data_certa', porque: `${d.tipo === 'campanha' ? 'Campanha do mês' : 'Data da saúde'} em ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}.${d.conferir ? ' Confira antes de postar.' : ''}`, janela: d.tipo === 'campanha' ? 'O mês todo' : 'Na semana da data', formato: '', gancho: '', serve_para: nicho.clientes, links: [] });
  }
  for (const t of termos.filter((x) => x.subida >= 1.5 && x.recentes >= 3).slice(0, 3)) {
    itens.push({ tema: t.termo, temperatura: t.subida >= 3 ? 'subindo_forte' : 'subindo', porque: `${t.recentes} matérias nas últimas 48 h, ${t.subida}× o ritmo dos dias anteriores.`, janela: 'Próximos dias', formato: '', gancho: '', serve_para: nicho.clientes, links: [] });
  }
  for (const v of videos.slice(0, 4)) {
    itens.push({ tema: v.titulo, temperatura: 'subindo', porque: `${v.porHora.toLocaleString('pt-BR')} visualizações por hora no YouTube (${v.canal}).`, janela: 'Esta semana', formato: v.short ? 'Reels' : '', gancho: '', serve_para: nicho.clientes, links: [v.link] });
  }
  // Sem IA, uma sugestão-base por cliente a partir da notícia que mais cresce e do que mais subiu
  // (para ela completar o caso e o desenvolvimento).
  const topo = noticiasQueCrescem(noticias, termos)[0];
  const daNoticia = topo ? [{
    titulo: topo.titulo, formato: 'Reels falado', linha: 'conexão', estrutura: 'Pergunta aberta',
    gap: 'crença comum: [complete] / realidade: [complete]', gancho: '', esqueleto: [], cta: 'Comenta o que você faria', cuidado: '',
    porque_agora: `${topo.nova ? 'Notícia que acabou de sair' : 'Notícia do momento'}${topo.subida >= 1.5 ? `; o assunto subiu ${String(topo.subida).replace('.', ',')}× em 48 h` : ''}.`,
    link: topo.link, noticia: topo, caso: '[conte o caso da notícia como uma situação próxima de quem lê]',
  }] : [];
  const base = itens.slice(0, 2 - Math.min(1, daNoticia.length));
  const clientes = nicho.clientes.map((cliente) => ({
    cliente,
    sugestoes: [...daNoticia, ...base.map((x) => ({
      titulo: x.tema, formato: x.formato || 'Carrossel', linha: 'técnico', estrutura: x.temperatura === 'data_certa' ? 'Linear clássica' : 'Alerta',
      gap: 'crença comum: [complete] / realidade: [complete]', gancho: '', esqueleto: [], cta: 'Salve para lembrar', cuidado: '', porque_agora: x.porque, link: x.links?.[0] || null,
    }))],
  }));
  return conferirRadar({ itens, noticias: noticias.slice(0, 8).map((n) => ({ ...n, porque: '' })), briefing: '', clientes });
}

// O relatório está velho? (mais de 3 dias, ou de antes da segunda desta semana: o briefing é semanal)
export function segundaDaSemana(agora = Date.now(), fuso = 'America/Sao_Paulo') {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date(agora));
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function radarVelho(r, agora = Date.now()) {
  if (!r?.gerado_em) return true;
  const quando = Date.parse(r.gerado_em);
  return agora - quando > 3 * DIA || new Date(quando).toISOString().slice(0, 10) < segundaDaSemana(agora);
}

// ---------------------------------------------------------------------------
// Histórico de notícias (14 dias) e o que é novo para cada cliente
// ---------------------------------------------------------------------------

export const idDaNoticia = (n) => semAcento(n.titulo).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);

// Junta as notícias novas às guardadas: cada uma lembra quando apareceu pela primeira vez.
export function mesclarNoticias(guardadas = [], novas = [], agora = Date.now()) {
  const porId = new Map();
  for (const n of guardadas) if (n?.id) porId.set(n.id, n);
  for (const n of novas) {
    const id = idDaNoticia(n);
    if (!id) continue;
    const antes = porId.get(id);
    porId.set(id, antes ? { ...antes, termo: antes.termo || n.termo } : { ...n, id, primeiro_em: new Date(agora).toISOString() });
  }
  const limite = agora - 14 * DIA;
  return [...porId.values()]
    .filter((n) => Date.parse(n.data || n.primeiro_em) >= limite)
    .sort((a, b) => String(b.data || b.primeiro_em).localeCompare(String(a.data || a.primeiro_em)))
    .slice(0, 120);
}

export const chaveDoVisto = (nicho, cliente = '') => `${nicho}|${cliente}`;
export function vistosDoRadar(config) {
  return (config || []).find((c) => c.chave === 'radar_visto' && !c.excluido_em)?.valor || {};
}
// Notícias que chegaram depois da última vez que ela marcou a caixa como vista.
export function novasDesde(noticias = [], visto, inicio = null) {
  const t = Math.max(visto ? Date.parse(visto) : 0, inicio ? Date.parse(inicio) : 0);
  return noticias.filter((n) => Date.parse(n.primeiro_em || 0) > t);
}

// Disparou? Muitas notícias novas de uma vez ou um termo acelerando forte.
export function disparo(novas = [], termos = []) {
  const forte = termos.find((t) => t.subida >= 2.5 && t.recentes >= 4);
  if (novas.length >= 3 || forte) return { termo: forte?.termo || novas[0]?.termo || '', quantas: novas.length };
  return null;
}

// ---------------------------------------------------------------------------
// Exportar: texto para o WhatsApp e para o Notion
// ---------------------------------------------------------------------------

const fmtCurto = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function textoDoRadar(nicho, r, { formato = 'whatsapp', cliente = null } = {}) {
  const md = formato === 'notion';
  const t1 = (x) => (md ? `# ${x}` : `*${x}*`);
  const t2 = (x) => (md ? `## ${x}` : `*${x}*`);
  const t3 = (x) => (md ? `### ${x}` : `_${x}_`);
  const linhas = [t1(`Radar · ${nicho.nome}${cliente ? ` · ${cliente}` : ''}`)];
  if (r?.gerado_em) linhas.push(`Atualizado em ${fmtCurto(r.gerado_em)}`);
  if (r?.briefing) linhas.push('', t2('Briefing da semana'), r.briefing);
  if (r?.itens?.length) {
    linhas.push('', t2('Vai bombar nas próximas 2 semanas'));
    for (const x of r.itens) linhas.push(`- ${x.tema} (${(TEMPERATURAS.find((t) => t.id === x.temperatura) || TEMPERATURAS[1]).nome}${x.janela ? `, ${x.janela}` : ''}): ${x.porque}`);
  }
  const nomes = cliente ? [cliente] : Object.keys(r?.clientes || {});
  for (const nome of nomes) {
    const sug = r?.clientes?.[nome]?.sugestoes || [];
    if (!sug.length) continue;
    linhas.push('', t2(`Sugestões para ${nome}`));
    sug.forEach((x, i) => {
      linhas.push('', t3(`${i + 1}. ${x.titulo}`));
      linhas.push(`${[x.formato, x.linha, x.estrutura].filter(Boolean).join(' · ')}`);
      if (x.noticia) linhas.push(md ? `Partiu da notícia: [${x.noticia.titulo}](${x.noticia.link})${x.noticia.fonte ? ` · ${x.noticia.fonte}` : ''}` : `Partiu da notícia: ${x.noticia.titulo}${x.noticia.fonte ? ` (${x.noticia.fonte})` : ''} ${x.noticia.link}`);
      if (x.caso) linhas.push(`O caso: ${x.caso}`);
      if (x.gap) linhas.push(`Gap: ${x.gap}`);
      if (x.gancho) linhas.push(`Gancho: ${x.gancho}`);
      x.esqueleto.forEach((e, j) => linhas.push(`${j + 1}) ${e}`));
      if (x.cta) linhas.push(`CTA: ${x.cta}`);
      if (x.cuidado) linhas.push(`Cuidado: ${x.cuidado}`);
      if (x.porque_agora) linhas.push(`Por que agora: ${x.porque_agora}`);
    });
  }
  const noticias = (r?.noticias_hist || r?.noticias || []).slice(0, 12);
  if (noticias.length) {
    linhas.push('', t2('Notícias'));
    for (const n of noticias) linhas.push(md ? `- [${n.titulo}](${n.link}) · ${n.fonte || ''} ${fmtCurto(n.data)}` : `- ${n.titulo} (${n.fonte || 'fonte'}, ${fmtCurto(n.data)}) ${n.link}`);
  }
  return linhas.join('\n');
}
