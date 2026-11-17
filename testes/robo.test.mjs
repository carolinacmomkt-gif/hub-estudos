// Robô da R7 com dados fictícios (sigilo: nenhum cliente real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroDoVideo, lerBriefing, ehDoCliente, videosDoCliente, textoDaDemanda, trelloDoCliente, frasesDoTrello } from '../js/dados-robo.js';

test('número do vídeo pelo nome do editado (com erro de digitação no mês)', () => {
  assert.equal(numeroDoVideo('Dra.Exemplo Teste 12 setembro.MP4'), 12);
  assert.equal(numeroDoVideo('Exemplo Teste 14 - Setembro.mp4'), 14);
  assert.equal(numeroDoVideo('Exemplo Teste - Novembro 04.mp4'), 4);
  assert.equal(numeroDoVideo('Exemplo - 11 Novembro.mp4 OK'), 11);
  assert.equal(numeroDoVideo('Exemplo 15 setermbro(1).mp4'), 15);
  assert.equal(numeroDoVideo('Exemplo - 1.mp4'), null);
});

test('lê o briefing: um vídeo por bloco, com tipo e título', () => {
  const b = lerBriefing('Briefing Dra Exemplo\n\nMês de Novembro\n\nTotal de 3 vídeos\n\n## Vídeo 1 VÍDEO TREND\n\nTítulo 🎬 1 — Uma trend\n\nVídeo 2 VÍDEO DE CONTÉUDO\n\nTítulo 🎬 2 — Um conteúdo\n\nVídeo 3 CAIXINHA DE PERGUNTA\nTítulo: Caixinha');
  assert.equal(b.total, 3);
  assert.deepEqual(b.videos.map((v) => [v.n, v.tipo]), [[1, 'Trend'], [2, 'Conteúdo'], [3, 'Conteúdo']]);
  assert.equal(b.videos[0].titulo, 'Uma trend');
});

test('o arquivo é do cliente pelo nome, sem confundir pessoas com o mesmo primeiro nome', () => {
  assert.ok(ehDoCliente('BRIENFD Dra Exemplo   NOVEMBRO.docx', 'Dra. Exemplo Teste'));
  assert.ok(ehDoCliente('DRA. EXEMPLO TESTE', 'Dra. Exemplo Teste'));
  assert.ok(!ehDoCliente('BRIENF Dra Exemplo Outra NOVEMBRO.docx', 'Dra. Exemplo Teste'));
  assert.ok(!ehDoCliente('BRIENF Dr Fulano NOVEMBRO.docx', 'Dra. Exemplo Teste'));
});

test('demanda de vídeos: os 2 próximos que faltam, na ordem do briefing', () => {
  const robo = {
    briefings: [{ arquivo: 'BRIENF Dra Exemplo SETEMBRO.docx', ano: '2026', pasta: 'Setembro', texto: [1, 2, 3, 4, 5, 6].map((n) => `Vídeo ${n} ${n === 5 ? 'TREND' : 'CONTEÚDO'}\nTítulo: V${n}`).join('\n') }],
    producao: [{ cliente: 'DRA. EXEMPLO TESTE', pasta: 'VIDEOS SETEMBRO', editados: ['Exemplo 3 setembro.mp4'], usados: ['Exemplo 1 setembro.mp4', 'Exemplo setembro 02.mp4'] }],
  };
  const r = videosDoCliente('Dra. Exemplo Teste', robo, [{ cliente: 'Dra. Exemplo Teste', mes: '2026-09', n: 4, em: '2026-11-16T10:00:00Z' }], { hoje: '2026-11-17' });
  assert.deepEqual(r.pedir.map((v) => v.n), [5, 6]);
  assert.equal(r.estoque, 1);
  assert.equal(r.briefing.videos.find((v) => v.n === 4).estado, 'pedido');
  assert.equal(r.captacao, 'acabando');
  assert.equal(textoDaDemanda([{ nome: 'Dra. Exemplo Teste', mes: r.briefing.mes, pedir: r.pedir }]), 'Dra. Exemplo Teste (briefing de setembro)\nVídeo 5 – Trend\nVídeo 6 – Conteúdo');
  assert.equal(videosDoCliente('Dr. Ninguém', robo).captacao, 'sem-briefing');
});

test('Trello: cartões da lista do cliente, pelo estado das etiquetas', () => {
  const robo = { quadros: [{ quadro: 'Quadro Teste', cartoes: [
    { lista: 'DRA EXEMPLO TESTE | CRM 0000', nome: 'Carrossel', etiquetas: ['EM ANDAMENTO'], vence: '2026-11-20' },
    { lista: 'DRA EXEMPLO TESTE | CRM 0000', nome: 'Estático', etiquetas: ['ALTERAÇÃO'] },
    { lista: 'DRA EXEMPLO TESTE | CRM 0000', nome: 'Antigo', etiquetas: ['DEMANDAS'], vence: '2026-11-10' },
    { lista: 'DRA EXEMPLO TESTE | CRM 0000', nome: 'Pronto', etiquetas: ['FINALIZADO DESIGNER'] },
    { lista: 'OUTRA CLIENTE', nome: 'x', etiquetas: [] },
  ] }] };
  const t = trelloDoCliente(robo, { nome: 'Dra. Exemplo Teste', lista: 'DRA EXEMPLO TESTE' }, '2026-11-17');
  assert.equal(t.total, 4);
  assert.deepEqual(t.conta, { designer: 1, ajuste: 1, pronta: 1, vencida: 1 });
  assert.equal(frasesDoTrello(t), '1 com o designer · 1 em ajuste · 1 vencida · 1 pronta');
  assert.equal(trelloDoCliente(robo, { nome: 'Dra. Exemplo Teste' }, '2026-11-17').total, 4);
});
