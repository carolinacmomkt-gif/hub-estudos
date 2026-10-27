// Cliques e formulários de Tarefas e projetos (e dos cards do Hoje).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { lerTarefaRapida, aoConcluir, aoDesfazer, iso } from './dados-tarefas.js';
import { registrarDeslize, ligarDeslizar } from './deslizar.js';
import { flutuar } from './celebracao.js';
import { pontosDaTarefa } from './dados-recompensas.js';
import { formTarefa, lerFormTarefa, formProjeto, lerFormProjeto, textoPrevia, hojeIso } from './views-tarefas.js';

let app; // { renderizar, avisoCurto }

export function ligarTarefas(funcoes) {
  app = funcoes;
  // No celular e no tablet: deslizar para a direita conclui, para a esquerda passa para amanhã.
  ligarDeslizar();
  registrarDeslize('tarefa', {
    direita: { rotulo: 'Feito', fn: (id) => concluir(id, null) },
    esquerda: { rotulo: 'Amanhã', fn: (id) => paraAmanha(id) },
  });
}

async function paraAmanha(id) {
  const t = tarefa(id);
  if (!t) return;
  const antes = t.data;
  const amanha = iso(new Date(Date.now() + 864e5));
  await salvarTarefa({ ...t, data: amanha });
  app.renderizar();
  app.avisoCurto('Passou para amanhã.', {
    rotulo: 'Desfazer',
    fn: async () => {
      await salvarTarefa({ ...tarefa(id), data: antes });
      app.renderizar();
    },
  });
}

const tarefa = (id) => (obterEstado().tarefas || []).find((t) => t.id === id);
const projeto = (id) => (obterEstado().projetos || []).find((p) => p.id === id);
const salvarTarefa = (dados) => gravar('tarefas', 'tarefas', dados);
const salvarProjeto = (dados) => gravar('projetos', 'projetos', dados);

function abrirFolha(titulo, html) {
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
  folha.querySelector('input[name="titulo"]')?.focus();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();

export function abrirNovaTarefa(extra = {}) {
  abrirFolha('Nova tarefa', formTarefa({ data: hojeIso(), ...extra }, obterEstado().projetos));
}

// Marca como feita com uma pequena animação; o aviso traz "Desfazer".
async function concluir(id, botao) {
  const t = tarefa(id);
  if (!t) return;
  const li = botao?.closest('.tarefa');
  li?.classList.add('concluindo');
  const ganho = pontosDaTarefa(t);
  flutuar(botao || document.querySelector(`[data-tarefa="${CSS.escape(id)}"]`) || document.getElementById('aviso'), `+${ganho}`);
  // Primeiro a animação, depois a gravação (gravar redesenha a lista).
  await new Promise((r) => setTimeout(r, li ? 380 : 0));
  await salvarTarefa({ ...t, ...aoConcluir(t, new Date().toISOString(), hojeIso()) });
  app.renderizar();
  app.avisoCurto(t.recorrencia?.tipo ? `Feito! +${ganho} pontos. Volta na próxima data.` : `Feito! +${ganho} pontos.`, {
    rotulo: 'Desfazer',
    fn: async () => {
      const agora = tarefa(id);
      if (agora) await salvarTarefa({ ...agora, ...aoDesfazer(agora) });
      app.renderizar();
    },
  });
}

async function reabrir(id) {
  const t = tarefa(id);
  if (!t) return;
  await salvarTarefa({ ...t, ...aoDesfazer(t) });
  app.renderizar();
}

async function excluirTarefa(id) {
  const t = tarefa(id);
  if (!t) return;
  await salvarTarefa({ ...t, excluido_em: new Date().toISOString() });
  fecharFolha();
  app.renderizar();
  app.avisoCurto('Tarefa excluída.', {
    rotulo: 'Desfazer',
    fn: async () => {
      await salvarTarefa({ ...tarefa(id), excluido_em: null });
      app.renderizar();
    },
  });
}

export function cliqueTarefas(alvo) {
  const { acao, id } = alvo.dataset;
  switch (acao) {
    case 'tarefa-feita':
      concluir(id, alvo);
      return true;
    case 'tarefa-reabrir':
      reabrir(id);
      return true;
    case 'tarefa-abrir': {
      const t = tarefa(id);
      if (t) abrirFolha('Tarefa', formTarefa(t, obterEstado().projetos));
      return true;
    }
    case 'tarefa-nova':
      document.getElementById('folha-criar')?.close();
      abrirNovaTarefa();
      return true;
    case 'tarefa-excluir':
      excluirTarefa(id);
      return true;
    case 'tarefa-filtro':
      atualizarEstado({ filtroTarefas: alvo.dataset.valor || '' });
      app.renderizar();
      return true;
    case 'tarefa-atrasadas-hoje': {
      const hoje = hojeIso();
      const atrasadas = (obterEstado().tarefas || []).filter((t) => !t.excluido_em && !t.feita_em && t.data && t.data < hoje);
      Promise.all(atrasadas.map((t) => salvarTarefa({ ...t, data: hoje }))).then(() => {
        app.renderizar();
        app.avisoCurto(`${atrasadas.length} ${atrasadas.length === 1 ? 'tarefa passou' : 'tarefas passaram'} para hoje.`);
      });
      return true;
    }
    case 'projeto-novo':
      abrirFolha('Novo projeto', formProjeto());
      return true;
    case 'projeto-editar': {
      const p = projeto(id);
      if (p) abrirFolha('Editar projeto', formProjeto(p));
      return true;
    }
    case 'projeto-excluir': {
      const p = projeto(id);
      if (!p || !window.confirm(`Excluir o projeto "${p.titulo}"? As tarefas dele continuam, só que sem projeto.`)) return true;
      const soltas = (obterEstado().tarefas || []).filter((t) => t.projeto_id === id && !t.excluido_em);
      Promise.all([salvarProjeto({ ...p, excluido_em: new Date().toISOString() }), ...soltas.map((t) => salvarTarefa({ ...t, projeto_id: null }))]).then(() => {
        fecharFolha();
        location.hash = '#tarefas/projetos';
        app.avisoCurto('Projeto excluído.');
      });
      return true;
    }
    default:
      return false;
  }
}

export function mudancaTarefas(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'tarefa-previa') {
    const previa = alvo.closest('form')?.querySelector('[data-previa]');
    if (previa) previa.textContent = textoPrevia(alvo.value);
    return true;
  }
  if (acao === 'tarefa-rep') {
    if (tipo !== 'change') return true;
    const form = alvo.closest('form');
    form.querySelector('[data-rep-semanal]').hidden = alvo.value !== 'semanal';
    form.querySelector('[data-rep-mensal]').hidden = alvo.value !== 'mensal';
    return true;
  }
  return false;
}

export function enviarTarefas(form) {
  const tipo = form.dataset.form;
  if (tipo === 'tarefa-rapida') {
    const campo = form.querySelector('[name="texto"]');
    const r = lerTarefaRapida(campo.value, hojeIso());
    if (!r.titulo) return true;
    const projetoId = form.dataset.projeto || null;
    const naTelaDeHoje = !projetoId && (obterEstado().rota === 'inicio' || (obterEstado().rota === 'tarefas' && !obterEstado().parametro) || obterEstado().parametro === 'hoje');
    const area = r.area || (projetoId && projeto(projetoId)?.area) || obterEstado().filtroTarefas || 'pessoal';
    salvarTarefa({
      titulo: r.titulo, data: r.data || (naTelaDeHoje ? hojeIso() : null), hora: r.hora, prioridade: r.prioridade,
      area, recorrencia: r.recorrencia, projeto_id: projetoId, dados: {},
    }).then(() => {
      campo.value = '';
      form.querySelector('[data-previa]').textContent = '';
      app.renderizar();
      // O campo continua pronto para a próxima.
      document.getElementById(campo.id)?.focus();
    });
    return true;
  }
  if (tipo === 'tarefa') {
    const { dados, erro } = lerFormTarefa(form);
    const caixa = form.querySelector('[data-erro]');
    if (erro) {
      caixa.textContent = erro;
      caixa.hidden = false;
      return true;
    }
    const id = form.dataset.id;
    const atual = id ? tarefa(id) : null;
    const base = atual || { dados: {} };
    // Mudar a repetição de uma tarefa já feita: ela volta a ficar aberta.
    if (atual?.feita_em && dados.recorrencia) dados.feita_em = null;
    salvarTarefa({ ...base, ...dados }).then(() => {
      fecharFolha();
      app.renderizar();
      if (!id) app.avisoCurto('Tarefa adicionada.');
    });
    return true;
  }
  if (tipo === 'projeto') {
    const { dados, erro } = lerFormProjeto(form);
    const caixa = form.querySelector('[data-erro]');
    if (erro) {
      caixa.textContent = erro;
      caixa.hidden = false;
      return true;
    }
    const id = form.dataset.id;
    const base = id ? projeto(id) : { status: 'ativo', dados: {} };
    salvarProjeto({ ...base, ...dados }).then((salvo) => {
      fecharFolha();
      if (id) app.renderizar();
      else location.hash = `#tarefas/projeto-${salvo.id}`;
    });
    return true;
  }
  return false;
}

