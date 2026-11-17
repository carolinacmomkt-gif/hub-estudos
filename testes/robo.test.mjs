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

test('cadastro pelos briefings: nome, registro e assinatura; quem já existe ou foi recusado fica de fora', async () => {
  const { nomeDoBriefing, registroDoBriefing, assinaturaDoRegistro, clientesNovosDoRobo } = await import('../js/dados-robo.js');
  assert.equal(nomeDoBriefing('BRIENF Briefing Dra Fulana Exemplo –  fevereiro.docx'), 'Dra. Fulana Exemplo');
  assert.equal(nomeDoBriefing('Briefing DRA BELTRANA TESTE  - Março.docx'), 'Dra. Beltrana Teste');
  assert.equal(nomeDoBriefing('Briefing Briefing Dr Ciclano Modelo – Cirurgião - Novembro.docx'), 'Dr. Ciclano Modelo');
  const r = registroDoBriefing('Briefing Dr Ciclano Modelo Médico– CRM/GO 12.345\n\nMês de Abril', 'Dr. Ciclano Modelo');
  assert.deepEqual(r, { conselho: 'CRM', uf: 'GO', numero: '12345', profissao: 'Médico' });
  assert.equal(assinaturaDoRegistro('Dr. Ciclano Modelo', r), 'Dr. Ciclano Modelo | Médico | CRM-GO 12345');
  assert.equal(registroDoBriefing('Briefing Dra Fulana – CRO-GO 1234', 'Dra. Fulana').profissao, 'Cirurgiã-dentista');
  const robo = { briefings: [
    { arquivo: 'Briefing Dra Fulana Exemplo - Outubro.docx', texto: 'Briefing Dra Fulana Exemplo Médica – CRM-GO 111', modificado: '2026-10-01T10:00:00Z' },
    { arquivo: 'Briefing Dra Fulana Exemplo - Novembro.docx', texto: 'Briefing Dra Fulana Exemplo Médica – CRM-GO 111', modificado: '2026-11-01T10:00:00Z' },
    { arquivo: 'Briefing Dr Ciclano Modelo - Novembro.docx', texto: 'Briefing Dr Ciclano Modelo – CRM-GO 222', modificado: '2026-11-02T10:00:00Z' },
    { arquivo: 'Briefing Dra Antiga Teste - Março.docx', texto: '', modificado: '2026-03-01T10:00:00Z' },
  ] };
  const novos = clientesNovosDoRobo(robo, [{ nome: 'Dr. Ciclano Modelo' }], [], { hoje: '2026-11-17' });
  assert.deepEqual(novos.map((c) => [c.nome, c.assinatura]), [['Dra. Fulana Exemplo', 'Dra. Fulana Exemplo | Médica | CRM-GO 111']]);
  assert.equal(clientesNovosDoRobo(robo, [], [novos[0].chave, 'ciclano modelo'], { hoje: '2026-11-17' }).length, 0);
});

test('artes do Trello: o card casa com a peça pela copy e as imagens vão na ordem do número', async () => {
  const { artesDoTrelloParaCronograma } = await import('../js/dados-robo.js');
  const cron = { pecas: [
    { id: 'p1', tipo: 'post', formato: 'carrossel', tema: 'Sono ruim tem jeito', slides: 'Slide 01 | Capa: Sono ruim tem jeito\nSlide 02 | Card 1: Dormir mal todos os dias cansa o corpo inteiro' },
    { id: 'p2', tipo: 'post', formato: 'carrossel', tema: 'Ansiedade no trabalho', slides: 'Slide 01 | Capa: Ansiedade no trabalho\nSlide 02 | Card 1: Prazos apertados deixam qualquer pessoa tensa' },
    { id: 's1', tipo: 'story', telas: 'Tela 1: oi' },
  ] };
  const trello = { quadros: [{ quadro: 'DESIGN', cartoes: [
    { lista: 'DRA FULANA EXEMPLO', nome: 'carrossel', desc: '**Capa**\nAnsiedade no trabalho\n\n**Card 1**\nPrazos apertados deixam qualquer pessoa tensa', anexos: [
      { id: 'b', nome: 'lamina 2.png', caminho: 'h/b.png' }, { id: 'a', nome: 'lamina 1.png', caminho: 'h/a.png' }] },
    { lista: 'OUTRA CLIENTE', nome: 'carrossel', desc: '**Capa**\nSono ruim tem jeito', anexos: [{ id: 'c', nome: '1.png', caminho: 'h/c.png' }] },
  ] }] };
  const r = artesDoTrelloParaCronograma(cron, trello, { nome: 'Dra. Fulana Exemplo' });
  assert.deepEqual(r.map((x) => [x.peca, x.anexos.map((a) => a.id)]), [['p2', ['a', 'b']]]);
});
