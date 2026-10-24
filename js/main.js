// Ponto de partida do app.

import { iniciarTema, atualizarBotoesTema } from './tema.js';
import { ROTAS, rotaAtual } from './rotas.js';
import { obterEstado, atualizarEstado } from './estado.js';
import { montarNavegacao, marcarRotaAtiva, atualizarIndicadorSincronizacao } from './views-navegacao.js';
import { renderInicio } from './views-inicio.js';
import { criarViewArea, IDS_AREAS } from './views-areas.js';
import { renderConfiguracoes, textoSituacao } from './views-configuracoes.js';
import { renderLogin } from './views-login.js';
import { renderCaneta, montarCaneta, desmontarCaneta } from './views-caneta.js';
import { ligarEventos } from './eventos.js';
import { carregarConfig, nuvemConfigurada, sessaoAtual, emailDaSessao } from './nuvem.js';
import { listar, situacaoSincronizacao, iniciarSincronizacaoAutomatica } from './persistencia.js';

const VIEWS = {
  inicio: renderInicio,
  configuracoes: renderConfiguracoes,
  caneta: renderCaneta,
};

// Telas com partes vivas (canvas, ouvintes): montar depois de entrar na página e desmontar ao sair.
const CICLO = {
  caneta: { montar: montarCaneta, desmontar: desmontarCaneta },
};
let telaMontada = null;
ROTAS.filter((r) => IDS_AREAS.includes(r.id)).forEach((r) => {
  VIEWS[r.id] = criarViewArea(r);
});

const conteudo = document.getElementById('conteudo');
let noApp = false;
let sincronizacaoIniciada = false;

function digitando() {
  const ativo = document.activeElement;
  return conteudo.contains(ativo) && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName);
}

export function renderizar({ mudouDeTela = false } = {}) {
  if (!noApp) return;
  const rota = rotaAtual();
  if (telaMontada) {
    CICLO[telaMontada].desmontar();
    telaMontada = null;
  }
  atualizarEstado({ rota: rota.id, sinc: situacaoSincronizacao(), email: emailDaSessao() });
  conteudo.innerHTML = VIEWS[rota.id](obterEstado());
  if (CICLO[rota.id]) {
    telaMontada = rota.id;
    CICLO[rota.id].montar();
  }
  atualizarBotoesTema();
  marcarRotaAtiva(rota.id);
  document.title = rota.id === 'inicio' ? 'Hub de Estudos' : `${rota.titulo} · Hub de Estudos`;

  if (mudouDeTela) {
    window.scrollTo(0, 0);
    conteudo.querySelector('h1')?.focus({ preventScroll: true });
  }
}

async function carregarDadosLocais() {
  const [caixa, conexoes] = await Promise.all([listar('caixa_entrada'), listar('conexoes')]);
  atualizarEstado({ caixa, conexoes });
}

export function mostrarLogin(opcoes = {}) {
  noApp = false;
  document.body.classList.add('modo-login');
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  conteudo.innerHTML = renderLogin(opcoes);
  document.title = 'Entrar · Hub de Estudos';
  conteudo.querySelector('input:not([type="hidden"])')?.focus();
}

export async function entrarNoApp() {
  noApp = true;
  document.body.classList.remove('modo-login');
  await carregarDadosLocais();
  renderizar();
  if (!sincronizacaoIniciada) {
    sincronizacaoIniciada = true;
    iniciarSincronizacaoAutomatica();
  }
}

// Dados mudaram (no aparelho ou vindos do Supabase): atualiza a tela que mostra esses dados.
window.addEventListener('hub:dados', async (evento) => {
  const { tabela } = evento.detail || {};
  if (tabela !== 'caixa_entrada' && tabela !== 'conexoes') return;
  await carregarDadosLocais();
  const rota = obterEstado().rota;
  const mostra = (tabela === 'caixa_entrada' && rota === 'inicio') || (tabela === 'conexoes' && rota === 'configuracoes');
  if (mostra && !digitando() && !obterEstado().ocupado) renderizar();
});

window.addEventListener('hub:sincronizacao', () => {
  const s = situacaoSincronizacao();
  atualizarIndicadorSincronizacao(s);
  const linha = conteudo.querySelector('[data-situacao-sinc]');
  if (linha) linha.textContent = textoSituacao(s);
});

window.addEventListener('hub:sessao-expirada', () => {
  mostrarLogin({ email: obterEstado().email || '', mensagem: 'Sua sessão expirou. Entre de novo; seus dados continuam no aparelho.' });
});

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registro = await navigator.serviceWorker.register('./sw.js');
      registro.addEventListener('updatefound', () => {
        const novo = registro.installing;
        novo?.addEventListener('statechange', () => {
          // Só avisa quando já existe uma versão rodando (não na primeira instalação).
          if (novo.state === 'installed' && navigator.serviceWorker.controller) avisarNovaVersao(novo);
        });
      });
    } catch (erro) {
      console.warn('Não foi possível ativar o modo offline.', erro);
    }
  });

  // Recarrega só quando a Carol pediu a atualização (na primeira instalação o
  // service worker também assume a página, e recarregar ali apagaria o que ela digitava).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (atualizacaoPedida) location.reload();
  });
}

let atualizacaoPedida = false;

function avisarNovaVersao(trabalhador) {
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = '<span>Tem uma versão nova do app.</span><button class="botao botao-primario" type="button">Atualizar</button>';
  aviso.hidden = false;
  aviso.querySelector('button').addEventListener('click', () => {
    atualizacaoPedida = true;
    trabalhador.postMessage('pular-espera');
  }, { once: true });
}

async function iniciar() {
  iniciarTema();
  montarNavegacao();
  ligarEventos({ renderizar, mostrarLogin, entrarNoApp });
  window.addEventListener('hashchange', () => renderizar({ mudouDeTela: true }));
  registrarServiceWorker();

  // Com sessão guardada, abre na hora (mesmo offline) e atualiza a configuração por trás.
  if (nuvemConfigurada() && sessaoAtual()) {
    carregarConfig();
    await entrarNoApp();
    return;
  }
  await carregarConfig();
  if (nuvemConfigurada() && !sessaoAtual()) mostrarLogin();
  else await entrarNoApp(); // modo local: Supabase ainda não configurado
}

// A contagem regressiva do Início se atualiza a cada minuto.
setInterval(() => {
  if (noApp && obterEstado().rota === 'inicio' && !document.hidden && !digitando()) renderizar();
}, 60 * 1000);

iniciar();
