// Ponto de partida do app.

import { iniciarTema, atualizarBotoesTema } from './tema.js';
import { ROTAS, rotaAtual } from './rotas.js';
import { obterEstado, atualizarEstado } from './estado.js';
import { montarNavegacao, marcarRotaAtiva, atualizarIndicadorSincronizacao } from './views-navegacao.js';
import { renderInicio } from './views-inicio.js';
import { renderBiblioteca } from './views-biblioteca.js';
import { renderQuestoes } from './views-questoes.js';
import { renderSubstack } from './views-substack.js';
import { renderEstudos } from './views-estudos.js';
import { renderFoco } from './views-foco.js';
import { renderTarefas } from './views-tarefas.js';
import { renderFinancas } from './views-financas.js';
import { montarEditorTexto, desmontarEditorTexto } from './editor-texto.js';
import { formatoDoCaderno } from './dados-texto.js';
import { retomarTrilha } from './trilha.js';
import { semearLazer } from './ideias-lazer.js';
import { ligarTablet, irAoPontoDaRota, depoisDeDesenhar } from './tablet.js';
import { abrirCompartilhado, conectarComToken, tokenDoTrelloNoEndereco, lerDemandasSeFaz } from './eventos-demandas.js';
import { renderHabitos } from './views-habitos.js';
import { renderMetas } from './views-metas.js';
import { conferirConquistas } from './eventos-recompensas.js';
import { renderResumo } from './views-resumo.js';
import { retomarTrabalhos } from './trabalhos-ia.js';
import { iniciarBiblioteca, reaplicarBusca } from './eventos-biblioteca.js';
import { filtrarListaNaTela } from './eventos-questoes.js';
import { salvarSubstackAgora } from './eventos-substack.js';
import { reaplicarBuscaCadernos } from './eventos-cadernos.js';
import { atualizarTela as atualizarFoco } from './foco.js';
import { renderConfiguracoes, textoSituacao } from './views-configuracoes.js';
import { renderLogin } from './views-login.js';
import { renderCaneta, montarCaneta, desmontarCaneta } from './views-caneta.js';
import { renderFaculdade, textoSituacaoFaculdade } from './views-faculdade.js';
import { renderCalendario } from './views-calendario.js';
import { renderCadernos } from './views-cadernos.js';
import { renderYoutube } from './views-youtube.js';
import { montarEditorCaderno, desmontarEditorCaderno } from './editor-caderno.js';
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
  cadernos: renderCadernos,
  youtube: renderYoutube,
  biblioteca: renderBiblioteca,
  questoes: renderQuestoes,
  substack: renderSubstack,
  estudos: renderEstudos,
  foco: renderFoco,
  tarefas: renderTarefas,
  financas: renderFinancas,
  habitos: renderHabitos,
  metas: renderMetas,
  resumo: renderResumo,
};

// Telas com partes vivas (canvas, ouvintes): montar depois de entrar na página e desmontar ao sair.
const CICLO = {
  caneta: { montar: montarCaneta, desmontar: desmontarCaneta },
  configuracoes: { montar: atualizarSituacaoAvisos, desmontar: () => {} },
  // Só o editor (#cadernos/<id>) tem partes vivas; a lista não.
  cadernos: {
    montar: (id) => {
      if (!id) return;
      const formato = formatoDoCaderno((obterEstado().cadernos || []).find((c) => c.id === id) || { id });
      if (formato === 'tinta') montarEditorCaderno(id);
      else montarEditorTexto(id, formato);
    },
    desmontar: () => {
      desmontarEditorCaderno();
      desmontarEditorTexto();
    },
  },
};
let telaMontada = null;

const conteudo = document.getElementById('conteudo');
let noApp = false;
let sincronizacaoIniciada = false;

function digitando() {
  const ativo = document.activeElement;
  return conteudo.contains(ativo) && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName);
}

// Um formulário da tela foi mexido (arquivo escolhido, texto digitado, opção trocada) e ainda não
// foi enviado: redesenhar por fora apagaria o que a Carol preencheu.
function formularioMexido() {
  for (const campo of conteudo.querySelectorAll('form[data-form] input, form[data-form] textarea, form[data-form] select')) {
    if (campo.type === 'file') {
      if (campo.files?.length) return true;
    } else if (campo.type === 'checkbox' || campo.type === 'radio') {
      if (campo.checked !== campo.defaultChecked) return true;
    } else if (campo.tagName === 'SELECT') {
      if ([...campo.options].some((o) => o.selected !== o.defaultSelected)) return true;
    } else if (campo.type !== 'search' && campo.value !== campo.defaultValue) return true;
  }
  return false;
}

// Também não redesenha no meio de um arraste nem enquanto a Carol arruma o Hoje (os botões pulariam).
const podeRedesenharPorFora = () => !digitando() && !formularioMexido() && !obterEstado().ocupado
  && !obterEstado().editandoInicio && !document.querySelector('.arrastando, .redimensionando');

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
  if (mudouDeTela) salvarSubstackAgora();
  // Sair do Hoje no meio da arrumação encerra o modo de personalizar (as mudanças já estão salvas).
  if (mudouDeTela && rota.id !== 'inicio' && obterEstado().editandoInicio) atualizarEstado({ editandoInicio: false });
  if (telaMontada) {
    CICLO[telaMontada].desmontar();
    telaMontada = null;
  }
  if (rota.id === 'calendario' && rota.parametro === 'importar') retomarImportacao();
  atualizarEstado({ rota: rota.id, parametro: rota.parametro, sinc: situacaoSincronizacao(), email: emailDaSessao(), faculdade: situacaoFaculdade() });
  const foco = mudouDeTela ? null : seletorDoFoco();
  conteudo.dataset.tela = rota.id;
  conteudo.innerHTML = VIEWS[rota.id](obterEstado());
  if (foco) conteudo.querySelector(`${foco}:not([disabled])`)?.focus({ preventScroll: true });
  // As buscas filtram na tela (sem redesenhar a cada letra): reaplica depois de redesenhar.
  if (rota.id === 'biblioteca') reaplicarBusca();
  if (rota.id === 'cadernos' && !rota.parametro) reaplicarBuscaCadernos();
  if (rota.id === 'questoes' && !rota.parametro) filtrarListaNaTela('q-lista', document.getElementById('q-busca')?.value);
  if (CICLO[rota.id]) {
    telaMontada = rota.id;
    CICLO[rota.id].montar(rota.parametro);
  }
  atualizarBotoesTema();
  marcarRotaAtiva(rota.id);
  atualizarFoco({ soRelogio: true }); // a barrinha do foco some na tela do foco e aparece nas outras
  document.title = rota.id === 'inicio' ? 'Bússola' : `${rota.titulo} · Bússola`;

  // Aba ativa sempre à vista quando as abas rolam de lado (celular).
  ajustarBarrasDeAbas();
  if (mudouDeTela) {
    // Entrada suave só na troca de tela (redesenhos por fora não piscam).
    conteudo.classList.remove('tela-nova');
    void conteudo.offsetWidth;
    conteudo.classList.add('tela-nova');
    // Tira a classe logo depois: um redesenho por fora não pode fazer a tela piscar de novo.
    clearTimeout(renderizar.entrada);
    renderizar.entrada = setTimeout(() => conteudo.classList.remove('tela-nova'), 260);
    window.scrollTo(0, 0);
    conteudo.querySelector('h1')?.focus({ preventScroll: true });
    // Atalhos do ícone e do teclado (ex.: #tarefas/nova): já vai até o campo certo.
    irAoPontoDaRota(rota.id, rota.parametro);
  } else depoisDeDesenhar();
}

// Tabelas que as telas usam (as páginas de caderno ficam de fora: são pesadas e só o editor abre).
const TABELAS_NA_MEMORIA = {
  caixa_entrada: 'caixa',
  demandas: 'demandas',
  conexoes: 'conexoes',
  disciplinas: 'disciplinas',
  eventos: 'eventos',
  notas_ava: 'notasAva',
  notas_lyceum: 'notasLyceum',
  frequencias: 'frequencias',
  avisos: 'avisos',
  materiais: 'materiais',
  cadernos: 'cadernos',
  pastas: 'pastas',
  config: 'config',
  videos: 'videos',
  artigos: 'artigos',
  questoes: 'questoes',
  revisoes: 'revisoes',
  simulados: 'simulados',
  pautas_substack: 'pautas',
  areas: 'areas',
  respostas: 'respostas',
  sessoes_foco: 'sessoesFoco',
  diario: 'diario',
  tarefas: 'tarefas',
  projetos: 'projetos',
  financas: 'financas',
  habitos: 'habitos',
  habito_registros: 'habitoRegistros',
  metas: 'metas',
  lazer: 'lazer',
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
  demandas: ['inicio'],
  conexoes: ['configuracoes', 'faculdade', 'inicio'],
  cadernos: ['inicio', 'cadernos', 'estudos'],
  pastas: ['cadernos'],
  sessoes_foco: ['foco', 'inicio', 'resumo'],
  diario: ['inicio'],
  tarefas: ['tarefas', 'inicio', 'metas'],
  projetos: ['tarefas', 'inicio', 'metas'],
  financas: ['financas', 'inicio', 'metas'],
  habitos: ['habitos', 'inicio', 'metas'],
  habito_registros: ['habitos', 'inicio', 'metas'],
  metas: ['metas', 'inicio'],
  lazer: ['metas', 'inicio'],
  respostas: ['resumo', 'inicio'],
  eventos: ['inicio', 'faculdade', 'calendario'],
  disciplinas: ['inicio', 'faculdade', 'calendario'],
  config: ['inicio', 'calendario', 'configuracoes', 'youtube', 'substack', 'foco', 'financas', 'metas'],
  videos: ['youtube', 'inicio'],
  artigos: ['biblioteca', 'inicio', 'estudos', 'substack', 'questoes'],
  questoes: ['questoes', 'inicio', 'estudos'],
  revisoes: ['questoes', 'inicio'],
  simulados: ['questoes'],
  pautas_substack: ['substack', 'inicio'],
  areas: ['estudos', 'inicio', 'biblioteca', 'questoes', 'cadernos'],
};

// Link ou texto compartilhado de outro app (Web Share Target, no Android): a Carol escolhe se
// vira demanda, leitura ou ideia na caixa de entrada (a folha abre depois do primeiro desenho).
let compartilhadoPendente = null;
function aplicarCompartilhado() {
  const p = new URLSearchParams(location.search);
  if (!['url', 'text', 'title'].some((k) => p.get(k))) return;
  const texto = p.get('text') || '';
  const url = p.get('url') || (texto.match(/https?:\/\/\S+/) || [])[0] || '';
  const sobra = url ? texto.replace(url, '').trim() : texto;
  compartilhadoPendente = { url, titulo: p.get('title') || '', texto: sobra };
  history.replaceState(null, '', `${location.pathname}#inicio`);
}

export function mostrarLogin(opcoes = {}) {
  noApp = false;
  document.body.classList.add('modo-login');
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  conteudo.innerHTML = renderLogin(opcoes);
  document.title = 'Entrar · Bússola';
  conteudo.querySelector('input:not([type="hidden"])')?.focus();
}

export async function entrarNoApp() {
  noApp = true;
  document.body.classList.remove('modo-login');
  await carregarDadosLocais();
  aplicarCompartilhado();
  const tokenTrello = tokenDoTrelloNoEndereco(); // volta da autorização do Trello
  montarNavegacao(); // o menu guardado só chega com a config
  conferirConquistas(); // anota o que já existe neste aparelho (sem comemorar o antigo)
  renderizar();
  if (compartilhadoPendente) {
    abrirCompartilhado(compartilhadoPendente);
    compartilhadoPendente = null;
  }
  if (tokenTrello) conectarComToken('trello', tokenTrello);
  if (!sincronizacaoIniciada) {
    sincronizacaoIniciada = true;
    iniciarSincronizacaoAutomatica();
    retomarTrabalhos();
    iniciarBiblioteca();
    // Ao abrir: baixa o que mudou e, se faz mais de 1h, atualiza a faculdade (AVA + Lyceum).
    // Depois de receber o que está na nuvem, chegam as ideias de lazer da semana (sem repetir).
    sincronizar().finally(() => {
      sincronizarFaculdade();
      lerDemandasSeFaz();
      semearLazer();
    });
    retomarTrilha();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      sincronizarFaculdade();
      semearLazer();
    });
  }
}

// Dados mudaram (no aparelho ou vindos do Supabase): atualiza a tela que mostra esses dados.
window.addEventListener('hub:dados', async (evento) => {
  const { tabela, daNuvem } = evento.detail || {};
  if (!TABELAS_NA_MEMORIA[tabela]) return;
  await carregarDadosLocais([tabela]);
  if (tabela === 'financas' && noApp) conferirConquistas();
  if (tabela === 'config') {
    montarNavegacao();
    marcarRotaAtiva(obterEstado().rota);
  }
  const telas = TELAS_DA_TABELA[tabela] || ['inicio', 'faculdade'];
  // O editor de caderno nunca é redesenhado por fora: ele perderia o traço em andamento.
  const { id: rotaVista, parametro: parametroVisto } = rotaAtual();
  if (rotaVista === 'cadernos' && parametroVisto) return;
  if (!noApp || !telas.includes(obterEstado().rota)) return;
  // Mudança feita aqui aparece na hora; o que chega da nuvem em leva vira um redesenho só.
  if (daNuvem) redesenharEmBreve();
  else if (podeRedesenharPorFora()) renderizar();
});

// Barras de abas que rolam de lado: a ativa fica à vista e a borda esmaece onde tem mais itens.
function marcarRolagem(barra) {
  const sobra = barra.scrollWidth - barra.clientWidth;
  if (sobra <= 2) delete barra.dataset.rola;
  else barra.dataset.rola = barra.scrollLeft <= 2 ? 'fim' : barra.scrollLeft >= sobra - 2 ? 'inicio' : 'meio';
}

function ajustarBarrasDeAbas() {
  for (const barra of conteudo.querySelectorAll('.segmentado:not(:has(.segmentado-opcao)), .tarefa-filtros')) {
    const ativa = barra.querySelector('[aria-current="page"], [aria-pressed="true"], [aria-selected="true"]');
    if (ativa && barra.scrollWidth > barra.clientWidth) {
      barra.style.scrollBehavior = 'auto';
      barra.scrollLeft = ativa.offsetLeft - barra.offsetLeft - (barra.clientWidth - ativa.offsetWidth) / 2;
      barra.style.scrollBehavior = '';
    }
    marcarRolagem(barra);
    if (!barra.dataset.ouveRolagem) {
      barra.dataset.ouveRolagem = '1';
      barra.addEventListener('scroll', () => marcarRolagem(barra), { passive: true });
    }
  }
}
window.addEventListener('resize', () => ajustarBarrasDeAbas());
ligarTablet();

// Celular: ao rolar para baixo o "+" sai da frente; ao subir (ou parar no topo) ele volta.
let ultimaRolagem = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (Math.abs(y - ultimaRolagem) < 8) return;
  const desce = y > ultimaRolagem && y > 120;
  if (desce !== (document.body.dataset.rolando === 'baixo')) {
    if (desce) document.body.dataset.rolando = 'baixo';
    else delete document.body.dataset.rolando;
  }
  ultimaRolagem = y;
}, { passive: true });

// Várias tabelas chegam juntas na sincronização: um redesenho só, no fim da leva.
let redesenhoMarcado = null;
function redesenharEmBreve() {
  clearTimeout(redesenhoMarcado);
  redesenhoMarcado = setTimeout(() => {
    redesenhoMarcado = null;
    if (podeRedesenharPorFora()) renderizar();
  }, 120);
}

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
  if (noApp && obterEstado().rota === 'inicio' && !document.hidden && podeRedesenharPorFora()) renderizar();
}, 60 * 1000);

iniciar();
