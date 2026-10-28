// Cliques e formulários do "Organizar minhas demandas": montar a semana (IA ou sem IA), ajustar
// os blocos, copiar a mensagem de prazo, aceitar tudo (com Desfazer) e a proposta automática
// de manhã. Nada vira tarefa sem o OK da Carol.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, obter, salvar } from './persistencia.js';
import { pedirDemandas } from './funcoes.js';
import { tarefaDaDemanda } from './dados-demandas.js';
import { organizarSimples, moverBloco, tirarDoPlano, prefsOrganizar } from './dados-organizar.js';
import { dataLocal } from './views-dia.js';
import { montarEntradaSemana, previaSemana, propostaDeHoje, valorOrganizar } from './views-organizar.js';

let app; // { renderizar, avisoCurto }

export function ligarOrganizar(funcoes) {
  app = funcoes;
}

async function mudar(fn) {
  const atual = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'organizar');
  const valor = { ...(atual?.excluido_em ? {} : atual?.valor || {}) };
  fn(valor);
  await salvar('config', { ...(atual || {}), excluido_em: null, chave: 'organizar', valor });
  atualizarEstado({ config: await listar('config') });
}

const folha = () => document.getElementById('folha-evento');
const folhaDaSemana = () => folha()?.open && folha().dataset.conteudo === 'organizar';

function mostrarPrevia() {
  const f = folha();
  if (!f) return;
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Sua semana com as demandas';
  document.getElementById('folha-evento-conteudo').innerHTML = previaSemana(obterEstado());
  f.dataset.conteudo = 'organizar';
  if (!f.open) {
    f.showModal();
    f.addEventListener('close', () => { delete f.dataset.conteudo; atualizarEstado({ orgEditando: null }); }, { once: true });
  }
}

// Redesenha a folha aberta sem tirar a rolagem do lugar.
function atualizarPrevia() {
  if (!folhaDaSemana()) return;
  const caixa = document.getElementById('folha-evento-conteudo');
  const rolagem = folha().scrollTop;
  caixa.innerHTML = previaSemana(obterEstado());
  folha().scrollTop = rolagem;
}

export async function montarSemana(modo = 'ia', { silencioso = false } = {}) {
  if (obterEstado().organizando) return null;
  const entrada = montarEntradaSemana(obterEstado());
  if (!entrada.itens.length) {
    if (!silencioso) app.avisoCurto('Nada para organizar: nenhuma demanda esperando.');
    return null;
  }
  if (!entrada.dias.length) {
    if (!silencioso) app.avisoCurto('Não sobrou dia de trabalho nos próximos 14 dias. Confira os dias em Configurações.');
    return null;
  }
  atualizarEstado({ organizando: true });
  app.renderizar();
  let plano = null;
  let fonte = 'simples';
  if (modo === 'ia' && navigator.onLine) {
    const r = await pedirDemandas({ acao: 'organizar', entrada });
    if (r.ok && r.plano) {
      plano = r.plano;
      fonte = 'ia';
    } else if (!silencioso) {
      app.avisoCurto(`${r.erro || 'A IA não respondeu.'} Montei sem IA.`);
    }
  }
  if (!plano) plano = organizarSimples(entrada);
  await mudar((v) => { v.proposta = { plano, entrada, fonte }; });
  atualizarEstado({ organizando: false, orgEditando: null });
  app.renderizar();
  if (!silencioso) mostrarPrevia();
  return plano;
}

// De manhã (ou ao abrir o app pela primeira vez no dia), se ela ligou: monta e só avisa.
export async function organizarSozinha() {
  const estado = obterEstado();
  const v = valorOrganizar(estado);
  const hoje = dataLocal();
  if (!prefsOrganizar(v.prefs).automatico || v.ultimaAutomatica === hoje || propostaDeHoje(estado, hoje)) return;
  if (new Date().getHours() < 6) return;
  if (!(estado.demandas || []).some((d) => !d.excluido_em && d.status === 'nova')) return;
  await mudar((x) => { x.ultimaAutomatica = hoje; });
  const plano = await montarSemana('ia', { silencioso: true });
  if (plano?.blocos.length) app.avisoCurto('Montei uma proposta para a sua semana. Veja no card Demandas.');
}

async function guardarPlano(plano) {
  const p = propostaDeHoje(obterEstado());
  if (!p) return;
  await mudar((v) => { v.proposta = { ...p, plano }; });
  atualizarPrevia();
}

async function aceitarTudo() {
  const p = propostaDeHoje(obterEstado());
  if (!p?.plano.blocos.length) return;
  const hoje = dataLocal();
  const desfazer = [];
  let feitas = 0;
  for (const b of p.plano.blocos) {
    if (b.tarefa_id) {
      const t = await obter('tarefas', b.tarefa_id);
      if (!t || t.feita_em || t.excluido_em) continue;
      desfazer.push({ antes: t });
      await salvar('tarefas', { ...t, data: b.data, hora: b.inicio, dados: { ...(t.dados || {}), organizada: true } });
    } else {
      const d = await obter('demandas', b.demanda_id);
      if (!d || d.status !== 'nova') continue; // já aceita ou descartada em outro lugar
      const base = tarefaDaDemanda(d, hoje);
      const tarefa = await salvar('tarefas', { ...base, data: b.data, hora: b.inicio, dados: { ...base.dados, minutos: b.minutos, organizada: true } });
      await salvar('demandas', { ...d, status: 'aceita', tarefa_id: tarefa.id, mudou: null });
      desfazer.push({ demanda: d, tarefa });
    }
    feitas += 1;
  }
  const valorAntes = valorOrganizar(obterEstado());
  await mudar((v) => { delete v.proposta; });
  folha()?.close();
  app.renderizar();
  app.avisoCurto(feitas ? `Pronto: ${feitas} ${feitas === 1 ? 'tarefa ficou' : 'tarefas ficaram'} na agenda.` : 'Essas demandas já tinham sido resolvidas.', feitas ? {
    rotulo: 'Desfazer',
    fn: async () => {
      for (const x of desfazer.reverse()) {
        if (x.antes) await salvar('tarefas', x.antes);
        else {
          await salvar('tarefas', { ...x.tarefa, excluido_em: new Date().toISOString() });
          await salvar('demandas', { ...x.demanda });
        }
      }
      await mudar((v) => { v.proposta = valorAntes.proposta; });
      app.renderizar();
    },
  } : undefined);
}

export function cliqueOrganizar(alvo) {
  const { acao, item } = alvo.dataset;
  if (!acao?.startsWith('org-')) return false;
  const p = propostaDeHoje(obterEstado());
  switch (acao) {
    case 'org-montar': montarSemana(alvo.dataset.modo === 'simples' ? 'simples' : 'ia'); break;
    case 'org-ver': mostrarPrevia(); break;
    case 'org-editar':
      atualizarEstado({ orgEditando: obterEstado().orgEditando === item ? null : item });
      atualizarPrevia();
      document.querySelector(`.org-mover[data-item="${CSS.escape(item)}"] select`)?.focus();
      break;
    case 'org-tirar':
      if (p) guardarPlano(tirarDoPlano(p.plano, item)).then(() => app.avisoCurto('Tirei do plano. A demanda continua no card.'));
      break;
    case 'org-por': {
      if (!p) break;
      const novo = moverBloco(p.plano, p.entrada, item, { data: alvo.dataset.data });
      if (novo) guardarPlano(novo);
      else app.avisoCurto('Não coube nesse dia.');
      break;
    }
    case 'org-copiar': {
      const n = p?.plano.naoCabe.find((x) => x.item_id === item);
      if (n) navigator.clipboard?.writeText(n.mensagem).then(() => app.avisoCurto('Mensagem copiada.'), () => app.avisoCurto('Não deu para copiar. Segure o texto e copie.'));
      break;
    }
    case 'org-aceitar': aceitarTudo(); break;
    case 'org-descartar':
      mudar((v) => { delete v.proposta; }).then(() => { folha()?.close(); app.renderizar(); app.avisoCurto('Proposta descartada.'); });
      break;
    default:
      return false;
  }
  return true;
}

export function enviarOrganizar(form) {
  if (form.dataset.form === 'org-mover') {
    const p = propostaDeHoje(obterEstado());
    if (!p) return true;
    const novo = moverBloco(p.plano, p.entrada, form.dataset.item, { data: form.elements.data.value, inicio: form.elements.inicio.value });
    if (!novo) {
      app.avisoCurto('Não cabe nesse dia e horário. Tente outro.');
      return true;
    }
    atualizarEstado({ orgEditando: null });
    guardarPlano(novo);
    return true;
  }
  return form.dataset.form === 'org-prefs';
}

// Ajustes salvam sozinhos a cada mudança.
export function mudancaOrganizar(alvo, tipo) {
  const form = alvo.closest?.('[data-form="org-prefs"]');
  if (!form) return false;
  if (tipo !== 'change') return true;
  const dias = [...form.querySelectorAll('input[name="dia"]:checked')].map((i) => Number(i.value));
  if (!dias.length) {
    app.avisoCurto('Escolha pelo menos um dia de trabalho.');
    return true;
  }
  const prefs = prefsOrganizar({ horasPorDia: Number(form.elements.horas.value), dias, automatico: form.elements.automatico.checked });
  mudar((v) => { v.prefs = prefs; }).then(() => app.avisoCurto('Ajustes da semana salvos.'));
  return true;
}
