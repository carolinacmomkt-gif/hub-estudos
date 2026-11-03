// Gestão de projetos: quadro das tarefas (a fazer → fazendo → feito), lista/quadro do projeto e a
// revisão semanal (config "revisao_semanal" { [segunda]: { passos, prioridades, feita_em } }).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { aoConcluir, aoDesfazer, iso } from './dados-tarefas.js';
import { segundaDe } from './dados-portfolio.js';
import { definirModo, nomeDoModo } from './modos.js';
import { confirmar } from './confirmar.js';
import { montarNavegacao } from './views-navegacao.js';

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
    case 'faculdade-arquivar':
      confirmar('Arquivar a Faculdade? Notas, cadernos e materiais ficam guardados em Estudos, mas a Faculdade sai do menu, do Hoje, dos avisos e da sincronização automática. Dá para tirar do arquivo quando quiser.', { botao: 'Arquivar' })
        .then((ok) => ok && arquivarFaculdade(true));
      return true;
    case 'faculdade-desarquivar':
      arquivarFaculdade(false);
      return true;
    case 'modo-tudo':
      trocarModo('tudo');
      return true;
    case 'revisao-concluir':
      mudarRevisao((r) => { r.feita_em = r.feita_em || new Date().toISOString(); });
      app.avisoCurto('Revisão da semana feita. Boa semana!');
      return true;
    default:
      return false;
  }
}

async function arquivarFaculdade(arquivada) {
  const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'faculdade_arquivo');
  await salvar('config', { ...(linha || {}), excluido_em: null, chave: 'faculdade_arquivo', valor: { arquivada, em: new Date().toISOString() } });
  atualizarEstado({ config: await listar('config') });
  montarNavegacao();
  app.renderizar();
  app.avisoCurto(arquivada ? 'Faculdade no arquivo. Ela continua em Estudos → Faculdade (pelo endereço) e em Configurações.' : 'A Faculdade voltou para o menu e o Hoje.');
}

function trocarModo(id) {
  definirModo(id);
  montarNavegacao();
  app.renderizar();
  app.avisoCurto(id === 'tudo' ? 'Mostrando tudo de novo.' : `Modo ${nomeDoModo(id)}: o menu e o Hoje mostram só esse contexto.`);
}

export function mudancaPortfolio(alvo, tipo) {
  if (alvo.dataset?.acaoMudar === 'modo-foco') {
    if (tipo === 'change') trocarModo(alvo.value);
    return true;
  }
  if (alvo.dataset?.acaoMudar !== 'revisao-passo') return false;
  if (tipo !== 'change') return true;
  mudarRevisao((r) => { r.passos = { ...(r.passos || {}), [alvo.value]: alvo.checked }; });
  return true;
}
