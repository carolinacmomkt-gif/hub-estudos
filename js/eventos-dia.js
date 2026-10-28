// Cliques e formulários do "Planejar meu dia" (card do Hoje).

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { chamar } from './funcoes.js';
import { prefsDoDia, planoDeHoje, planoSimples, conferirBlocos, paraMin } from './dados-dia.js';
import { valorMeuDia, montarEntrada, formBloco, dataLocal, minutoAgora } from './views-dia.js';
import { celebrar } from './celebracao.js';

let app; // { renderizar, avisoCurto }

export function ligarDia(funcoes) {
  app = funcoes;
}

async function mudar(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'meu_dia');
  const valor = { ...(atual?.valor || {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), chave: 'meu_dia', valor });
  atualizarEstado({ config: await listar('config') });
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();
const planoAtual = () => planoDeHoje(valorMeuDia(obterEstado()), dataLocal());

async function planejar(form, modo) {
  const f = new FormData(form);
  const prefs = prefsDoDia({ prefs: { inicio: f.get('inicio'), fim: f.get('fim'), almoco: f.get('almoco') } });
  const nota = String(f.get('nota') || '').trim();
  const entrada = montarEntrada(obterEstado(), { nota });
  const agoraMin = minutoAgora();
  if (agoraMin >= paraMin(prefs.fim)) {
    atualizarEstado({ erroDia: `Seu dia já terminou (às ${prefs.fim}). Mude o horário de fim para planejar o resto do dia.` });
    app.renderizar();
    return;
  }
  let resultado;
  if (modo === 'ia') {
    atualizarEstado({ planejandoDia: true, erroDia: null });
    app.renderizar();
    const r = await chamar('planejar-dia', { entrada, prefs, agoraMin });
    atualizarEstado({ planejandoDia: false });
    if (!r.ok) {
      atualizarEstado({ erroDia: `${r.erro || 'A IA não respondeu.'} Dá para usar "Planejar sem IA".` });
      app.renderizar();
      return;
    }
    resultado = { blocos: r.blocos, dica: r.dica, fonte: 'ia' };
  } else {
    resultado = { blocos: planoSimples(entrada, prefs, agoraMin), dica: '', fonte: 'simples' };
  }
  await mudar((v) => {
    v.prefs = prefs;
    v.plano = { data: dataLocal(), aceito: false, criado_em: new Date().toISOString(), nota, entrada: { compromissos: entrada.compromissos, tarefas: entrada.tarefas }, ...resultado };
  });
  atualizarEstado({ erroDia: null });
  app.renderizar();
}

export function cliqueDia(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('dia-')) return false;
  switch (acao) {
    case 'dia-planejar': {
      const form = alvo.closest('form');
      if (form && !obterEstado().planejandoDia) planejar(form, alvo.dataset.modo);
      break;
    }
    case 'dia-editar': {
      const b = planoAtual()?.blocos.find((x) => x.id === id);
      if (b) abrirFolha('Ajustar o bloco', formBloco(b));
      break;
    }
    case 'dia-bloco-excluir':
      mudar((v) => { v.plano.blocos = v.plano.blocos.filter((b) => b.id !== id); }).then(() => {
        fecharFolha();
        app.renderizar();
      });
      break;
    case 'dia-aceitar':
      mudar((v) => { v.plano.aceito = true; v.plano.aceito_em = new Date().toISOString(); }).then(() => {
        app.renderizar();
        celebrar('🗓️', 'Dia planejado!', 'Os blocos estão na Agenda de hoje e cada um avisa quando começa.');
      });
      break;
    case 'dia-refazer':
    case 'dia-descartar':
      mudar((v) => { v.plano = null; }).then(() => {
        atualizarEstado({ erroDia: null });
        app.renderizar();
      });
      break;
    default:
      return false;
  }
  return true;
}

export function enviarDia(form) {
  if (form.dataset.form === 'dia-pedir') {
    if (!obterEstado().planejandoDia) planejar(form, 'ia');
    return true;
  }
  if (form.dataset.form !== 'dia-bloco') return false;
  const f = new FormData(form);
  const titulo = String(f.get('titulo') || '').trim();
  const ini = paraMin(f.get('inicio'));
  const fim = paraMin(f.get('fim'));
  const erro = form.querySelector('[data-erro]');
  if (!titulo || ini === null || fim === null || fim <= ini) {
    erro.textContent = !titulo ? 'Dê um nome ao bloco.' : 'O fim precisa ser depois do começo.';
    erro.hidden = false;
    return true;
  }
  const plano = planoAtual();
  if (!plano) return true;
  const prefs = prefsDoDia(valorMeuDia(obterEstado()));
  const blocos = plano.blocos.filter((b) => b.tipo !== 'compromisso').map((b) => (b.id === form.dataset.id ? { ...b, titulo, inicio: f.get('inicio'), fim: f.get('fim') } : b));
  // O bloco editado vai primeiro: se bater com outro, quem sai é o outro.
  blocos.sort((a, b) => (b.id === form.dataset.id) - (a.id === form.dataset.id));
  const entrada = { compromissos: plano.entrada?.compromissos || [], tarefas: plano.entrada?.tarefas || [] };
  const conferidos = conferirBlocos(blocos, entrada, { ...prefs, inicio: '00:00', fim: '23:59' }, 0);
  if (!conferidos.some((b) => b.titulo === titulo && b.inicio === f.get('inicio'))) {
    erro.textContent = 'Esse horário bate com um compromisso fixo. Escolha outro.';
    erro.hidden = false;
    return true;
  }
  mudar((v) => { v.plano.blocos = conferidos; }).then(() => {
    fecharFolha();
    app.renderizar();
  });
  return true;
}
