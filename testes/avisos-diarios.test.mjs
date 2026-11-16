// Avisos uma vez por dia (16/11/2026): os momentos do dia e o "Seu dia".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { momentosDoDia, avisoDoDia, linhaDoDia } from '../netlify/functions/avisos-agendado.mjs';
import { config as cfgAvisos } from '../netlify/functions/avisos-agendado.mjs';
import { config as cfgRadar } from '../netlify/functions/radar-agendado.mjs';
import { config as cfgDemandas } from '../netlify/functions/demandas-agendado.mjs';
import { config as cfgTrabalho } from '../netlify/functions/trabalho-agendado.mjs';
import { config as cfgSincronizar } from '../netlify/functions/sincronizar-agendado.mjs';

test('o dia vai das 6h às 23h45 de Brasília, de 15 em 15 minutos', () => {
  const m = momentosDoDia(Date.parse('2026-11-16T10:45:00Z'), 'America/Sao_Paulo');
  assert.equal(m.length, 72);
  assert.equal(new Date(m[0]).toISOString(), '2026-11-16T09:00:00.000Z');
  assert.equal(new Date(m.at(-1)).toISOString(), '2026-11-17T02:45:00.000Z');
});

test('o "Seu dia" junta tudo num aviso só, com o remédio pela hora', () => {
  const a = avisoDoDia([
    { chave: 'remedio:1:14:00:2026-11-16', titulo: 'Hora de Vitamina D', texto: '14:00 · 1 cápsula' },
    { chave: 'contas:2026-11-16', titulo: 'Conta de luz vence hoje' },
    { chave: 'x', titulo: 'Conta de luz vence hoje' },
  ], '2026-11-16');
  assert.equal(a.titulo, 'Seu dia · 2 coisas');
  assert.equal(a.texto, 'Vitamina D às 14:00\nConta de luz vence hoje');
  assert.equal(linhaDoDia({ titulo: 'Prova amanhã' }), 'Prova amanhã');
});

test('mais de 6 coisas: mostra 6 e "e mais N"', () => {
  const a = avisoDoDia(Array.from({ length: 9 }, (_, i) => ({ titulo: `Item ${i + 1}` })), '2026-11-16');
  assert.equal(a.texto.split('\n').length, 7);
  assert.match(a.texto, /e mais 3$/);
});

test('tarefas automáticas: no máximo 1 vez por dia (trabalho a cada 2 h)', () => {
  assert.equal(cfgAvisos.schedule, '45 10 * * *');
  assert.equal(cfgRadar.schedule, '31 10 * * *');
  assert.equal(cfgDemandas.schedule, '0 10 * * *');
  assert.equal(cfgSincronizar.schedule, '0 9 * * *');
  assert.equal(cfgTrabalho.schedule, '17 10-22/2 * * *');
});
