// R7, etapa 1 (dados fictícios): ficha, rotina padrão, contador do contrato, perfil e checador de voz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotinaPadrao, conferirFichaR7, fichaEmTexto, contadorR7, chaveDoNome, configR7, conferirVoz, checarVoz, diferencaDaVoz, fontesDaVoz, nichoDaFicha,
} from '../js/dados-r7.js';

test('rotina padrão: post seg, qua e sex; stories ter (contexto + enquete) e qui (caixinha); 2 vídeos', () => {
  const r = rotinaPadrao();
  assert.deepEqual(r.feed.map((x) => x.dia), [1, 3, 5]);
  assert.deepEqual(r.stories.dias, { 2: 'contexto_enquete', 4: 'caixinha' });
  assert.equal(r.videos.porSemana, 2);
});

test('ficha vazia ganha o padrão; lixo é limpo; link só https', () => {
  const f = conferirFichaR7({ identificacao: { instagram: 'cliente.exemplo', especialidade: 'dermatologia', perfil: 'http://inseguro' }, briefing: { agendamento: 'https://wa.me/550000', inspiracoes: 'https://a.exemplo\njavascript:alert(1)' }, rotina: { feed: [{ dia: 9 }, { dia: 2, formato: 'video', qtd: 3 }], grupo: 'C' } });
  assert.equal(f.identificacao.instagram, '@cliente.exemplo');
  assert.equal(f.identificacao.perfil, '');
  assert.deepEqual(f.briefing.inspiracoes, ['https://a.exemplo']);
  assert.deepEqual(f.rotina.feed, [{ dia: 2, formato: 'video', qtd: 3 }]);
  assert.equal(f.rotina.grupo, '');
  assert.equal(nichoDaFicha(f), 'Dermatologia');
  assert.deepEqual(conferirFichaR7({}).rotina.feed.map((x) => x.dia), [1, 3, 5]);
});

test('ficha em texto leva assinatura, especialidade e a rotina', () => {
  const f = conferirFichaR7({ identificacao: { assinatura: 'Dra. Cliente Exemplo | CRM-GO 00000', especialidade: 'dermatologia' } });
  const t = fichaEmTexto('Dra. Cliente Exemplo', f);
  assert.match(t, /Assinatura: Dra\. Cliente Exemplo \| CRM-GO 00000/);
  assert.match(t, /Especialidade: Dermatologia/);
  assert.match(t, /Feed: seg post, qua post, sex post/);
  assert.match(t, /ter Story 1/);
});

test('contador: sem limite de cadastro; do 11º em diante é extra', () => {
  const cl = Array.from({ length: 12 }, (_, i) => ({ chave: `c${i}`, nome: `C${i}`, casa: 'r7', criado_em: `2026-11-${String(i + 1).padStart(2, '0')}` }));
  cl.push({ chave: 'outra', casa: 'essence', criado_em: '2026-01-01' }, { chave: 'apagada', casa: 'r7', excluido_em: 'x' });
  const c = contadorR7(cl);
  assert.equal(c.total, 12);
  assert.equal(c.dentro, 10);
  assert.deepEqual(c.extras, ['c10', 'c11']);
  assert.deepEqual(configR7([{ chave: 'r7', valor: { limite: 9, quadros: 'Quadro A\nQuadro B' } }]).quadros, ['Quadro A', 'Quadro B']);
  assert.equal(chaveDoNome('Dra. Cliente Exemplo'), 'cliente-exemplo');
});

test('perfil de voz: item sem fonte conhecida fica vazio (a IA não inventa)', () => {
  const p = conferirVoz({ pessoa: { valor: 'eu', fonte: 't1' }, formalidade: { valor: 'informal', fonte: 'inventada' }, emojis: [{ valor: '💛', fonte: 't1' }] }, ['t1']);
  assert.deepEqual(p.pessoa, { valor: 'eu', fonte: 't1' });
  assert.equal(p.formalidade.valor, '');
  assert.equal(p.emojis.length, 1);
  assert.deepEqual(diferencaDaVoz(p, { ...p, pessoa: { valor: 'nós', fonte: 't1' } }), ['Pessoa do discurso']);
});

test('checador de voz: emoji que o cliente não usa e falta de assinatura → atenção', () => {
  const voz = conferirVoz({ assinatura: { valor: 'Dra. Cliente Exemplo | CRM-GO 00000', fonte: 't1' }, emojis: [{ valor: '💛', fonte: 't1' }] }, ['t1']);
  const r = checarVoz('Cuidar da pele é rotina. 🔥 Agende sua avaliação.', voz);
  assert.equal(r.estado, 'atencao');
  assert.ok(r.avisos.some((a) => /🔥/.test(a)));
  assert.ok(r.avisos.some((a) => /assinatura/.test(a)));
  const ok = checarVoz('Cuidar da pele é rotina. 💛 Agende sua avaliação.\nDra. Cliente Exemplo | CRM-GO 00000', voz);
  assert.equal(ok.estado, 'combina');
});

test('fontes da voz: até 30, mais recentes primeiro', () => {
  const coladas = Array.from({ length: 35 }, (_, i) => ({ id: `t${i}`, texto: `texto ${i}`, em: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` }));
  const f = fontesDaVoz({ coladas, rascunhos: [{ id: 'r1', texto: 'copy', atualizado_em: '2026-12-01' }] });
  assert.equal(f.length, 30);
  assert.equal(f[0].id, 'rascunho:r1');
});
