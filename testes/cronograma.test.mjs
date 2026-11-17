// Cronograma da R7 pelo manual da R7, com dados fictícios (sigilo: nenhum cliente real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoPadrao, gradeDoPeriodo, oQueFalta, resumoDoQueFalta, pedidoParaClaude, lerRespostaDoClaude, textoWhatsApp, tituloDaPeca,
  normalizarCronograma, montarSlidesDoCronograma, lerTelas, lerLaminas, nomesDaEntrega, totaisDoCronograma,
} from '../js/dados-cronograma.js';
import { rotinaPadrao } from '../js/dados-r7.js';

const ASS = 'Dra. Cliente Exemplo | CRM-XX 00000';

test('período padrão: da próxima segunda à sexta da semana seguinte', () => {
  assert.deepEqual(periodoPadrao('2026-11-17'), { inicio: '2026-11-23', fim: '2026-12-04' });
  assert.deepEqual(periodoPadrao('2026-11-23'), { inicio: '2026-11-30', fim: '2026-12-11' });
});

test('grade pela rotina padrão: post seg/qua/sex e stories ter/qui, com a figurinha do modelo', () => {
  const g = gradeDoPeriodo(rotinaPadrao(), '2026-11-23', '2026-12-04');
  assert.equal(g.filter((p) => p.tipo === 'post').length, 6);
  assert.equal(g.filter((p) => p.tipo === 'story').length, 4);
  assert.equal(tituloDaPeca(g[0]), 'POSTAGEM - 23.11 - Segunda');
  assert.equal(g.find((p) => p.data === '2026-11-24').figurinha, 'enquete Sim / Não');
  assert.equal(g.find((p) => p.data === '2026-11-26').figurinha, 'caixinha de perguntas');
});

test('telas e lâminas', () => {
  assert.deepEqual(lerTelas('Tela 1 (gancho): Você sabia? | Apoio curto\n**Tela 2 (chamada):** Agende'), [
    { n: 1, funcao: 'gancho', titulo: 'Você sabia?', apoio: 'Apoio curto' }, { n: 2, funcao: 'chamada', titulo: 'Agende', apoio: '' }]);
  assert.deepEqual(lerLaminas('Slide 01 | Capa (foto): Oi\nSlide 02 | Texto: Tchau').map((l) => [l.n, l.texto]), [[1, 'Oi'], [2, 'Tchau']]);
});

test('o que falta: legenda, assinatura, lâminas, capa e link do reel, telas dos stories', () => {
  const g = gradeDoPeriodo({ feed: [{ dia: 1, formato: 'carrossel', qtd: 1 }, { dia: 3, formato: 'video', qtd: 1 }], stories: { dias: { 2: 'contexto_enquete' } } }, '2026-11-23', '2026-11-27');
  const [post, story, reels] = g;
  assert.deepEqual(oQueFalta(post, { assinatura: ASS }).falta, ['legenda', 'lâminas']);
  assert.deepEqual(oQueFalta({ ...post, legenda: 'Texto sem assinatura.', slides: 'Slide 01 | Capa: oi' }, { assinatura: ASS }).falta, ['assinatura']);
  assert.ok(oQueFalta({ ...post, legenda: `Texto — com travessão.\n${ASS}`, slides: 'x' }, { assinatura: ASS }).atencao.includes('travessão'));
  assert.deepEqual(oQueFalta(reels, { assinatura: ASS }).falta, ['legenda', 'link do vídeo', 'texto da capa']);
  assert.deepEqual(oQueFalta(story).falta, ['telas']);
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1 (gancho): Oi' }).atencao.some((a) => /3 a 5/.test(a)));
  assert.equal(oQueFalta({ ...story, telas: 'Tela 1: a\nTela 2: b\nTela 3: c' }).pronta, true);
  assert.equal(resumoDoQueFalta({ pecas: g }, { assinatura: ASS }).legendas, 2);
});

test('pedido para o Claude traz as regras do manual e só o que falta', () => {
  const g = gradeDoPeriodo(rotinaPadrao(), '2026-11-23', '2026-11-27');
  g[0].legenda = `Pronta.\n${ASS}`; g[0].tema = 'Tema pronto';
  const t = pedidoParaClaude({ pecas: g, inicio: '2026-11-23', fim: '2026-11-27' }, { nome: 'Dra. Cliente Exemplo', fichaTexto: 'Ficha fictícia.', nicho: 'Odontologia', assinatura: ASS });
  assert.match(t, /### 25\.11 · POSTAGEM\n/);
  assert.doesNotMatch(t, /### 23\.11/);
  assert.match(t, /### 24\.11 · STORY\nTela 1 \(gancho\)/);
  assert.match(t, /de 3 a 5 telas/);
  assert.match(t, new RegExp(ASS.replace(/[|.]/g, '\\$&')));
});

test('lê a resposta colada: legenda, lâminas, capa do reel, telas e figurinha', () => {
  const g = gradeDoPeriodo({ feed: [{ dia: 1, formato: 'carrossel', qtd: 1 }, { dia: 3, formato: 'video', qtd: 1 }], stories: { dias: { 2: 'contexto_enquete' } } }, '2026-11-23', '2026-11-27');
  const resposta = `Aqui está:
### 23.11 · POSTAGEM · Carrossel
Tema: Sorriso e autoestima
Legenda:
Primeiro parágrafo.

Segundo parágrafo.
${ASS}
Slides:
Slide 01 | Capa (foto): Seu sorriso conta
Slide 02 | Texto: Mais um

### 24.11 · STORY
Tela 1 (gancho): Você escova antes do café? | Conta pra gente
**Tela 2 (pergunta):** Enquete rápida
Tela 3 (chamada): Agende sua avaliação
Figurinha: enquete Antes / Depois

### 25.11 · REELS
Tema: Clareamento
Texto da capa: Clareamento dói?
Legenda: Não precisa doer.
${ASS}

### 30.11 · POSTAGEM
Tema: fora do período`;
  const r = lerRespostaDoClaude(resposta, g);
  assert.equal(r.lidas, 3);
  assert.deepEqual(r.sobras, ['30.11 · POSTAGEM']);
  const post = r.pecas.find((p) => p.data === '2026-11-23');
  assert.match(post.legenda, /Primeiro parágrafo\.\n\nSegundo parágrafo\.\nDra\. Cliente/);
  assert.match(post.slides, /^Slide 01 \| Capa/);
  const story = r.pecas.find((p) => p.data === '2026-11-24');
  assert.equal(lerTelas(story.telas).length, 3);
  assert.equal(story.figurinha, 'enquete Antes / Depois');
  assert.equal(r.pecas.find((p) => p.tipo === 'reels').capa, 'Clareamento dói?');
});

test('Drive: uma pasta por peça na ordem e os nomes dos arquivos do manual', () => {
  const cron = normalizarCronograma({ nome: 'Dra. Cliente Exemplo', inicio: '2026-11-23', fim: '2026-11-27', pecas: [
    { id: 'a', data: '2026-11-23', tipo: 'post', formato: 'carrossel', tema: 'Sorriso', slides: 'Slide 01 | Capa: a\nSlide 02 | b\nSlide 03 | c' },
    { id: 'b', data: '2026-11-24', tipo: 'story', telas: 'Tela 1: a\nTela 2: b\nTela 3: c', figurinha: 'enquete Sim / Não' },
    { id: 'c', data: '2026-11-25', tipo: 'reels', tema: 'Clareamento' },
    { id: 'd', data: '2026-11-26', tipo: 'story', telas: 'Tela 1: a\nTela 2: b', figurinha: 'link' },
  ] });
  const n = nomesDaEntrega(cron);
  assert.equal(n[0].pasta, '01 - 23.11 - Carrossel - Sorriso');
  assert.deepEqual(n[0].arquivos, ['01.jpg', '02.jpg', '03.jpg', 'Legenda']);
  assert.deepEqual(n[1].arquivos, ['S1_1.jpg', 'S1_2 - enquete Sim ou Não.jpg', 'S1_3.jpg']);
  assert.deepEqual(n[2].arquivos, ['video.mp4', 'capa.jpg', 'Legenda']);
  assert.deepEqual(n[3].arquivos, ['S2_1.jpg', 'S2_2 - link.jpg']);
  assert.equal(totaisDoCronograma(cron), '2 posts no feed · 1 reel · 1 carrossel · 2 sequências de stories');
});

test('WhatsApp e slides (capa, resumo, peças, para aprovar)', () => {
  const cron = normalizarCronograma({ nome: 'Dra. Cliente Exemplo', inicio: '2026-11-23', fim: '2026-11-27', pecas: gradeDoPeriodo(rotinaPadrao(), '2026-11-23', '2026-11-27') });
  cron.pecas[0].legenda = `Oi.\n${ASS}`;
  cron.pecas[1].telas = 'Tela 1 (gancho): Oi | apoio';
  const w = textoWhatsApp(cron);
  assert.match(w, /^\*Cronograma de conteúdo · Dra\. Cliente Exemplo\*\n\*23 a 27 de novembro\*/);
  assert.match(w, /\*Segunda, 23\/11 · Post\*/);
  assert.match(w, /Por cima: enquete Sim · Não/);
  const medir = (t, tam) => String(t).length * tam * 0.5;
  const s = montarSlidesDoCronograma(cron, { assinatura: ASS, cor: '#336699' }, medir);
  assert.equal(s.length, cron.pecas.length + 3);
  assert.deepEqual([s[0].id, s[1].id, s.at(-1).id], ['capa', 'resumo:0', 'final']);
  assert.ok(!JSON.stringify(s).includes('a escrever'));
});
