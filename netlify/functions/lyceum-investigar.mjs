// Investigação do portal do Lyceum (só arquivos públicos, sem login).
//
// O portal do aluno é um app de página única (#/home/...), que conversa com uma API.
// Esta função baixa a página inicial e os scripts públicos do portal e lista os
// endereços e caminhos que parecem ser dessa API, para planejarmos a sincronização.
// Não recebe CPF nem senha e não acessa nenhum dado da Carol.
//
// Variáveis de ambiente: HUB_CODIGO_ACESSO e, opcional, LYCEUM_PORTAL_URL.

import { timingSafeEqual } from 'node:crypto';

const PORTAL_PADRAO = 'https://portal.unievangelica.edu.br/aluno/';
const TEMPO_LIMITE_MS = 4000;
const MAX_SCRIPTS = 12;
const MAX_PEDACOS = 20; // partes do código carregadas depois (chunk-*.js etc.)
const MAX_BYTES = 6 * 1024 * 1024;
const PALAVRAS = /(api|rest|auth|login|logon|token|oauth|sess|nota|frequen|falta|boletim|aluno|disciplin|diario|servic|endpoint|captcha|refresh)/i;

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

async function baixar(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'HubDeEstudos/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const texto = (await resp.text()).slice(0, MAX_BYTES);
  return { status: resp.status, url: resp.url, tipo: resp.headers.get('content-type') || '', texto };
}

function scriptsDaPagina(html, base) {
  const srcs = new Set();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) srcs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel=["'](?:modulepreload|preload)["'][^>]+href=["']([^"']+\.js[^"']*)["']/gi)) srcs.add(m[1]);
  const baseTag = html.match(/<base[^>]+href=["']([^"']+)["']/i)?.[1];
  const raiz = baseTag ? new URL(baseTag, base) : new URL(base);
  return [...srcs].map((s) => new URL(s, raiz).href);
}

function analisarTexto(texto, achados) {
  for (const m of texto.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s"'`<>()\\]*)?/gi)) {
    if (m[0].length < 300) achados.urls.add(m[0]);
  }
  for (const m of texto.matchAll(/["'`]([^"'`\s<>]{3,160})["'`]/g)) {
    const s = m[1];
    if (s.includes('/') && PALAVRAS.test(s) && !/^(?:\.\.?\/)?node_modules|\.(?:png|svg|jpe?g|gif|woff2?|ttf|css)$/i.test(s)) {
      achados.caminhos.add(s);
    }
  }
  for (const m of texto.matchAll(/(?:apiUrl|baseUrl|apiBase|urlApi|API_URL|serverUrl|urlBase)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi)) {
    achados.configuracoes.add(`${m[0].split(/[:=]/)[0].trim()} = ${m[1]}`);
  }
  if (/recaptcha|hcaptcha|turnstile/i.test(texto)) achados.captcha = true;
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const codigoEsperado = process.env.HUB_CODIGO_ACESSO;
  if (!codigoEsperado) return resposta(500, { ok: false, erro: 'Falta a variável HUB_CODIGO_ACESSO na Netlify.' });

  let entrada;
  try {
    entrada = await req.json();
  } catch {
    return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  }
  if (!codigoConfere(entrada?.codigo ?? '', codigoEsperado)) {
    await new Promise((r) => setTimeout(r, 1000));
    return resposta(401, { ok: false, erro: 'Código de acesso incorreto.' });
  }

  const portal = process.env.LYCEUM_PORTAL_URL || PORTAL_PADRAO;
  let pagina;
  try {
    pagina = await baixar(portal);
  } catch (erro) {
    const demorou = erro?.name === 'TimeoutError' || erro?.name === 'AbortError';
    return resposta(200, { ok: false, erro: demorou ? 'O portal demorou demais para responder.' : 'Não foi possível abrir o portal do Lyceum a partir da Netlify.' });
  }

  const achados = { urls: new Set(), caminhos: new Set(), configuracoes: new Set(), captcha: false };
  analisarTexto(pagina.texto, achados);

  const pedacos = new Set();
  const lerScript = async (url) => {
    try {
      const s = await baixar(url);
      analisarTexto(s.texto, achados);
      // Partes carregadas sob demanda, ex.: import("./chunk-AB12.js")
      for (const m of s.texto.matchAll(/["'`]((?:\.\/)?[\w.-]+\.js)["'`]/g)) pedacos.add(new URL(m[1], url).href);
      return { url, status: s.status, kb: Math.round(s.texto.length / 1024) };
    } catch {
      return { url, status: 'erro', kb: 0 };
    }
  };

  const scripts = scriptsDaPagina(pagina.texto, pagina.url).slice(0, MAX_SCRIPTS);
  const lidos = await Promise.all(scripts.map(lerScript));
  const novos = [...pedacos].filter((u) => !scripts.includes(u)).slice(0, MAX_PEDACOS);
  lidos.push(...await Promise.all(novos.map(lerScript)));

  // Arquivos de configuração comuns em portais desse tipo.
  const extras = ['assets/config.json', 'assets/env.json', 'config.json', 'env.js', 'assets/config/config.json'];
  const configs = await Promise.all(extras.map(async (caminho) => {
    const url = new URL(caminho, pagina.url).href;
    try {
      const s = await baixar(url);
      const pareceConfig = s.status === 200 && !/<html/i.test(s.texto.slice(0, 200));
      if (pareceConfig) analisarTexto(s.texto, achados);
      return pareceConfig ? { url, conteudo: s.texto.slice(0, 2000) } : null;
    } catch {
      return null;
    }
  }));

  return resposta(200, {
    ok: true,
    portal: { url: pagina.url, status: pagina.status },
    captcha: achados.captcha,
    scripts: lidos,
    configuracoes: [...achados.configuracoes],
    arquivosDeConfiguracao: configs.filter(Boolean),
    urls: [...achados.urls].filter((u) => !/w3\.org|angular\.io|github\.com|googleapis\.com\/css|mozilla\.org/i.test(u)).slice(0, 200),
    caminhos: [...achados.caminhos].slice(0, 300),
  });
};
