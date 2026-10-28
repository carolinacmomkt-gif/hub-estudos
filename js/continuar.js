// Continuar de onde parei, em outro aparelho: o caderno (e a página), a leitura da Biblioteca
// (e até onde leu), o simulado em andamento, o rascunho do Substack e o roteiro do YouTube.
// Cada tipo guarda só o último lugar, em config "continuar-<tipo>" (uma linha por tipo, para dois
// aparelhos não apagarem o lugar um do outro), com o aparelho e a hora. No outro
// aparelho, o Hoje mostra um card discreto (até 6h depois); nada abre sozinho.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { esc } from './utilidades.js';
import { idDoAparelho, tipoDoAparelho, noAparelho } from './aparelho.js';

export const PREFIXO_CONTINUAR = 'continuar-';
const CHAVE_DISPENSADOS = 'hub.continuar.dispensados';
const VALE_POR = 6 * 60 * 60 * 1000;
const ESPERA = 8000; // junta as mudanças de alguns segundos numa gravação só

export const TIPOS_CONTINUAR = {
  caderno: { nome: 'Caderno', acao: 'Abrir o caderno' },
  leitura: { nome: 'Leitura', acao: 'Continuar lendo' },
  simulado: { nome: 'Simulado', acao: 'Continuar' },
  pauta: { nome: 'Rascunho do Substack', acao: 'Continuar escrevendo' },
  roteiro: { nome: 'Roteiro do YouTube', acao: 'Abrir o roteiro' },
};

// ---------------------------------------------------------------------------
// O que mostrar no outro aparelho (puro, para os testes)
// ---------------------------------------------------------------------------

function aindaExiste(estado, tipo, id) {
  const ativo = (lista) => (lista || []).find((x) => x.id === id && !x.excluido_em);
  if (tipo === 'caderno') return ativo(estado.cadernos);
  if (tipo === 'leitura') return ativo(estado.artigos);
  if (tipo === 'simulado') { const s = ativo(estado.simulados); return s && !s.concluido_em ? s : null; }
  if (tipo === 'pauta') return ativo(estado.pautas);
  if (tipo === 'roteiro') return ativo(estado.videos);
  return null;
}

export function itensParaContinuar(estado, { agora = Date.now(), aparelho = idDoAparelho(), dispensados = lerDispensados(), locais = { ...gravados, ...pendentes } } = {}) {
  const lugares = (estado.config || []).filter((c) => !c.excluido_em && String(c.chave).startsWith(PREFIXO_CONTINUAR))
    .map((c) => [c.chave.slice(PREFIXO_CONTINUAR.length), c.valor]);
  return lugares
    .filter(([tipo, item]) => TIPOS_CONTINUAR[tipo] && item?.id && item.aparelho !== aparelho)
    .filter(([tipo, item]) => agora - Number(item.quando) < VALE_POR && Number(item.quando) > (Number(dispensados[tipo]) || 0))
    // Já continuou aqui depois (ainda sem chegar à nuvem): não oferece de novo.
    .filter(([tipo, item]) => !(locais[tipo]?.quando >= Number(item.quando)))
    .map(([tipo, item]) => {
      const registro = aindaExiste(estado, tipo, item.id);
      return registro ? { tipo, ...item, titulo: registro.titulo || item.titulo || TIPOS_CONTINUAR[tipo].nome } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.quando - a.quando)
    .slice(0, 3);
}

export function haQuanto(quando, agora = Date.now()) {
  const min = Math.max(0, Math.round((agora - quando) / 60000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${min % 60 >= 10 ? String(min % 60).padStart(2, '0') : ''}`;
}

export function cardContinuar(estado, agora = Date.now()) {
  const itens = itensParaContinuar(estado, { agora });
  if (!itens.length) return '';
  return `
    <section class="card continuar" aria-labelledby="continuar-titulo">
      <h2 class="card-titulo" id="continuar-titulo">Continuar de onde parou</h2>
      <ul class="continuar-lista">
        ${itens.map((i) => `
          <li class="continuar-item">
            <div class="continuar-texto">
              <span class="continuar-tipo">${esc(TIPOS_CONTINUAR[i.tipo].nome)}${i.detalhe ? ` · ${esc(i.detalhe)}` : ''}</span>
              <strong>${esc(i.titulo)}</strong>
              <span class="texto-suave">${esc(noAparelho(i.tipoAparelho))}, ${esc(haQuanto(i.quando, agora))}</span>
            </div>
            <button class="botao botao-primario botao-pequeno" type="button" data-acao="continuar-abrir" data-tipo="${esc(i.tipo)}">${esc(TIPOS_CONTINUAR[i.tipo].acao)}</button>
            <button class="botao-icone continuar-fechar" type="button" data-acao="continuar-dispensar" data-tipo="${esc(i.tipo)}" aria-label="Dispensar ${esc(TIPOS_CONTINUAR[i.tipo].nome.toLowerCase())}" title="Dispensar">×</button>
          </li>`).join('')}
      </ul>
    </section>`;
}

// ---------------------------------------------------------------------------
// Anotar onde a Carol está (chamado depois de cada tela desenhada e pelo editor de caderno)
// ---------------------------------------------------------------------------

const pendentes = {};
let gravados = {}; // o último gravado por tipo (para não gravar o mesmo de novo)
let temporizador = null;

function lerDispensados() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || '{}') || {};
  } catch {
    return {};
  }
}

function marcar(tipo, dados) {
  const anterior = pendentes[tipo] || gravados[tipo];
  const igual = anterior && anterior.id === dados.id && anterior.detalhe === dados.detalhe
    && Math.abs((anterior.posicao || 0) - (dados.posicao || 0)) < 0.03 && Date.now() - anterior.quando < 10 * 60 * 1000;
  if (igual) return;
  pendentes[tipo] = { ...dados, aparelho: idDoAparelho(), tipoAparelho: tipoDoAparelho(), quando: Date.now() };
  clearTimeout(temporizador);
  temporizador = setTimeout(gravar, ESPERA);
}

export async function gravar() {
  clearTimeout(temporizador);
  const tipos = Object.keys(pendentes);
  if (!tipos.length) return;
  try {
    const configs = await listar('config', { incluirExcluidos: true });
    for (const tipo of tipos) {
      const valor = pendentes[tipo];
      delete pendentes[tipo];
      const chave = `${PREFIXO_CONTINUAR}${tipo}`;
      const atual = configs.find((c) => c.chave === chave);
      await salvar('config', { ...(atual || {}), excluido_em: null, chave, valor });
      gravados[tipo] = valor;
    }
  } catch (erro) {
    console.warn('"Onde parei" não salvo:', erro);
  }
}

export function notarTela(estado = obterEstado()) {
  const { rota, parametro: id } = estado;
  if (!id) return;
  if (rota === 'cadernos') {
    const c = aindaExiste(estado, 'caderno', id);
    // A página vem do editor (notarPaginaDoCaderno); aqui só o caderno, para os outros formatos.
    if (c && !(pendentes.caderno?.id === id && pendentes.caderno.pagina_id)) marcar('caderno', { id, titulo: c.titulo, rota: `#cadernos/${id}` });
  } else if (rota === 'biblioteca' && id !== 'novo') {
    const a = aindaExiste(estado, 'leitura', id);
    // Abrir marca a leitura; até onde leu vem da rolagem (um redesenho não zera a posição).
    if (pedido?.tipo === 'leitura' && pedido.id === id) restaurarLeitura(id);
    else if (a && (pendentes.leitura || gravados.leitura)?.id !== id) marcar('leitura', { id, titulo: a.titulo, rota: `#biblioteca/${id}`, posicao: 0, detalhe: '' });
  } else if (rota === 'questoes' && id !== 'gerar') {
    const s = aindaExiste(estado, 'simulado', id);
    if (s) {
      const total = (s.questoes || []).length;
      const feitas = Object.values(s.respostas || {}).filter((r) => r?.respondida || r?.resposta).length;
      marcar('simulado', { id, titulo: s.titulo, rota: `#questoes/${id}`, detalhe: `${feitas} de ${total} respondidas` });
    }
  } else if (rota === 'substack') {
    const p = aindaExiste(estado, 'pauta', id);
    if (p) marcar('pauta', { id, titulo: p.titulo, rota: `#substack/${id}` });
  } else if (rota === 'youtube' && estado.ytAba === 'roteiro') {
    const v = aindaExiste(estado, 'roteiro', id);
    if (v) marcar('roteiro', { id, titulo: v.titulo, rota: `#youtube/${id}` });
  }
}

export function notarPaginaDoCaderno(caderno, pagina, numero) {
  if (!caderno?.id || !pagina?.id) return;
  marcar('caderno', { id: caderno.id, titulo: caderno.titulo, rota: `#cadernos/${caderno.id}`, pagina_id: pagina.id, pagina: numero, detalhe: `página ${numero}` });
}

// Até onde leu: a fração do texto que já passou pelo topo da tela.
function posicaoDaLeitura() {
  const texto = document.getElementById('leitor-texto');
  if (!texto) return 0;
  const caixa = texto.getBoundingClientRect();
  const lido = (innerHeight * 0.3 - caixa.top) / Math.max(1, caixa.height);
  return Math.round(Math.max(0, Math.min(1, lido)) * 100) / 100;
}

const textoDaPosicao = (p) => (p >= 0.97 ? 'no fim' : p >= 0.05 ? `${Math.round(p * 100)}% lido` : '');

function aoRolar() {
  const { rota, parametro } = obterEstado();
  if (rota !== 'biblioteca' || !parametro || parametro === 'novo') return;
  const a = aindaExiste(obterEstado(), 'leitura', parametro);
  if (!a) return;
  const posicao = posicaoDaLeitura();
  marcar('leitura', { id: parametro, titulo: a.titulo, rota: `#biblioteca/${parametro}`, posicao, detalhe: textoDaPosicao(posicao) });
}

// ---------------------------------------------------------------------------
// Abrir no outro aparelho
// ---------------------------------------------------------------------------

let pedido = null; // o que a Carol pediu para continuar (a página do caderno, a posição da leitura)

// O editor de caderno pergunta em que página abrir; vale uma vez.
export function paginaPedida(cadernoId) {
  if (pedido?.tipo !== 'caderno' || pedido.id !== cadernoId) return null;
  const p = { pagina_id: pedido.pagina_id, pagina: pedido.pagina };
  pedido = null;
  return p;
}

function restaurarLeitura(id) {
  if (pedido?.tipo !== 'leitura' || pedido.id !== id) return;
  const posicao = Number(pedido.posicao) || 0;
  pedido = null;
  if (posicao < 0.05) return;
  // Depois do "volta ao topo" da troca de tela.
  setTimeout(() => {
    const texto = document.getElementById('leitor-texto');
    if (!texto) return;
    const topo = texto.getBoundingClientRect().top + scrollY;
    scrollTo({ top: Math.max(0, topo + texto.offsetHeight * posicao - innerHeight * 0.3), behavior: 'auto' });
  }, 60);
}

export function cliqueContinuar(alvo) {
  const tipo = alvo.dataset.tipo;
  if (alvo.dataset.acao === 'continuar-abrir') {
    const item = itensParaContinuar(obterEstado()).find((i) => i.tipo === tipo);
    if (!item) return true;
    pedido = item;
    // Continuou aqui: o lugar passa a ser deste aparelho (o card some aqui e aparece no outro).
    const { aparelho, tipoAparelho, quando, tipo: _t, ...lugar } = item;
    marcar(tipo, lugar);
    gravar();
    if (tipo === 'roteiro') atualizarEstado({ ytAba: 'roteiro' });
    location.hash = item.rota;
    return true;
  }
  if (alvo.dataset.acao === 'continuar-dispensar') {
    const item = itensParaContinuar(obterEstado()).find((i) => i.tipo === tipo);
    const dispensados = lerDispensados();
    dispensados[tipo] = item?.quando || Date.now();
    try {
      localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(dispensados));
    } catch {
      // vale até recarregar
    }
    const linha = alvo.closest('.continuar-item');
    const card = alvo.closest('.continuar');
    if (card && card.querySelectorAll('.continuar-item').length <= 1) card.closest('.bloco')?.remove();
    else linha?.remove();
    return true;
  }
  return false;
}

export function ligarContinuar() {
  let espera = null;
  addEventListener('scroll', () => {
    clearTimeout(espera);
    espera = setTimeout(aoRolar, 600);
  }, { passive: true });
  // Saindo do app (ou trocando de aparelho): grava já, sem esperar.
  document.addEventListener('visibilitychange', () => { if (document.hidden) gravar(); });
  addEventListener('pagehide', () => gravar());
}
