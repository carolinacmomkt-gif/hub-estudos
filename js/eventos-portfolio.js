// Gestão de projetos: quadro das tarefas (a fazer → fazendo → feito), lista/quadro do projeto e a
// revisão semanal (config "revisao_semanal" { [segunda]: { passos, prioridades, feita_em } }).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { aoConcluir, aoDesfazer, iso } from './dados-tarefas.js';
import { segundaDe } from './dados-portfolio.js';

let app;
export function ligarPortfolio(funcoes) { app = funcoes; }

const tarefa = (id) => (obterEstado().tarefas || []).find((t) => t.id === id);

async function moverTarefa(id, coluna) {
  const t = tarefa(id);
  if (!t) return;
  let novo = { ...t };
  if (coluna === 'feito') {
    novo = { ...novo, ...aoConcluir(t, new Date().toISOString(), iso(new Date())) };
  } else if (t.feita_em) novo = { ...novo, ...aoDesfazer(t) };
  novo.dados = { ...(novo.dados || {}), fazendo: coluna === 'fazendo' };
  await gravar('tarefas', 'tarefas', novo);
  app.renderizar();
  if (coluna === 'feito') app.avisoCurto('Feito!', { rotulo: 'Desfazer', fn: async () => { const a = tarefa(id); if (a) { await gravar('tarefas', 'tarefas', { ...a, ...aoDesfazer(a) }); app.renderizar(); } } });
}

let fila = Promise.resolve();
function mudarRevisao(fn) {
  fila = fila.then(async () => {
    const semana = segundaDe(iso(new Date()));
    const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'revisao_semanal');
    const valor = { ...(linha?.valor || {}) };
    const atual = { passos: {}, prioridades: [], feita_em: null, ...(valor[semana] || {}) };
    fn(atual);
    valor[semana] = atual;
    // Guarda só as últimas 12 semanas.
    for (const k of Object.keys(valor).sort().slice(0, -12)) delete valor[k];
    await salvar('config', { ...(linha || {}), excluido_em: null, chave: 'revisao_semanal', valor });
    atualizarEstado({ config: await listar('config') });
    app.renderizar();
  }).catch(() => {});
  return fila;
}

export function cliquePortfolio(alvo) {
  const { acao, id, valor } = alvo.dataset;
  switch (acao) {
    case 'tarefa-coluna':
      moverTarefa(id, valor);
      return true;
    case 'projeto-visao':
      try { localStorage.setItem('hub.projeto.visao', valor === 'quadro' ? 'quadro' : 'lista'); } catch { /* sem armazenamento */ }
      app.renderizar();
      return true;
    case 'revisao-prioridade':
      mudarRevisao((r) => {
        const lista = new Set(r.prioridades || []);
        if (lista.has(id)) lista.delete(id);
        else if (lista.size < 3) lista.add(id);
        else app.avisoCurto('Já são 3 prioridades. Tire uma para trocar.');
        r.prioridades = [...lista];
      });
      return true;
    case 'revisao-concluir':
      mudarRevisao((r) => { r.feita_em = r.feita_em || new Date().toISOString(); });
      app.avisoCurto('Revisão da semana feita. Boa semana!');
      return true;
    default:
      return false;
  }
}

export function mudancaPortfolio(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'revisao-passo') return false;
  if (tipo !== 'change') return true;
  mudarRevisao((r) => { r.passos = { ...(r.passos || {}), [alvo.value]: alvo.checked }; });
  return true;
}
