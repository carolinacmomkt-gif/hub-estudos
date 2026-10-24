// Cliques e formulários dos avisos de prazo e do plano de estudo.

import { obterEstado } from './estado.js';
import { ativarAvisos, desativarAvisos, testarAvisos, situacaoAvisos, salvarConfigAvisos, configDeAvisos } from './avisos.js';
import { situacaoAvisosHtml } from './views-avisos.js';
import { renderFolhaPlano } from './views-plano.js';
import {
  preferenciasPlano, salvarPreferenciasPlano, sugerirSessoes, criarPlano, remarcarPlano, dispensarPlano,
} from './plano-estudo.js';

let app; // { avisoCurto }

export function ligarAvisos(funcoes) {
  app = funcoes;
}

// Preenche o quadro "este aparelho" em Configurações (precisa perguntar ao navegador).
export async function atualizarSituacaoAvisos() {
  const caixa = document.getElementById('avisos-situacao');
  if (!caixa) return;
  const s = await situacaoAvisos();
  const atual = document.getElementById('avisos-situacao');
  if (atual) atual.innerHTML = situacaoAvisosHtml(s);
}

async function comBotao(botao, fn) {
  botao.disabled = true;
  try {
    return await fn();
  } finally {
    botao.disabled = false;
  }
}

const provaPeloId = (id) => (obterEstado().eventos || []).find((e) => e.id === id && !e.excluido_em);
const sessoesTexto = (n) => `${n} ${n === 1 ? 'sessão' : 'sessões'}`;

export function cliqueAvisos(alvo) {
  const prova = alvo.dataset.id ? provaPeloId(alvo.dataset.id) : null;
  switch (alvo.dataset.acao) {
    case 'avisos-ativar':
      comBotao(alvo, async () => {
        const erro = await ativarAvisos();
        await atualizarSituacaoAvisos();
        app.avisoCurto(erro || 'Avisos ligados neste aparelho.');
      });
      return true;
    case 'avisos-desativar':
      comBotao(alvo, async () => {
        await desativarAvisos();
        await atualizarSituacaoAvisos();
        app.avisoCurto('Avisos desligados neste aparelho.');
      });
      return true;
    case 'avisos-testar':
      comBotao(alvo, async () => {
        const r = await testarAvisos();
        app.avisoCurto(r.ok ? `Aviso de teste enviado para ${r.aparelhos} ${r.aparelhos === 1 ? 'aparelho' : 'aparelhos'}.` : r.erro);
      });
      return true;
    case 'plano-criar':
      if (!prova) return true;
      comBotao(alvo, async () => {
        const sessoes = sugerirSessoes(prova, preferenciasPlano(obterEstado()));
        await criarPlano(prova, sessoes);
        app.avisoCurto(`Plano criado: ${sessoesTexto(sessoes.length)} no calendário.`);
      });
      return true;
    case 'plano-ajustar': {
      if (!prova) return true;
      const folha = document.getElementById('folha-evento');
      document.getElementById('folha-evento-titulo').textContent = 'Plano de estudo';
      document.getElementById('folha-evento-conteudo').innerHTML = renderFolhaPlano(obterEstado(), prova);
      folha.showModal();
      return true;
    }
    case 'plano-dispensar':
      if (prova) dispensarPlano(prova).then(() => app.avisoCurto('Tudo bem. Se mudar de ideia, crie as revisões pelo Calendário.'));
      return true;
    case 'plano-remarcar':
      if (!prova) return true;
      comBotao(alvo, async () => {
        await remarcarPlano(obterEstado(), prova, preferenciasPlano(obterEstado()));
        app.avisoCurto('Sessões remarcadas para a nova data.');
      });
      return true;
    case 'plano-manter':
      if (prova) dispensarPlano(prova, { manter: true });
      return true;
    default:
      return false;
  }
}

const marcados = (form, nome) => [...form.querySelectorAll(`input[name="${nome}"]`)].filter((c) => c.checked).map((c) => c.value);

async function salvarSessoesAjustadas(form) {
  const prova = provaPeloId(form.dataset.id);
  if (!prova) return;
  const dias = marcados(form, 'dia');
  const hora = form.elements.hora.value;
  const minutos = Number(form.elements.minutos.value) || 50;
  const erro = form.querySelector('[data-erro]');
  if (!dias.length || !/^\d{2}:\d{2}$/.test(hora)) {
    erro.textContent = !dias.length ? 'Escolha pelo menos um dia.' : 'Escolha o horário.';
    erro.hidden = false;
    return;
  }
  form.querySelector('[type="submit"]').disabled = true;
  await criarPlano(prova, dias.map((dia) => ({ dia, hora, minutos })));
  document.getElementById('folha-evento').close();
  app.avisoCurto(`Plano criado: ${sessoesTexto(dias.length)} no calendário.`);
}

export function enviarAvisos(form) {
  if (form.dataset.form === 'plano') {
    salvarSessoesAjustadas(form);
    return true;
  }
  return form.dataset.form === 'avisos' || form.dataset.form === 'plano-prefs';
}

// As preferências salvam sozinhas a cada mudança.
export function mudancaAvisos(alvo) {
  const form = alvo.closest('[data-form="avisos"], [data-form="plano-prefs"]');
  if (!form) return false;
  const hora = form.elements.hora.value;
  if (!/^\d{2}:\d{2}$/.test(hora)) return true;
  if (form.dataset.form === 'avisos') {
    const atual = configDeAvisos(obterEstado());
    const marcos = Object.fromEntries(Object.keys(atual.marcos).map((m) => [m, false]));
    const tipos = Object.fromEntries(Object.keys(atual.tipos).map((t) => [t, false]));
    marcados(form, 'marco').forEach((m) => { marcos[m] = true; });
    marcados(form, 'tipo').forEach((t) => { tipos[t] = true; });
    salvarConfigAvisos({ hora, marcos, tipos }).then(() => app.avisoCurto('Preferências dos avisos salvas.'));
  } else {
    const dias = marcados(form, 'dias').map(Number);
    if (!dias.length) {
      app.avisoCurto('Deixe pelo menos um dia marcado.');
      return true;
    }
    salvarPreferenciasPlano({ dias, hora, minutos: Number(form.elements.minutos.value) || 50 })
      .then(() => app.avisoCurto('Preferências do plano salvas.'));
  }
  return true;
}
