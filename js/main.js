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
import { renderFaculdade, textoSituacaoFaculdade } from './views-faculdade.js';
import { renderCalendario } from './views-calendario.js';
import { retomarImportacao } from './importar-calendario.js';
import { atualizarSituacaoAvisos } from './eventos-avisos.js';
import { temDadosReais } from './dados-faculdade.js';
import { sincronizarFaculdade, situacaoFaculdade } from './faculdade-sinc.js';
import { ligarEventos } from './eventos.js';
import { carregarConfig, nuvemConfigurada, sessaoAtual, emailDaSessao } from './nuvem.js';
import { listar, situacaoSincronizacao, iniciarSincronizacaoAutomatica, sincronizar } from './persistencia.js';

const VIEWS = {
  inicio: renderInicio,
  configuracoes: renderConfiguracoes,
  caneta: renderCaneta,
  faculdade: renderFaculdade,
  calendario: renderCalendario,
};

// Telas com partes vivas (canvas, ouvintes): montar depois de entrar na página e desmontar ao sair.
const CICLO = {
  caneta: { montar: montarCaneta, desmontar: desmontarCaneta },
  configuracoes: { montar: atualizarSituacaoAvisos, desmontar: () => {} },
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

// Identifica o controle com foco para devolver o foco a ele depois de redesenhar a tela.
function seletorDoFoco() {
  const ativo = document.activeElement;
  if (!ativo || !conteudo.contains(ativo) || ativo === conteudo) return null;
  if (ativo.id) return `#${CSS.escape(ativo.id)}`;
  const partes = ['acao', 'id', 'passo', 'dia', 'visao', 'tipo'].filter((k) => ativo.dataset[k] !== undefined)
    .map((k) => `[data-${k}="${CSS.escape(ativo.dataset[k])}"]`);
  return partes.length ? `${ativo.tagName.toLowerCase()}${partes.join('')}` : null;
}

export function renderizar({ mudouDeTela = false } = {}) {
  if (!noApp) return;
  const rota = rotaAtual();
  if (telaMontada) {
    CICLO[telaMontada].desmontar();
    telaMontada = null;
  }
  if (rota.id === 'calendario' && rota.parametro === 'importar') retomarImportacao();
  atualizarEstado({ rota: rota.id, parametro: rota.parametro, sinc: situacaoSincronizacao(), email: emailDaSessao(), faculdade: situacaoFaculdade() });
  const foco = mudouDeTela ? null : seletorDoFoco();
  conteudo.innerHTML = VIEWS[rota.id](obterEstado());
  if (foco) conteudo.querySelector(`${foco}:not([disabled])`)?.focus({ preventScroll: true });
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

// Tabelas que as telas usam (as páginas de caderno ficam de fora: são pesadas e só o editor abre).
const TABELAS_NA_MEMORIA = {
  caixa_entrada: 'caixa',
  conexoes: 'conexoes',
  disciplinas: 'disciplinas',
  eventos: 'eventos',
  notas_ava: 'notasAva',
  notas_lyceum: 'notasLyceum',
  frequencias: 'frequencias',
  avisos: 'avisos',
  materiais: 'materiais',
  cadernos: 'cadernos',
  config: 'config',
};

async function carregarDadosLocais(tabelas = Object.keys(TABELAS_NA_MEMORIA)) {
  const listas = await Promise.all(tabelas.map((t) => listar(t)));
  const novo = {};
  tabelas.forEach((t, i) => {
    novo[TABELAS_NA_MEMORIA[t]] = listas[i];
  });
  atualizarEstado(novo);
  atualizarEstado({ usandoExemplo: !temDadosReais(obterEstado()) });
}

// Telas que mostram cada tabela (para redesenhar quando os dados mudam).
const TELAS_DA_TABELA = {
  caixa_entrada: ['inicio'],
  conexoes: ['configuracoes', 'faculdade'],
  cadernos: ['inicio'],
  eventos: ['inicio', 'faculdade', 'calendario'],
  disciplinas: ['inicio', 'faculdade', 'calendario'],
  config: ['inicio', 'calendario', 'configuracoes'],
};

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
    // Ao abrir: baixa o que mudou e, se faz mais de 1h, atualiza a faculdade (AVA + Lyceum).
    sincronizar().finally(() => sincronizarFaculdade());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sincronizarFaculdade();
    });
  }
}

// Dados mudaram (no aparelho ou vindos do Supabase): atualiza a tela que mostra esses dados.
window.addEventListener('hub:dados', async (evento) => {
  const { tabela } = evento.detail || {};
  if (!TABELAS_NA_MEMORIA[tabela]) return;
  await carregarDadosLocais([tabela]);
  const telas = TELAS_DA_TABELA[tabela] || ['inicio', 'faculdade'];
  if (noApp && telas.includes(obterEstado().rota) && !digitando() && !obterEstado().ocupado) renderizar();
});

window.addEventListener('hub:faculdade', (evento) => {
  atualizarEstado({ faculdade: evento.detail });
  const linha = conteudo.querySelector('[data-situacao-faculdade]');
  if (linha) linha.textContent = textoSituacaoFaculdade(obterEstado());
  const botao = conteudo.querySelector('[data-acao="sincronizar-faculdade"]');
  if (botao) {
    botao.disabled = evento.detail.estado === 'sincronizando';
    botao.textContent = botao.disabled ? 'Sincronizando…' : 'Sincronizar agora';
  }
});

// A leitura do calendário acadêmico mudou de situação (enviando → lendo → pronto/erro).
window.addEventListener('hub:importacao', () => {
  const { rota, parametro } = obterEstado();
  if (noApp && rota === 'calendario' && parametro === 'importar' && !digitando()) renderizar();
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
