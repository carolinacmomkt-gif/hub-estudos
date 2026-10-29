// Tela "Pergunte à Bússola": busca em tudo do app enquanto digita (no aparelho, sem internet)
// e "Perguntar", que manda à IA só o que importa para a pergunta.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { esc } from './utilidades.js';
import { buscar, pareceUmaPergunta } from './dados-busca.js';
import { lerDesejo, avaliarCompra } from './dados-comprar.js';
import { situacaoGamificacao } from './dados-recompensas.js';
import { htmlVeredito, hojeIso } from './views-financas.js';

export const SUGESTOES_BUSCA = [
  'O que tenho amanhã?',
  'Quando é a próxima prova?',
  'Quanto gastei este mês?',
  'Quais demandas estão esperando?',
];

const CHAVE_RECENTES = 'bussola.busca.recentes';
export function perguntasRecentes() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]').slice(0, 5);
  } catch {
    return [];
  }
}
export function guardarPergunta(texto) {
  try {
    const lista = [texto, ...perguntasRecentes().filter((p) => p !== texto)].slice(0, 5);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    // sem armazenamento: só não lembra
  }
}

const ICONE_TIPO = {
  tarefa: 'tarefas', projeto: 'tarefas', evento: 'calendario', disciplina: 'faculdade', caderno: 'cadernos', pagina: 'cadernos',
  leitura: 'biblioteca', questao: 'questoes', pauta: 'substack', video: 'youtube', lancamento: 'financas', demanda: 'tarefas',
  meta: 'metas', lazer: 'metas', habito: 'habitos', ideia: 'editar',
};

function itemResultado(r) {
  return `
    <li>
      <a class="busca-item" href="${esc(r.destino)}">
        <span class="busca-icone" aria-hidden="true">${icone(ICONE_TIPO[r.tipo] || 'buscar')}</span>
        <span class="busca-texto">
          <strong>${esc(r.titulo)}</strong>
          <small>${esc(r.rotulo)}${r.detalhe ? ` · ${esc(r.detalhe)}` : ''}</small>
        </span>
      </a>
    </li>`;
}

// "posso comprar um tênis de 400?" → o veredito na hora, sem IA
function vereditoDaBusca(estado, t) {
  if (!/\b(posso|compr|cabe|gastar)/i.test(t)) return '';
  const desejo = lerDesejo(t.replace(/\?/g, ' ').replace(/\b(cabe|gastar|um|uma|o|a)\b/gi, ' '));
  if (!(desejo.valor > 0) || !(estado.financas || []).length) return '';
  const { saldo, itens } = situacaoGamificacao(estado);
  const r = avaliarCompra(estado.financas, hojeIso(), desejo, { saldo, itens });
  return r ? htmlVeredito(r, desejo, { compacto: true }) : '';
}

export function htmlResultados(estado, termo, paginas) {
  const t = String(termo || '').trim();
  if (!t) {
    const recentes = perguntasRecentes();
    return `
      <p class="campo-ajuda">Experimente:</p>
      <div class="busca-sugestoes">${[...recentes, ...SUGESTOES_BUSCA.filter((s) => !recentes.includes(s))].slice(0, 6).map((s) => `<button class="chip-filtro" type="button" data-acao="busca-sugestao" data-texto="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  }
  const compra = vereditoDaBusca(estado, t);
  const achados = buscar(estado, t, { paginas });
  if (!achados.length) {
    return `${compra}<p class="texto-suave">Nada com "${esc(t)}" no app.${pareceUmaPergunta(t) ? ' Toque em <strong>Perguntar</strong> para a IA olhar a agenda, as tarefas e as finanças.' : ''}</p>`;
  }
  return `${compra}
    <p class="campo-ajuda" aria-live="polite">${achados.length === 40 ? 'Os 40 mais parecidos' : `${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'}`}</p>
    <ul class="busca-lista">${achados.map(itemResultado).join('')}</ul>`;
}

export function htmlResposta(estado, porId) {
  const r = estado.buscaResposta;
  if (estado.buscaPensando) return '<div class="card busca-resposta" role="status"><p class="dia-pensando"><span class="dia-pensando-ponto" aria-hidden="true"></span>Olhando tudo o que está no app…</p></div>';
  if (!r) return '';
  if (r.erro) return `<div class="card busca-resposta"><p class="ava-alerta" role="alert">${esc(r.erro)}</p></div>`;
  const itens = (r.itens || []).map((id) => porId.get(id)).filter(Boolean);
  return `
    <section class="card busca-resposta" aria-labelledby="busca-resposta-titulo">
      <h2 class="visualmente-oculto" id="busca-resposta-titulo">Resposta</h2>
      <p class="busca-pergunta">${esc(r.pergunta)}</p>
      <div class="busca-resposta-texto">${esc(r.resposta).replace(/\n/g, '<br>')}</div>
      ${itens.length ? `<ul class="busca-lista">${itens.map(itemResultado).join('')}</ul>` : ''}
      <p class="campo-ajuda">Resposta da IA com os dados do app. Confira o que for importante.</p>
    </section>`;
}

export function renderBusca(estado, { paginas = [], porId = new Map() } = {}) {
  const termo = estado.buscaTermo || '';
  return `
    ${cabecalho('Pergunte à Bússola', 'Ache qualquer coisa do app ou faça uma pergunta')}
    <div class="pilha busca">
      <form class="busca-form" data-form="busca" role="search" novalidate>
        <label class="visualmente-oculto" for="busca-termo">Buscar ou perguntar</label>
        <input id="busca-termo" name="termo" type="search" value="${esc(termo)}" autocomplete="off" enterkeyhint="search" maxlength="300"
          placeholder='Ex.: "prova de estatística" ou "quanto gastei com delivery?"'>
        <button class="botao botao-primario" type="submit"${estado.buscaPensando ? ' disabled' : ''}>✨ Perguntar</button>
      </form>
      <div id="busca-resposta">${htmlResposta(estado, porId)}</div>
      <section class="card" aria-label="Resultados da busca">
        <div id="busca-resultados">${htmlResultados(estado, termo, paginas)}</div>
      </section>
    </div>`;
}
