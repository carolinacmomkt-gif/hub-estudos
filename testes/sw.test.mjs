// O sw.js serve o app da cópia da VERSAO (sem ir à rede a cada abertura). Por isso todo script e
// estilo do app precisa estar na lista ARQUIVOS, e todo item da lista precisa existir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const lista = [...sw.slice(sw.indexOf('const ARQUIVOS'), sw.indexOf('];')).matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const raiz = new URL('../', import.meta.url);

test('todo js e css do app está na lista do service worker', () => {
  const doApp = [
    ...readdirSync(new URL('js/', raiz)).filter((f) => /\.m?js$/.test(f)).map((f) => `js/${f}`),
    ...readdirSync(new URL('css/', raiz)).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  ];
  assert.deepEqual(doApp.filter((f) => !lista.includes(f)), []);
});

test('todo item da lista existe', () => {
  assert.deepEqual(lista.filter((f) => f && !existsSync(new URL(f, raiz))), []);
});

test('o service worker não vai à rede pelos arquivos do app', () => {
  assert.ok(!/fetch\(request, \{ cache: 'no-cache' \}\)/.test(sw));
  assert.match(sw, /cache: 'reload'/);
});
