// Criptografia dos segredos guardados no Supabase (token do AVA, senha do Lyceum).
// AES-256-GCM com a chave TOKEN_CRYPTO_KEY (32 bytes em base64), que só existe na Netlify.
// Formato guardado: "v1.<iv>.<tag>.<conteúdo>", tudo em base64url.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function chave() {
  const bruta = Buffer.from(process.env.TOKEN_CRYPTO_KEY || '', 'base64');
  if (bruta.length !== 32) {
    throw new Error('TOKEN_CRYPTO_KEY precisa ter 32 bytes em base64 (gere com: openssl rand -base64 32).');
  }
  return bruta;
}

export function cifrar(objeto) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  const conteudo = Buffer.concat([cifra.update(JSON.stringify(objeto), 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return ['v1', iv, tag, conteudo].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decifrar(textoCifrado) {
  const [versao, iv, tag, conteudo] = String(textoCifrado).split('.');
  if (versao !== 'v1' || !iv || !tag || !conteudo) throw new Error('Formato de segredo desconhecido.');
  const decifra = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64url'));
  decifra.setAuthTag(Buffer.from(tag, 'base64url'));
  const claro = Buffer.concat([decifra.update(Buffer.from(conteudo, 'base64url')), decifra.final()]);
  return JSON.parse(claro.toString('utf8'));
}
