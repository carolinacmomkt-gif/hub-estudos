// Cronograma da R7 pelo manual da R7, com dados fictícios (sigilo: nenhum cliente real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoPadrao, gradeDoPeriodo, oQueFalta, resumoDoQueFalta, pedidoParaClaude, lerRespostaDoClaude, textoWhatsApp, tituloDaPeca,
  normalizarCronograma, montarSlidesDoCronograma, lerTelas, lerLaminas, nomesDaEntrega, totaisDoCronograma,
  acoesDaFigurinha, telaDaAcao, pedidoDasArtesDosStories, textoParaTrello, entregaDoDesigner, acentoDoCronograma, resumoDoQueFalta as resumo, CHECKLIST_FINAL,
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
  assert.equal(g.find((p) => p.data === '2026-11-24').figurinha, 'enquete Sim / Não; link de agendamento');
  assert.equal(g.find((p) => p.data === '2026-11-26').figurinha, 'caixinha de perguntas; link de agendamento');
  // Em dia de post, a sequência abre com o repost do post do dia.
  const comPost = gradeDoPeriodo({ feed: [{ dia: 2, formato: 'carrossel', qtd: 1 }], stories: { dias: { 2: 'contexto_enquete' } } }, '2026-11-24', '2026-11-24');
  assert.equal(comPost[1].figurinha, 'repost do post do dia; enquete Sim / Não; link de agendamento');
});

test('o que entra por cima: repost na 1, enquete na 2, link na última', () => {
  const a = acoesDaFigurinha('repost do post do dia; enquete Menos de 6 meses / Mais de 1 ano; link');
  assert.deepEqual(a.map((x) => x.tipo), ['repost', 'enquete', 'link']);
  assert.deepEqual(a[1].opcoes, ['Menos de 6 meses', 'Mais de 1 ano']);
  assert.deepEqual(a.map((x) => telaDaAcao(x, 4, a)), [1, 2, 4]);
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
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1: a\nTela 2: b\nTela 3: c', figurinha: 'enquete' }).atencao.includes('enquete sem as duas opções'));
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1: a\nTela 2: b\nTela 3: c', figurinha: 'enquete A / B' }).atencao.includes('sem o link na última tela'));
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1: a\nTela 2: b\nTela 3: c' }, { diaComPost: true }).atencao.includes('dia de post: abrir com o repost'));
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1: Vamos lá, uma coisa\nTela 2: b\nTela 3: c' }).atencao.includes('tirar "vamos lá"'));
  assert.ok(oQueFalta({ ...story, telas: 'Tela 1: um dois três quatro cinco seis sete oito nove dez onze doze treze\nTela 2: b\nTela 3: c' }).atencao.includes('título com mais de 12 palavras'));
  // Carrossel: capa + 4 a 7 cards, sem emoji; sem RQE, nada de "especialista".
  const lam = (n, extra = '') => Array.from({ length: n }, (_, k) => `Slide ${k + 1} | Card: texto ${k}${extra}`).join('\n');
  assert.ok(oQueFalta({ ...post, legenda: `Oi.\n${ASS}`, slides: lam(3) }, { assinatura: ASS }).atencao.some((a) => /capa \+ 4 a 7/.test(a)));
  assert.ok(oQueFalta({ ...post, legenda: `Oi.\n${ASS}`, slides: lam(6, ' 😊') }, { assinatura: ASS }).atencao.includes('emoji nas lâminas'));
  assert.ok(oQueFalta({ ...post, legenda: `Sou especialista.\n${ASS}`, slides: lam(6) }, { assinatura: ASS }).atencao.includes('"especialista" sem RQE na assinatura'));
  assert.ok(!oQueFalta({ ...post, legenda: `Sou especialista.\nDra. X | CRM-XX 1 | RQE 2`, slides: lam(6) }, { assinatura: 'Dra. X | CRM-XX 1 | RQE 2' }).atencao.some((a) => /especialista/.test(a)));
  assert.equal(resumoDoQueFalta({ pecas: g }, { assinatura: ASS }).legendas, 2);
});

test('pedido para o Claude traz as regras do manual e só o que falta', () => {
  const g = gradeDoPeriodo(rotinaPadrao(), '2026-11-23', '2026-11-27');
  g[0].legenda = `Pronta.\n${ASS}`; g[0].tema = 'Tema pronto';
  const t = pedidoParaClaude({ pecas: g, inicio: '2026-11-23', fim: '2026-11-27' }, { nome: 'Dra. Cliente Exemplo', fichaTexto: 'Ficha fictícia.', nicho: 'Odontologia', assinatura: ASS });
  assert.match(t, /### 25\.11 · POSTAGEM\n/);
  assert.doesNotMatch(t, /### 23\.11/);
  assert.match(t, /### 24\.11 · STORY\nTela 1 \(gancho\)/);
  assert.match(t, /Tela 5 \(chamada\)/);
  assert.match(t, /de 3 a 5 telas/);
  assert.match(t, /"vamos lá"/);
  assert.match(t, /capa \+ 4 a 7 cards/);
  assert.match(t, /nunca o chame de especialista/);
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
  assert.equal(n[0].pasta, '01 · 23-11 seg · Carrossel · Sorriso');
  assert.equal(n[1].pasta, '02 · 24-11 ter · Stories · a');
  assert.deepEqual(n[0].arquivos, ['01.jpg', '02.jpg', '03.jpg', 'Legenda']);
  assert.deepEqual(n[1].arquivos, ['S1_1.jpg', 'S1_2 - enquete Sim ou Não.jpg', 'S1_3.jpg']);
  assert.deepEqual(n[2].arquivos, ['capa-reel-25-11.jpg', 'video.MP4', 'Legenda']);
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
  assert.match(w, /Por cima: Enquete: Sim · Não; Link de agendamento/);
  const medir = (t, tam) => String(t).length * tam * 0.5;
  const s = montarSlidesDoCronograma(cron, { assinatura: ASS, cor: '#336699' }, medir);
  assert.equal(s.length, cron.pecas.length + 3);
  assert.deepEqual([s[0].id, s[1].id, s.at(-1).id], ['capa', 'resumo:0', 'final']);
  assert.ok(!JSON.stringify(s).includes('a escrever'));
  const texto = JSON.stringify(s);
  assert.match(texto, /Resumo da quinzena/);
  assert.match(texto, /Post 1 de 3 · /);
  assert.match(texto, /Stories 1 de 2/);
  assert.match(texto, /colocar o link aqui/);
  assert.match(texto, /não substitui uma consulta médica/);
});

test('Trello do designer, entrega na quinta e acento legível', () => {
  const p = { slides: 'Slide 01 | Capa (foto): Eu sou ansiosa?\nSlide 02 | Card: A situação\nSlide 03 | Card: A chamada', legenda: '' };
  assert.equal(textoParaTrello(p), '**Capa**\nEu sou ansiosa?\n\n**Card 1**\nA situação\n\n**Card 2**\nA chamada');
  assert.match(textoParaTrello(p, { orientacao: '**MUDANÇA NA ESTÉTICA**' }), /^\*\*MUDANÇA NA ESTÉTICA\*\*\n\n\*\*Capa\*\*/);
  assert.equal(entregaDoDesigner('2026-11-23'), '2026-11-26T10:00');
  assert.equal(entregaDoDesigner('2026-11-27'), '2026-12-03T10:00');
  assert.equal(acentoDoCronograma('#2E4A57'), '#2E4A57');
  assert.notEqual(acentoDoCronograma('#E8D3BF'), '#E8D3BF');
  assert.equal(CHECKLIST_FINAL.length, 6);
  assert.equal(typeof resumo, 'function');
});

test('pedido das artes dos stories para o projeto do cliente', () => {
  const cron = normalizarCronograma({ nome: 'Dra. Cliente Exemplo', inicio: '2026-11-23', fim: '2026-11-27', pecas: [
    { id: 'b', data: '2026-11-24', tipo: 'story', telas: 'Tela 1 (gancho): Oi | apoio\nTela 2 (interação): Enquete\nTela 3 (chamada): Agende', figurinha: 'enquete Sim / Não; link de agendamento' },
  ] });
  const t = pedidoDasArtesDosStories(cron, cron.pecas[0]);
  assert.match(t, /1080 × 1920/);
  assert.match(t, /a da identidade visual deste cliente/);
  assert.doesNotMatch(t, /Instrument/);
  assert.match(t, /### Tela 1 · gancho · fundo sugerido: liso escuro\nTítulo: Oi\nApoio: apoio/);
  assert.match(t, /Direcionamento: "colocar a enquete aqui"/);
  assert.match(t, /Direcionamento: "colocar o link aqui"/);
  assert.match(t, /Arquivo: S1_3 - link\.jpg/);
});

test('documento da quinzena: formato com ### e o mesmo texto vindo de PDF (sem ###), virada de ano', async () => {
  const { lerDocumentoDaQuinzena, cronogramaDoDocumento, FORMATO_DO_DOCUMENTO } = await import('../js/dados-cronograma.js');
  const d = lerDocumentoDaQuinzena(FORMATO_DO_DOCUMENTO, { hoje: '2026-11-17' });
  assert.equal(d.nome, 'Dr. Nome Sobrenome');
  assert.deepEqual([d.inicio, d.fim, d.lidas], ['2026-11-23', '2026-12-04', 4]);
  assert.deepEqual(d.pecas.map((p) => [p.tipo, p.formato]), [['post', 'carrossel'], ['story', ''], ['reels', ''], ['post', 'estatico']]);
  assert.equal(lerLaminas(d.pecas[0].slides).length, 3);
  assert.equal(lerTelas(d.pecas[1].telas).length, 5);
  assert.match(d.pecas[1].figurinha, /enquete Sim \/ Não; link/);
  assert.equal(d.pecas[2].video, 'https://drive.google.com/...');
  assert.equal(d.pecas[3].slides, 'O texto que vai na arte.');
  const pdf = lerDocumentoDaQuinzena('Cliente: Dra. Exemplo\nPeríodo: 28/12 a 08/01\n28/12 seg · Carrossel\nTema: A\nLegenda:\nOi\n05/01 · Stories\nTela 1 (gancho): oi', { hoje: '2026-12-20' });
  assert.deepEqual([pdf.inicio, pdf.fim], ['2026-12-28', '2027-01-08']);
  assert.deepEqual(pdf.pecas.map((p) => p.data), ['2026-12-28', '2027-01-05']);
  // Atualizar um cronograma: a peça do mesmo dia e tipo recebe o texto e mantém as artes; a nova entra.
  const base = normalizarCronograma({ cliente: 'x', nome: 'Dra. Exemplo', inicio: '2026-11-23', fim: '2026-12-04', pecas: [
    { id: 'a', data: '2026-11-23', tipo: 'post', formato: 'carrossel', legenda: 'antiga', artes: [{ caminho: 'u/r7/a.jpg', origem: 'trello' }] }] });
  const { cron, novas } = cronogramaDoDocumento(d, base, { cliente: 'x' });
  assert.equal(novas, 3);
  assert.equal(cron.pecas.find((p) => p.id === 'a').artes.length, 1);
  assert.match(cron.pecas.find((p) => p.id === 'a').legenda, /^Texto da legenda/);
});

test('slides usam as artes no lugar das caixas', async () => {
  const cron = normalizarCronograma({ nome: 'Dra. Cliente Exemplo', inicio: '2026-11-23', fim: '2026-11-27', pecas: [
    { id: 'a', data: '2026-11-23', tipo: 'post', formato: 'carrossel', slides: 'Slide 01 | Capa: a\nSlide 02 | b', artes: [{ caminho: 'x/1.jpg' }, { caminho: 'x/2.jpg' }] },
    { id: 'b', data: '2026-11-24', tipo: 'story', telas: 'Tela 1: a\nTela 2: b', artes: [{ caminho: 'x/s1.jpg' }, { caminho: 'x/s2.jpg' }, { caminho: 'x/s3.jpg' }] },
  ] });
  const medir = (t, tam) => String(t).length * tam * 0.5;
  const s = montarSlidesDoCronograma(cron, { assinatura: ASS, artes: { 'x/1.jpg': 'blob:1', 'x/2.jpg': 'blob:2', 'x/s1.jpg': 'blob:s1', 'x/s2.jpg': 'blob:s2', 'x/s3.jpg': 'blob:s3' } }, medir);
  const imagens = s.flatMap((x) => x.elementos).filter((e) => e.tipo === 'imagem').map((e) => e.src);
  assert.deepEqual(imagens, ['blob:1', 'blob:2', 'blob:s1', 'blob:s2', 'blob:s3']);
});
