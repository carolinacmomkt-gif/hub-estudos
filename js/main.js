// Ponto de partida do app.

import { iniciarTema, atualizarBotoesTema } from './tema.js';
import { ROTAS, rotaAtual } from './rotas.js';
import { obterEstado, atualizarEstado } from './estado.js';
import { montarNavegacao, marcarRotaAtiva } from './views-navegacao.js';
import { renderInicio } from './views-inicio.js';
import { criarViewArea, IDS_AREAS } from './views-areas.js';
import { renderConfiguracoes } from './views-configuracoes.js';
import { ligarEventos } from './eventos.js';

const VIEWS = {
  inicio: renderInicio,
  configuracoes: renderConfiguracoes,
};
ROTAS.filter((r) => IDS_AREAS.includes(r.id)).forEach((r) => {
  VIEWS[r.id] = criarViewArea(r);
});

const conteudo = document.getElementById('conteudo');

function renderizar({ mudouDeTela = false } = {}) {
  const rota = rotaAtual();
  atualizarEstado({ rota: rota.id });
  conteudo.innerHTML = VIEWS[rota.id](obterEstado());
  atualizarBotoesTema();
  marcarRotaAtiva(rota.id);
  document.title = rota.id === 'inicio' ? 'Hub de Estudos' : `${rota.titulo} · Hub de Estudos`;

  if (mudouDeTela) {
    window.scrollTo(0, 0);
    conteudo.querySelector('h1')?.focus({ preventScroll: true });
  }
}

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

  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });
}

function avisarNovaVersao(trabalhador) {
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = '<span>Tem uma versão nova do app.</span><button class="botao botao-primario" type="button">Atualizar</button>';
  aviso.hidden = false;
  aviso.querySelector('button').addEventListener('click', () => {
    trabalhador.postMessage('pular-espera');
  }, { once: true });
}

iniciarTema();
montarNavegacao();
ligarEventos();
renderizar();
window.addEventListener('hashchange', () => renderizar({ mudouDeTela: true }));

// A contagem regressiva do Início se atualiza a cada minuto.
setInterval(() => {
  if (obterEstado().rota === 'inicio' && !document.hidden) renderizar();
}, 60 * 1000);

registrarServiceWorker();
