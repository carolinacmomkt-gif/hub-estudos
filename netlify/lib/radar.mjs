// Radar do nicho: junta os sinais oficiais (YouTube dos últimos 7 dias, Google Notícias, datas do
// período), guarda o histórico de notícias (14 dias, lembrando quando cada uma apareceu) e pede à
// IA, com pesquisa na web, o que está subindo e as sugestões de conteúdo por cliente, no método da
// Carol (metodo-essence.mjs). Roda sozinho (radar-agendado) e avisa no celular.
// Endereços trocáveis para os testes: YOUTUBE_BASE_URL e NOTICIAS_BASE_URL.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { pedirJson, lista, objeto, texto, ErroIa } from './ia-comum.mjs';
import { banco } from './supabase.mjs';
import { enviarPush } from './avisos.mjs';
import { configVida, emSilencio } from './avisos-vida.mjs';
import { METODO, metodoDoNicho } from './metodo-essence.mjs';
import { revisarTextos, textosDoRadar, aplicarNoRadar, REGRAS_DA_VOZ } from './revisao-texto.mjs';
import {
  TEMPERATURAS, LINHAS, conferirNicho, nichosDoRadar, chaveDoRadar, datasDoNicho, lerRss, velocidade, porHora, segundos, conferirRadar,
  radarSimples, mesclarNoticias, disparo, noticiasQueCrescem, amarrarNoticias, ehUrgente,
} from '../../js/dados-radar.js';
import { especialidade, especialidadeDoTexto, palavrasEmIngles } from '../../js/especialidades.js';

const DIA = 864e5;
const HORA = 3600e3;
const FUSO = 'America/Sao_Paulo';
const baseYoutube = () => (process.env.YOUTUBE_BASE_URL || 'https://www.googleapis.com/youtube/v3').replace(/\/+$/, '');
const baseNoticias = () => (process.env.NOTICIAS_BASE_URL || 'https://news.google.com').replace(/\/+$/, '');
const diaEm = (agora) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(agora));
const horaEm = (agora) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(agora)).split(':').map(Number);
  return { h, min: h * 60 + m };
};

async function pedir(url, { json = true, ms = 12000 } = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'Bussola-Radar/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

// ---------------------------------------------------------------------------
// Sinais
// ---------------------------------------------------------------------------

// Vídeos e Shorts dos últimos 7 dias (decisão da Carol, 08/11/2026): do Brasil (em português) e
// dos EUA (em inglês); de outro país só quando explode (3× o mais rápido do Brasil e dos EUA).
// Cada busca custa 100 da cota diária de 10.000 da YouTube Data API: até 4 buscas (as palavras vão
// juntas com "|", o OU do YouTube), mais 1 para os vídeos e 1 para o país dos canais.
export const FATOR_MUNDO = 3;
export async function buscarYoutube(palavras, agora = Date.now(), { ingles = [] } = {}) {
  const chave = process.env.YOUTUBE_API_KEY;
  if (!chave) return { videos: [], aviso: 'Sem a chave do YouTube (YOUTUBE_API_KEY na Netlify): o radar usou só as notícias, as datas e a pesquisa na web.' };
  const depois = new Date(agora - 7 * DIA).toISOString();
  const ou = (lista) => lista.map((p) => (/\s/.test(p) ? `"${p}"` : p)).join('|');
  const buscas = [
    { origem: 'BR', q: ou(palavras.slice(0, 3)), regionCode: 'BR', relevanceLanguage: 'pt' },
    palavras.length > 3 && { origem: 'BR', q: ou(palavras.slice(3, 6)), regionCode: 'BR', relevanceLanguage: 'pt' },
    ingles.length && { origem: 'US', q: ou(ingles.slice(0, 3)), regionCode: 'US', relevanceLanguage: 'en' },
    ingles.length && { origem: 'mundo', q: ou(ingles.slice(0, 3)) },
  ].filter((x) => x && x.q);
  const origem = new Map();
  for (const { origem: o, ...filtro } of buscas) {
    const q = new URLSearchParams({ part: 'id', type: 'video', order: 'viewCount', publishedAfter: depois, maxResults: '15', key: chave, ...filtro });
    const r = await pedir(`${baseYoutube()}/search?${q}`);
    for (const it of r.items || []) if (it.id?.videoId && !origem.has(it.id.videoId)) origem.set(it.id.videoId, o);
  }
  if (!origem.size) return { videos: [] };
  const q = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: [...origem.keys()].slice(0, 50).join(','), key: chave });
  const r = await pedir(`${baseYoutube()}/videos?${q}`);
  // O país do canal (quando o canal informa); sem ele, vale a busca de onde o vídeo veio.
  const canais = [...new Set((r.items || []).map((v) => v.snippet?.channelId).filter(Boolean))].slice(0, 50);
  const paisDoCanal = new Map();
  if (canais.length) {
    try {
      const c = await pedir(`${baseYoutube()}/channels?${new URLSearchParams({ part: 'snippet', id: canais.join(','), key: chave })}`);
      for (const it of c.items || []) if (it.snippet?.country) paisDoCanal.set(it.id, String(it.snippet.country).toUpperCase());
    } catch (erro) {
      console.warn('radar youtube canais:', erro?.message);
    }
  }
  const todos = (r.items || []).map((v) => {
    const short = segundos(v.contentDetails?.duration) <= 180;
    const o = origem.get(v.id);
    const pais = paisDoCanal.get(v.snippet?.channelId) || (o === 'mundo' ? '' : o);
    const video = {
      titulo: String(v.snippet?.title || '').slice(0, 160), canal: String(v.snippet?.channelTitle || '').slice(0, 80),
      publicado: v.snippet?.publishedAt, views: Number(v.statistics?.viewCount) || 0, short, pais,
      link: short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    };
    return { ...video, porHora: porHora(video, agora) };
  });
  const daqui = todos.filter((v) => v.pais === 'BR' || v.pais === 'US');
  const teto = Math.max(0, ...daqui.map((v) => v.porHora));
  const deFora = todos.filter((v) => v.pais !== 'BR' && v.pais !== 'US' && teto > 0 && v.porHora >= FATOR_MUNDO * teto)
    .map((v) => ({ ...v, fora: true }));
  const videos = [...daqui, ...deFora].sort((a, b) => b.porHora - a.porHora);
  return { videos: videos.slice(0, 12) };
}

// Google Notícias por palavra-chave (RSS público, as palavras em paralelo): as matérias da semana
// e a velocidade de cada termo.
export async function buscarNoticias(palavras, agora = Date.now()) {
  const respostas = await Promise.all(palavras.map(async (p) => {
    const q = new URLSearchParams({ q: `"${p}" when:7d`, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
    try {
      return { p, itens: lerRss(await pedir(`${baseNoticias()}/rss/search?${q}`, { json: false, ms: 8000 })) };
    } catch (erro) {
      console.warn('radar notícias:', p, erro?.message);
      return { p, itens: [] };
    }
  }));
  const todas = new Map();
  const termos = [];
  for (const { p, itens } of respostas) {
    termos.push({ termo: p, ...velocidade(itens, agora) });
    for (const n of itens) if (!todas.has(n.titulo)) todas.set(n.titulo, { ...n, termo: p });
  }
  const noticias = [...todas.values()].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 40);
  return { noticias, termos: termos.sort((a, b) => b.subida - a.subida) };
}

// ---------------------------------------------------------------------------
// Linha do radar (config "radar:<nicho>")
// ---------------------------------------------------------------------------

async function lerLinha(userId, id) {
  const [linha] = await banco.listar('config', userId, `chave=eq.${encodeURIComponent(chaveDoRadar(id))}`);
  return linha?.valor || {};
}
const gravarLinha = (userId, id, valor) => banco.gravar('config', [{ user_id: userId, chave: chaveDoRadar(id), valor, excluido_em: null }], 'user_id,chave');

// Notícias (leve, a cada 2 h): junta ao histórico e devolve as que chegaram agora.
export async function atualizarNoticias(userId, nicho, agora = Date.now()) {
  const antes = await lerLinha(userId, nicho.id);
  const { noticias, termos } = await buscarNoticias(nicho.palavras, agora);
  const conhecidas = new Set((antes.noticias_hist || []).map((n) => n.id));
  const hist = mesclarNoticias(antes.noticias_hist || [], noticias, agora);
  const novas = hist.filter((n) => !conhecidas.has(n.id));
  // A primeira leitura não conta como "novidade" (é o histórico chegando).
  const primeira = !antes.noticias_em;
  const atual = await lerLinha(userId, nicho.id); // a análise pode ter gravado no meio
  await gravarLinha(userId, nicho.id, {
    ...atual, noticias_hist: hist, termos, noticias_em: new Date(agora).toISOString(),
    // Desde quando o radar olha: o que já existia na primeira leitura não é "novo".
    inicio_em: atual.inicio_em || new Date(agora).toISOString(),
  });
  return { novas: primeira ? [] : novas, termos, hist };
}

// ---------------------------------------------------------------------------
// A análise da IA, com o método da Carol
// ---------------------------------------------------------------------------

const SYSTEM = `Você é o radar de conteúdo da Carol, social media de uma agência de marketing para médicos e profissionais da saúde.
Para um nicho, você aponta o que está subindo e vale postar nas próximas 2 semanas, cruzando os sinais que o app juntou (vídeos e Shorts do YouTube do Brasil e dos EUA com visualizações por hora, mais algum de outro país só quando explodiu (fora_do_brasil_e_eua), notícias do Google Notícias com a velocidade de cada termo, datas da saúde e campanhas) com uma pesquisa na web sua sobre o que veículos e criadores brasileiros estão comentando e as perguntas que as pessoas estão fazendo.
Depois, para cada cliente do nicho, você sugere conteúdos prontos para produzir, no método de criação abaixo, usando a ficha e a memória de feedback da cliente.
Regras do radar:
- Só aponte o que os sinais ou a sua pesquisa mostram. Não invente números nem tendências. Não prometa que algo vai viralizar.
- Nada de hashtag e nada de áudio em alta.
- temperatura: subindo_forte (acelerando rápido agora), subindo, data_certa (data ou campanha no período) ou momento (assunto que todo mundo está comentando).
- porque: 1 ou 2 frases com o sinal concreto (ex.: "3 Shorts com mais de 2 mil visualizações por hora", "notícias dobraram em 48 h").
- janela: até quando criar e postar ("Crie até 12/11, poste até 14/11").
- links: só endereços que vieram dos sinais ou da sua pesquisa.
- noticias: as até 8 notícias que mais importam para o nicho agora, com porque importa em uma frase.
- briefing: 3 a 5 frases para a semana, direto ao ponto.
Regras das sugestões (2 ou 3 por cliente, diferentes entre si em formato e linha editorial):
- formato: Carrossel, Reels falado, Reels de texto na tela, Stories ou Post. linha: ${LINHAS.join(', ')}. estrutura: a estrutura de exibição do método.
- gap em uma linha (crença comum / realidade), gancho pronto, esqueleto (os slides do carrossel ou os blocos do Reels, um item por slide ou bloco, já escrito na fala contada), cta ligado ao objetivo, cuidado (norma do conselho ou do nicho) e porque_agora (o sinal do radar que justifica postar agora, com o link em link).
- Parta das notícias que mais estão crescendo (a lista vem na ordem: as que acabaram de chegar e as do termo que mais subiu primeiro; "subida" é quantas vezes o termo acelerou em 48 h). Pelo menos 2 das sugestões de cada cliente saem de UMA notícia específica da lista: em noticia, copie o titulo e o link exatamente como vieram. A outra pode sair de uma data, de um vídeo em alta ou da sua pesquisa (aí noticia fica vazia).
- caso: o fato da notícia contado como uma situação próxima de quem lê, para a pessoa se ver nele (ex. de espírito, não de fórmula: uma notícia sobre uma noiva que pediu para a amiga engordar para o casamento vira "imagina se a sua amiga te pedisse para engordar 54 quilos para o casamento dela, o que você faria?"). Varie o jeito de abrir: pergunta, cena, "aconteceu essa semana", confissão de quem atende, número da notícia. Nunca repita a mesma abertura nas sugestões. O gancho sai do caso.
- Depois do caso, o esqueleto desenvolve o assunto pela especialidade da cliente: o que ela explicaria sobre aquele caso, com o medo e o desejo do público do nicho, a estrutura de exibição e o cuidado do conselho.
- O fato vem só da notícia: não acrescente detalhe que ela não diz. Não exponha nem julgue a pessoa da notícia (nada de nome de quem não é figura pública, nada de deboche), nada de sensacionalismo.
- prazo: a data limite para postar (AAAA-MM-DD). A produção da Carol é mensal: só entra no meio da produção o que é URGENTE, e urgente é só o que perde o sentido se esperar a próxima produção (notícia quente do momento, data da saúde ou campanha em até 3 dias). Para essas, prazo em até 3 dias a partir de hoje. Para o resto, prazo mais longe (o fim do mês seguinte, ou a data da campanha). Não force urgência: na maioria das semanas, nenhuma ou uma sugestão por cliente é urgente.
- Respeite a ficha e a memória da cliente (o que ela já pediu, o que não gosta). Nunca invente caso de paciente, número ou depoimento: use [espaço para preencher].
Português do Brasil. Entre 4 e 8 itens no radar.

${METODO}`;

const ESQUEMA = objeto({
  itens: lista('O que vai subir nas próximas 2 semanas', objeto({
    tema: texto, temperatura: { type: 'string', enum: TEMPERATURAS.map((t) => t.id) }, porque: texto, janela: texto,
    formato: texto, gancho: texto, serve_para: lista('Clientes', texto), links: lista('Links', texto),
  })),
  noticias: lista('Notícias em alta', objeto({ titulo: texto, link: texto, fonte: texto, porque: texto, data: texto })),
  briefing: texto,
  clientes: lista('Sugestões por cliente', objeto({
    cliente: texto,
    sugestoes: lista('Sugestões de conteúdo', objeto({
      titulo: texto, formato: texto, linha: texto, estrutura: texto, gap: texto, gancho: texto,
      esqueleto: lista('Slides ou blocos', texto), cta: texto, cuidado: texto, porque_agora: texto, link: texto,
      noticia: objeto({ titulo: texto, link: texto }), caso: texto, prazo: texto,
    })),
  })),
});

export async function analisarComIa({ nicho, hoje, videos, noticias, termos, datas, clientes }, { cliente } = {}) {
  const pedido = {
    hoje, nicho: { nome: nicho.nome, palavras: nicho.palavras },
    clientes: clientes.map((c) => ({ nome: c.nome, nicho: c.nicho, ficha: c.ficha, memoria: c.memoria })),
    datas, termos,
    videos: videos.map((v) => ({ titulo: v.titulo, canal: v.canal, pais: v.pais || 'outro', fora_do_brasil_e_eua: Boolean(v.fora), por_hora: v.porHora, short: v.short, link: v.link })),
    noticias: noticiasQueCrescem(noticias, termos).slice(0, 25).map((n) => ({ titulo: n.titulo, fonte: n.fonte, data: n.data, link: n.link, nova: Boolean(n.nova), termo: n.termo, subida: n.subida })),
  };
  const r = await pedirJson({
    system: `${SYSTEM}\n\n${metodoDoNicho(nicho)}\n\nANTES DE ENTREGAR, releia cada gancho, caso, slide, CTA e o briefing. Português do Brasil correto (crase, concordância, vírgula, acentuação) e nenhuma estrutura proibida:\n${REGRAS_DA_VOZ}`, conteudo: JSON.stringify(pedido), esquema: ESQUEMA, maxTokens: 16000, esforco: 'medium', cliente,
    ferramentas: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'BR' } }],
  });
  const radar = conferirRadar(r);
  const amarrado = { ...radar, clientes: amarrarNoticias(radar.clientes, noticias) };
  // A volta de revisão: estruturas proibidas e português (o travessão que sobrar sai sem IA).
  const saude = especialidade(nicho.id)?.grupo !== 'negocios';
  return aplicarNoRadar(amarrado, await revisarTextos(textosDoRadar(amarrado), { saude, cliente }));
}

// Ficha e memória das clientes do nicho (para as sugestões).
async function clientesDoNicho(userId, nicho) {
  const todas = await banco.listar('clientes_trabalho', userId, 'excluido_em=is.null').catch(() => []);
  return nicho.clientes.slice(0, 6).map((nome) => {
    const c = todas.find((x) => x.nome === nome);
    return {
      nome, nicho: String(c?.dados?.nicho || '').slice(0, 80),
      ficha: String(c?.dados?.ficha || '').slice(0, 1800),
      memoria: (c?.dados?.memoria || []).map((m) => String(m.texto || '').slice(0, 200)).filter(Boolean).slice(0, 8),
    };
  });
}

// Monta o radar de um nicho (notícias + YouTube + IA) e grava em config "radar:<id>".
export async function montarRadar(userId, pedido, agora = Date.now()) {
  const nicho = conferirNicho(pedido);
  if (!nicho.nome || !/^[a-z0-9-]{1,40}$/.test(nicho.id)) return { ok: false };
  const antes = await lerLinha(userId, nicho.id);
  await gravarLinha(userId, nicho.id, { ...antes, status: 'lendo', pedido_em: new Date(agora).toISOString(), erro: null });
  const hoje = diaEm(agora);
  const avisos = [];
  try {
    let videos = [];
    try {
      const y = await buscarYoutube(nicho.palavras, agora, { ingles: palavrasEmIngles(especialidade(nicho.id)?.id || especialidadeDoTexto(nicho.nome)?.id) });
      videos = y.videos;
      if (y.aviso) avisos.push(y.aviso);
    } catch (erro) {
      avisos.push('O YouTube não respondeu agora; o radar seguiu sem ele.');
      console.warn('radar youtube:', erro?.message);
    }
    const { novas, termos, hist } = await atualizarNoticias(userId, nicho, agora);
    const idsNovas = new Set(novas.map((n) => n.id));
    const noticias = hist.slice(0, 30).map((n) => ({ ...n, nova: idsNovas.has(n.id) }));
    const datas = datasDoNicho(nicho, hoje);
    const clientes = await clientesDoNicho(userId, nicho);
    let resultado;
    let fonte = 'ia';
    try {
      resultado = await analisarComIa({ nicho, hoje, videos, noticias, termos, datas, clientes });
      if (!resultado.itens.length) throw new ErroIa('A IA não achou nada.');
      // "Serve para" e as sugestões só com as clientes do nicho.
      const nomes = new Set(nicho.clientes);
      resultado.itens = resultado.itens.map((x) => ({ ...x, serve_para: x.serve_para.filter((c) => nomes.has(c)) }));
      resultado.clientes = Object.fromEntries(Object.entries(resultado.clientes || {}).filter(([nome]) => nomes.has(nome)));
    } catch (erro) {
      fonte = 'simples';
      avisos.push(erro instanceof ErroIa ? `${erro.message} Mostrando os sinais sem a análise.` : 'A IA não respondeu agora. Mostrando os sinais sem a análise.');
      if (!(erro instanceof ErroIa)) console.error('radar ia:', erro?.message);
      resultado = radarSimples({ nicho, videos, noticias, termos, datas, hoje });
    }
    const atual = await lerLinha(userId, nicho.id);
    await gravarLinha(userId, nicho.id, {
      ...atual, status: 'pronto', erro: null, gerado_em: new Date().toISOString(), fonte, avisos,
      nicho: nicho.nome, ...resultado, videos: videos.slice(0, 8), termos, datas,
    });
    // Aviso só do que é urgente (prazo em até 3 dias): o resto vai para a próxima produção.
    const urgentes = Object.entries(resultado.clientes || {}).flatMap(([cliente, c]) => (c.sugestoes || []).filter((x) => ehUrgente(x, hoje)).map((x) => ({ ...x, cliente })));
    await avisarDoRadar(userId, [{ tipo: 'urgente', nicho, itens: urgentes }], agora).catch((e) => console.warn('radar push:', e?.message));
    return { ok: true };
  } catch (erro) {
    console.error('radar:', erro?.message);
    const atual = await lerLinha(userId, nicho.id).catch(() => antes);
    await gravarLinha(userId, nicho.id, { ...atual, status: 'erro', erro: 'Não consegui montar o radar agora. Tente de novo em alguns minutos.' }).catch(() => {});
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Avisos no celular (liga/desliga em Configurações → Avisos, respeita o silêncio)
// ---------------------------------------------------------------------------

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const paraQuem = (nicho) => (nicho.clientes.length ? ` Para ${nicho.clientes.slice(0, 3).join(', ')}${nicho.clientes.length > 3 ? '…' : ''}.` : '');

export function notificacoesDoRadar(eventos, hoje) {
  const saida = [];
  for (const e of eventos) {
    if (e.tipo === 'disparo') {
      saida.push({
        chave: `radar:disparo:${e.nicho.id}:${hoje}:${e.termo || e.quantas}`,
        titulo: `Radar · ${e.nicho.nome}`,
        texto: `${plural(e.quantas, 'notícia nova', 'notícias novas')}${e.termo ? ` sobre ${e.termo}` : ''} nas últimas horas.${paraQuem(e.nicho)} Dá tempo de criar.`,
        tag: `radar-${e.nicho.id}`, url: `/#radar/${e.nicho.id}`,
      });
    }
    if (e.tipo === 'urgente') {
      for (const x of e.itens.slice(0, 3)) {
        saida.push({
          chave: `radar:urgente:${e.nicho.id}:${hoje}:${x.cliente}:${x.titulo.slice(0, 40)}`,
          titulo: `Urgente para ${x.cliente}`,
          texto: `${x.titulo}. Poste até ${x.prazo.slice(8, 10)}/${x.prazo.slice(5, 7)}: entra na produção atual.`,
          tag: `radar-urgente-${e.nicho.id}`, url: `/#radar/${e.nicho.id}`,
        });
      }
    }
    if (e.tipo === 'manha') {
      saida.push({
        chave: `radar:manha:${hoje}`,
        titulo: 'Radar da manhã',
        texto: e.linhas.slice(0, 4).join('\n'),
        tag: 'radar-manha', url: '/#radar',
      });
    }
  }
  return saida;
}

export async function avisarDoRadar(userId, eventos, agora = Date.now()) {
  const [[cfgAvisos], [marca], assinaturas] = await Promise.all([
    banco.listar('config', userId, 'chave=eq.avisos').catch(() => []),
    banco.listar('config', userId, 'chave=eq.radar_avisos_enviados').catch(() => []),
    banco.listar('assinaturas_push', userId, 'excluido_em=is.null').catch(() => []),
  ]);
  const vida = configVida(cfgAvisos?.valor?.vida);
  if (vida.radar?.ativo === false || !assinaturas.length) return 0;
  if (emSilencio(horaEm(agora).min, vida.silencio)) return 0;
  const hoje = diaEm(agora);
  const enviados = new Set(marca?.valor?.chaves || []);
  const lista = notificacoesDoRadar(eventos, hoje).filter((n) => !enviados.has(n.chave));
  if (!lista.length) return 0;
  const entregues = new Set();
  for (const a of assinaturas) {
    for (const n of lista) {
      const r = await enviarPush(a, { titulo: n.titulo, texto: n.texto, tag: n.tag, url: n.url });
      if (r === 'expirada') { await banco.apagar('assinaturas_push', `user_id=eq.${userId}&id=eq.${a.id}`); break; }
      if (r === 'ok') entregues.add(n.chave);
    }
  }
  if (entregues.size) {
    const ontem = diaEm(agora - DIA);
    const recentes = [...enviados].filter((c) => c.includes(`:${hoje}`) || c.includes(`:${ontem}`));
    await banco.gravar('config', [{ user_id: userId, chave: 'radar_avisos_enviados', valor: { chaves: [...new Set([...recentes, ...entregues])] } }], 'user_id,chave');
  }
  return entregues.size;
}

// ---------------------------------------------------------------------------
// Sozinho (radar-agendado, de hora em hora): notícias a cada 2 h das 7h às 21h, a análise às
// 6h30 (ou de novo no dia, se uma notícia disparar) e o resumo das 8h.
// ---------------------------------------------------------------------------

// Assinatura para a função agendada chamar a radar-background em nome da Carol (sem login).
export function assinarInterno(userId, nichoId, quando = Date.now()) {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TOKEN_CRYPTO_KEY || '';
  return `${quando}.${createHmac('sha256', segredo).update(`radar|${userId}|${nichoId}|${quando}`).digest('hex')}`;
}
export function conferirInterno(assinatura, userId, nichoId, agora = Date.now()) {
  const [quando] = String(assinatura || '').split('.');
  if (!quando || Math.abs(agora - Number(quando)) > 10 * 60e3) return false;
  const esperado = Buffer.from(assinarInterno(userId, nichoId, Number(quando)));
  const veio = Buffer.from(String(assinatura));
  return esperado.length === veio.length && timingSafeEqual(esperado, veio);
}

async function pedirAnalise(userId, nicho) {
  // BUSSOLA_URL_INTERNA só nos testes; na Netlify vale o endereço do site (URL).
  const base = (process.env.BUSSOLA_URL_INTERNA || process.env.URL || process.env.DEPLOY_URL || '').replace(/\/+$/, '');
  if (!base) return;
  await fetch(`${base}/.netlify/functions/radar-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bussola-interno': assinarInterno(userId, nicho.id) },
    body: JSON.stringify({ usuaria: userId, nicho }),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => console.warn('radar: não deu para pedir a análise:', e?.message));
}

export async function rodarRadarAgendado(userId, agora = Date.now()) {
  const [linhaCfg] = await banco.listar('config', userId, 'chave=eq.radar').catch(() => []);
  const nichos = nichosDoRadar(linhaCfg ? [linhaCfg] : []);
  if (!nichos.length) return { nichos: 0 };
  const { h } = horaEm(agora);
  const hoje = diaEm(agora);
  const eventos = [];
  await Promise.all(nichos.map(async (nicho) => {
    const r = await lerLinha(userId, nicho.id);
    let disparou = null;
    if (h >= 7 && h <= 21 && agora - Date.parse(r.noticias_em || 0) >= 115 * 60e3) {
      const { novas, termos } = await atualizarNoticias(userId, nicho, agora);
      disparou = disparo(novas, termos);
      // A notícia que disparou só pede uma análise nova; o aviso sai depois, se virar algo urgente.
    }
    const analisadoHoje = r.gerado_em && diaEm(Date.parse(r.gerado_em)) === hoje;
    const lendo = r.status === 'lendo' && agora - Date.parse(r.pedido_em || 0) < 20 * 60e3;
    const deManha = h >= 6 && !analisadoHoje;
    const deNovo = disparou && h >= 7 && h <= 20 && agora - Date.parse(r.gerado_em || 0) >= 6 * HORA;
    if (!lendo && (deManha || deNovo)) await pedirAnalise(userId, nicho);
  }));
  // Resumo das 8h: o que chegou nas últimas 24 h, por nicho.
  if (h === 8) {
    const linhas = [];
    for (const nicho of nichos) {
      const r = await lerLinha(userId, nicho.id);
      // Só as urgentes (prazo em até 3 dias), com as clientes.
      const urg = Object.entries(r.clientes || {}).flatMap(([cliente, c]) => (c.sugestoes || []).filter((x) => ehUrgente(x, hoje)).map(() => cliente));
      if (urg.length) linhas.push(`${nicho.nome}: ${plural(urg.length, 'urgente', 'urgentes')} para ${[...new Set(urg)].join(', ')}`);
    }
    if (linhas.length) eventos.push({ tipo: 'manha', linhas });
  }
  if (eventos.length) await avisarDoRadar(userId, eventos, agora).catch((e) => console.warn('radar push:', e?.message));
  return { nichos: nichos.length, eventos: eventos.length };
}
