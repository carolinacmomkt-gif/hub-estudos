// Tela Retrospectiva do mês (#retrospectiva ou #retrospectiva/AAAA-MM) e a chamada no Hoje/Resumo.

import { cabecalho } from './componentes.js';
import { esc } from './utilidades.js';
import { PERGUNTAS, retrospectivaDoMes, retrospectivasDe, retrospectivaDevida, numerosDoMes, nomeDoMes } from './dados-retrospectiva.js';
import { mesDe, somarMeses } from './dados-financas.js';
import { textoMin } from './dados-leitura.js';
import { dataLocal } from './views-dia.js';
import { HUMORES } from './hoje.js';

const dinheiro = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric' });

function mesDoParametro(parametro, hoje) {
  if (/^\d{4}-\d{2}$/.test(parametro || '')) return parametro;
  const devida = retrospectivaDevida([], hoje); // sem config: só decide fim/início
  return devida?.quando === 'inicio' ? somarMeses(mesDe(hoje), -1) : mesDe(hoje);
}

function numero(rotulo, valor, detalhe = '') {
  return `<li class="retro-numero"><span class="proximo-rotulo">${esc(rotulo)}</span><strong>${valor}</strong>${detalhe ? `<small class="campo-ajuda">${detalhe}</small>` : ''}</li>`;
}

export function htmlNumeros(n) {
  const humor = n.humor ? HUMORES.find((h) => h.valor === Math.round(n.humor)) : null;
  return `
    <ul class="retro-numeros">
      ${numero('Foco', esc(textoMin(n.minutosFoco)), `${n.sessoes} ${n.sessoes === 1 ? 'sessão' : 'sessões'}${n.melhorDia ? ` · melhor dia: ${esc(fmtDia.format(new Date(`${n.melhorDia.dia}T12:00:00`)))}` : ''}`)}
      ${numero('Leitura', esc(textoMin(n.minutosLeitura)), n.livros.length ? `${n.livros.length} ${n.livros.length === 1 ? 'livro terminado' : 'livros terminados'}: ${esc(n.livros.slice(0, 3).join(', '))}` : 'nenhum livro terminado')}
      ${numero('Hábitos', n.taxaHabitos === null ? '—' : `${Math.round(n.taxaHabitos * 100)}%`, n.taxaHabitos === null ? 'nenhum hábito ativo' : 'dos dias, na média')}
      ${numero('Tarefas feitas', String(n.tarefasFeitas))}
      ${numero('Dinheiro', `${n.sobrou < 0 ? '−' : ''}${esc(dinheiro(Math.abs(n.sobrou)))}`, `entrou ${esc(dinheiro(n.entrou))} · saiu ${esc(dinheiro(n.saiu))}`)}
      ${numero('Humor', humor ? `${humor.rosto} ${esc(humor.nome)}` : '—', n.diasLeves ? `${n.diasLeves} ${n.diasLeves === 1 ? 'dia leve' : 'dias leves'}` : 'nenhum dia leve')}
      ${n.publicados ? numero('Publicações', String(n.publicados), 'Substack e YouTube') : ''}
    </ul>`;
}

export function renderRetrospectiva(estado) {
  const hoje = dataLocal();
  const mes = mesDoParametro(estado.parametro, hoje);
  const feita = retrospectivaDoMes(estado.config, mes);
  const n = feita?.numeros || numerosDoMes(estado, mes, hoje);
  const anteriores = retrospectivasDe(estado.config).filter((r) => r.mes !== mes).sort((a, b) => b.mes.localeCompare(a.mes));
  const ant = somarMeses(mes, -1);
  const prox = somarMeses(mes, 1);
  return `
    ${cabecalho('Retrospectiva do mês', esc(nomeDoMes(mes)))}
    <div class="acoes cal-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#retrospectiva/${ant}">‹ ${esc(nomeDoMes(ant).split(' ')[0])}</a>
      ${prox <= mesDe(hoje) ? `<a class="botao botao-secundario botao-pequeno" href="#retrospectiva/${prox}">${esc(nomeDoMes(prox).split(' ')[0])} ›</a>` : ''}
      <a class="botao botao-secundario botao-pequeno" href="#resumo">Resumo da semana</a>
    </div>
    <section class="card">
      <h2 class="card-titulo">Os números de ${esc(nomeDoMes(mes).split(' ')[0].toLowerCase())}</h2>
      ${htmlNumeros(n)}
    </section>
    ${feita ? `
    <section class="card retro-feita">
      <h2 class="card-titulo">O que você escreveu</h2>
      ${PERGUNTAS.map((p) => `<h3 class="ava-subtitulo">${esc(p.rotulo)}</h3><p>${esc(feita.respostas?.[p.id] || '—')}</p>`).join('')}
      ${feita.intencoes?.length ? `<h3 class="ava-subtitulo">Intenções para ${esc(nomeDoMes(prox).split(' ')[0].toLowerCase())}</h3><ul class="lista-simples">${feita.intencoes.map((i) => `<li>✦ ${esc(i)}</li>`).join('')}</ul><p class="campo-ajuda">Viraram metas: acompanhe em <a href="#metas/lista">Metas</a>.</p>` : ''}
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="retro-refazer" data-mes="${esc(mes)}">Refazer</button></div>
    </section>` : `
    <form class="card formulario retro-form" data-form="retrospectiva" data-mes="${esc(mes)}" novalidate>
      <h2 class="card-titulo">Dez minutos, três perguntas</h2>
      <p class="texto-suave">Responda do jeito que vier. Nada aqui é nota: é conversa com você mesma.</p>
      ${PERGUNTAS.map((p) => `
      <label class="campo"><span class="campo-rotulo">${esc(p.rotulo)}</span>
        <textarea name="${esc(p.id)}" rows="3" maxlength="600" placeholder="${esc(p.dica)}"></textarea></label>`).join('')}
      <fieldset class="campo"><legend class="campo-rotulo">Três intenções para ${esc(nomeDoMes(prox).split(' ')[0].toLowerCase())}</legend>
        <p class="campo-ajuda">Cada uma vira uma meta pequena, com prazo no fim do mês que vem. Pode deixar em branco.</p>
        ${[1, 2, 3].map((i) => `<input class="retro-intencao" name="intencao${i}" type="text" maxlength="80" placeholder="Intenção ${i}" aria-label="Intenção ${i}">`).join('')}
      </fieldset>
      <div class="acoes"><button class="botao botao-primario" type="submit">Fechar ${esc(nomeDoMes(mes).split(' ')[0].toLowerCase())}</button></div>
    </form>`}
    ${anteriores.length ? `<section class="card"><h2 class="card-titulo">Meses anteriores</h2><ul class="lista-simples">${anteriores.map((r) => `<li><a href="#retrospectiva/${esc(r.mes)}">${esc(nomeDoMes(r.mes))}</a><span class="campo-ajuda">${r.intencoes?.length || 0} ${r.intencoes?.length === 1 ? 'intenção' : 'intenções'}</span></li>`).join('')}</ul></section>` : ''}`;
}

// Chamada no Hoje (card "Sua semana") e no Resumo: só quando está na hora.
export function chamadaRetrospectiva(estado, hoje = dataLocal()) {
  const devida = retrospectivaDevida(estado.config, hoje);
  if (!devida) return '';
  return `<a class="botao botao-primario botao-pequeno retro-chamada" href="#retrospectiva/${esc(devida.mes)}">Fechar ${esc(nomeDoMes(devida.mes).split(' ')[0].toLowerCase())} · 10 min</a>`;
}
