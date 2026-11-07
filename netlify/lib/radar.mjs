// Radar do nicho: junta os sinais oficiais (YouTube dos últimos 7 dias, Google Notícias, datas do
// período) e pede à IA, com pesquisa na web, o que está subindo para as próximas 2 semanas.
// Endereços trocáveis para os testes: YOUTUBE_BASE_URL e NOTICIAS_BASE_URL.

import { pedirJson, lista, objeto, texto, ErroIa } from './ia-comum.mjs';
import { banco } from './supabase.mjs';
import {
  TEMPERATURAS, conferirNicho, chaveDoRadar, datasDoNicho, lerRss, velocidade, porHora, segundos, conferirRadar, radarSimples,
} from '../../js/dados-radar.js';

const DIA = 864e5;
const baseYoutube = () => (process.env.YOUTUBE_BASE_URL || 'https://www.googleapis.com/youtube/v3').replace(/\/+$/, '');
const baseNoticias = () => (process.env.NOTICIAS_BASE_URL || 'https://news.google.com').replace(/\/+$/, '');

async function pedir(url, { json = true } = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Bussola-Radar/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

// Vídeos e Shorts em português dos últimos 7 dias, pelas palavras do nicho (até 3 buscas: cada
// busca custa 100 da cota diária de 10.000 da YouTube Data API).
export async function buscarYoutube(palavras, agora = Date.now()) {
  const chave = process.env.YOUTUBE_API_KEY;
  if (!chave) return { videos: [], aviso: 'Sem a chave do YouTube (YOUTUBE_API_KEY na Netlify): o radar usou só as notícias, as datas e a pesquisa na web.' };
  const depois = new Date(agora - 7 * DIA).toISOString();
  const ids = new Set();
  for (const p of palavras.slice(0, 3)) {
    const q = new URLSearchParams({ part: 'id', q: p, type: 'video', order: 'viewCount', publishedAfter: depois, regionCode: 'BR', relevanceLanguage: 'pt', maxResults: '12', key: chave });
    const r = await pedir(`${baseYoutube()}/search?${q}`);
    for (const it of r.items || []) if (it.id?.videoId) ids.add(it.id.videoId);
  }
  if (!ids.size) return { videos: [] };
  const q = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: [...ids].slice(0, 50).join(','), key: chave });
  const r = await pedir(`${baseYoutube()}/videos?${q}`);
  const videos = (r.items || []).map((v) => {
    const short = segundos(v.contentDetails?.duration) <= 180;
    const video = {
      titulo: String(v.snippet?.title || '').slice(0, 160), canal: String(v.snippet?.channelTitle || '').slice(0, 80),
      publicado: v.snippet?.publishedAt, views: Number(v.statistics?.viewCount) || 0, short,
      link: short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    };
    return { ...video, porHora: porHora(video, agora) };
  }).sort((a, b) => b.porHora - a.porHora);
  return { videos: videos.slice(0, 12) };
}

// Google Notícias por palavra-chave (RSS público): as matérias da semana e a velocidade de cada termo.
export async function buscarNoticias(palavras, agora = Date.now()) {
  const todas = new Map();
  const termos = [];
  for (const p of palavras) {
    const q = new URLSearchParams({ q: `"${p}" when:7d`, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
    try {
      const itens = lerRss(await pedir(`${baseNoticias()}/rss/search?${q}`, { json: false }));
      termos.push({ termo: p, ...velocidade(itens, agora) });
      for (const n of itens) if (!todas.has(n.titulo)) todas.set(n.titulo, n);
    } catch (erro) {
      console.warn('radar notícias:', p, erro?.message);
    }
  }
  const noticias = [...todas.values()].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 30);
  return { noticias, termos: termos.sort((a, b) => b.subida - a.subida) };
}

const SYSTEM = `Você é o radar de conteúdo da Carol, social media de uma agência de marketing para médicos e profissionais da saúde.
Para um nicho, você aponta o que está subindo e vale postar nas próximas 2 semanas, cruzando os sinais que o app juntou (vídeos e Shorts do YouTube com visualizações por hora, notícias do Google Notícias com a velocidade de cada termo, datas da saúde e campanhas) com uma pesquisa na web sua sobre o que veículos e criadores brasileiros estão comentando e as perguntas que as pessoas estão fazendo.
Regras:
- Só aponte o que os sinais ou a sua pesquisa mostram. Não invente números nem tendências. Não prometa que algo vai viralizar.
- Nada de hashtag e nada de áudio em alta.
- temperatura: subindo_forte (acelerando rápido agora), subindo, data_certa (data ou campanha no período) ou momento (assunto que todo mundo está comentando).
- porque: 1 ou 2 frases com o sinal concreto (ex.: "3 Shorts com mais de 2 mil visualizações por hora", "notícias dobraram em 48 h").
- janela: até quando postar ("Até 14/11", "Na semana do dia 14").
- formato: Reels, Carrossel, Stories ou Post. gancho: a primeira frase do conteúdo, forte, sem clickbait.
- Saúde: siga as normas dos conselhos (sem promessa de resultado, sem sensacionalismo, sem antes e depois, sem autopromoção). Se o assunto for polêmico ou de risco, diga no porque.
- serve_para: só nomes da lista de clientes do nicho.
- links: só endereços que vieram dos sinais ou da sua pesquisa.
- noticias: as até 8 notícias que mais importam para o nicho agora, com porque importa em uma frase.
- briefing: 3 a 5 frases para a semana, direto ao ponto.
Português do Brasil, sem travessão, sem jargão. Entre 4 e 8 itens.`;

const ESQUEMA = objeto({
  itens: lista('O que vai subir nas próximas 2 semanas', objeto({
    tema: texto, temperatura: { type: 'string', enum: TEMPERATURAS.map((t) => t.id) }, porque: texto, janela: texto,
    formato: texto, gancho: texto, serve_para: lista('Clientes', texto), links: lista('Links', texto),
  })),
  noticias: lista('Notícias em alta', objeto({ titulo: texto, link: texto, fonte: texto, porque: texto, data: texto })),
  briefing: texto,
});

export async function analisarComIa({ nicho, hoje, videos, noticias, termos, datas }, { cliente } = {}) {
  const pedido = {
    hoje, nicho: { nome: nicho.nome, palavras: nicho.palavras, clientes: nicho.clientes },
    datas, termos,
    videos: videos.map((v) => ({ titulo: v.titulo, canal: v.canal, por_hora: v.porHora, short: v.short, link: v.link })),
    noticias: noticias.slice(0, 25).map((n) => ({ titulo: n.titulo, fonte: n.fonte, data: n.data, link: n.link })),
  };
  const r = await pedirJson({
    system: SYSTEM, conteudo: JSON.stringify(pedido), esquema: ESQUEMA, maxTokens: 8000, esforco: 'medium', cliente,
    ferramentas: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'BR' } }],
  });
  return conferirRadar(r);
}

// Monta o radar de um nicho e grava em config "radar:<id>" (o app acompanha a linha).
// O nicho vem no pedido (o app pode ainda não ter enviado a config "radar" quando pede).
export async function montarRadar(userId, pedido, agora = Date.now()) {
  const nicho = conferirNicho(pedido);
  if (!nicho.nome || !/^[a-z0-9-]{1,40}$/.test(nicho.id)) return { ok: false };
  const chave = chaveDoRadar(nicho.id);
  const [antes] = await banco.listar('config', userId, `chave=eq.${encodeURIComponent(chave)}`);
  const gravar = (valor) => banco.gravar('config', [{ user_id: userId, chave, valor, excluido_em: null }], 'user_id,chave');
  await gravar({ ...(antes?.valor || {}), status: 'lendo', pedido_em: new Date(agora).toISOString(), erro: null });
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agora));
  const avisos = [];
  try {
    let videos = [];
    try {
      const y = await buscarYoutube(nicho.palavras, agora);
      videos = y.videos;
      if (y.aviso) avisos.push(y.aviso);
    } catch (erro) {
      avisos.push('O YouTube não respondeu agora; o radar seguiu sem ele.');
      console.warn('radar youtube:', erro?.message);
    }
    const { noticias, termos } = await buscarNoticias(nicho.palavras, agora);
    const datas = datasDoNicho(nicho, hoje);
    let resultado;
    let fonte = 'ia';
    try {
      resultado = await analisarComIa({ nicho, hoje, videos, noticias, termos, datas });
      // "Serve para" só com as clientes do nicho (sem lista, fica vazio).
      const nomes = new Set(nicho.clientes);
      resultado.itens = resultado.itens.map((x) => ({ ...x, serve_para: x.serve_para.filter((c) => nomes.has(c)) }));
      if (!resultado.itens.length) throw new ErroIa('A IA não achou nada.');
    } catch (erro) {
      fonte = 'simples';
      avisos.push(erro instanceof ErroIa ? `${erro.message} Mostrando os sinais sem a análise.` : 'A IA não respondeu agora. Mostrando os sinais sem a análise.');
      if (!(erro instanceof ErroIa)) console.error('radar ia:', erro?.message);
      resultado = radarSimples({ nicho, videos, noticias, termos, datas });
    }
    await gravar({
      status: 'pronto', erro: null, gerado_em: new Date().toISOString(), fonte, avisos,
      nicho: nicho.nome, ...resultado, videos: videos.slice(0, 8), termos, datas,
    });
    return { ok: true };
  } catch (erro) {
    console.error('radar:', erro?.message);
    await gravar({ ...(antes?.valor || {}), status: 'erro', erro: 'Não consegui montar o radar agora. Tente de novo em alguns minutos.' }).catch(() => {});
    return { ok: false };
  }
}
