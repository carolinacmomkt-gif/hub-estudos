// Cópia da Bússola no Cloudflare Pages, sem a Netlify (Carol, 16/11/2026: créditos da Netlify).
// O Cloudflare roda este script na publicação ("Build command": node scripts/publicar-cloudflare.mjs;
// "Build output directory": dist). Ele copia só o app (sem as funções, os testes e o banco) para dist/
// e escreve dist/config-publica.json com o endereço e a chave PÚBLICA (anon) do Supabase, lidos das
// variáveis do Cloudflare. Nada disso fica no repositório. O que depende das funções da Netlify (IA,
// Trello, Notion, AVA, avisos no celular, Radar, backup) não funciona nesta cópia.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const DESTINO = 'dist';
const COPIAR = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icones', 'modelos'];

const { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY = '', TRELLO_API_KEY = '' } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis do Cloudflare Pages.');
  process.exit(1);
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO);
for (const item of COPIAR) if (existsSync(item)) cpSync(item, `${DESTINO}/${item}`, { recursive: true });

writeFileSync(`${DESTINO}/config-publica.json`, JSON.stringify({
  supabaseUrl: new URL(SUPABASE_URL).origin,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  vapidPublicKey: VAPID_PUBLIC_KEY || null,
  trelloApiKey: TRELLO_API_KEY || null,
}));

// Os mesmos cabeçalhos do netlify.toml, no formato do Cloudflare.
writeFileSync(`${DESTINO}/_headers`, `/sw.js
  Cache-Control: no-cache
/config-publica.json
  Cache-Control: no-cache
/manifest.webmanifest
  Content-Type: application/manifest+json
/js/vendor/pdfjs/*
  Content-Type: text/javascript; charset=utf-8
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);
console.log('Pronto: dist/ com o app e a configuração pública.');
