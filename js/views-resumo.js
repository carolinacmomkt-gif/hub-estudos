// Tela Resumo da semana (#resumo ou #resumo/<segunda AAAA-MM-DD>) e o card do Início.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc, diaEHora } from './utilidades.js';
import { semanaDe, resumoDaSemana, textoMinutos } from './dados-resumo.js';
import { chamadaRetrospectiva } from './views-retrospectiva.js';
import { cardPadroes } from './views-padroes.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const NOME_TIPO = { prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade' };
const fuso = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

function semanaDoParametro(parametro, agora = Date.now()) {
  const atual = semanaDe(agora, fuso());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parametro || '')) return { semana: atual, deslocamento: 0 };
  const diff = Math.round((Date.parse(`${parametro}T12:00:00Z`) - Date.parse(`${atual.segunda}T12:00:00Z`)) / (7 * 864e5));
  return { semana: semanaDe(agora, fuso(), diff), deslocamento: diff };
}

export function dadosDoResumo(estado) {
  return {
    sessoes: estado.sessoesFoco, respostas: estado.respostas, artigos: estado.artigos, pautas: estado.pautas, videos: estado.videos,
    eventos: estado.eventos, disciplinas: estado.disciplinas, areas: estado.areas, cadernos: estado.cadernos,
  };
}

const nomeSemana = (s) => `${fmtDia.format(new Date(`${s.segunda}T12:00`)).replace('.', '')} a ${fmtDia.format(new Date(`${s.domingo}T12:00`)).replace('.', '')}`;

export function renderResumo(estado) {
  const { semana, deslocamento } = semanaDoParametro(estado.parametro);
  const r = resumoDaSemana(dadosDoResumo(estado), semana);
  const maior = Math.max(30, ...r.porDia);
  const ant = semanaDe(semana.inicio + 3 * 864e5, fuso(), -1).segunda;
  const prox = semanaDe(semana.inicio + 3 * 864e5, fuso(), 1).segunda;
  return `
    ${cabecalho('Resumo da semana', esc(nomeSemana(semana)))}
    <div class="acoes cal-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#resumo/${ant}">‹ Semana anterior</a>
      ${deslocamento < 0 ? `<a class="botao botao-secundario botao-pequeno" href="#resumo/${prox}">Próxima semana ›</a>` : ''}
      ${deslocamento !== 0 ? '<a class="botao botao-secundario botao-pequeno" href="#resumo">Esta semana</a>' : ''}
      <a class="botao botao-secundario botao-pequeno" href="#retrospectiva">Retrospectiva do mês</a>
      ${chamadaRetrospectiva(estado)}
    </div>
    ${r.vazia ? '<section class="card"><p class="texto-suave">Nada registrado nesta semana ainda. As sessões de foco, as questões respondidas e as leituras terminadas aparecem aqui.</p></section>' : ''}
    <div class="q-resumo">
      <section class="card">
        <p class="proximo-rotulo">Foco</p>
        <p class="revisao-total"><strong>${esc(textoMinutos(r.minutosFoco))}</strong><span class="texto-suave">em ${r.sessoes} ${r.sessoes === 1 ? 'sessão' : 'sessões'}</span></p>
        <div class="resumo-dias" role="img" aria-label="Minutos de foco por dia">${r.porDia.map((m, i) => `
          <span class="resumo-dia"><span class="resumo-coluna" style="height: ${Math.round((m / maior) * 100)}%"></span><small>${DIAS[i]}</small></span>`).join('')}</div>
      </section>
      <section class="card">
        <p class="proximo-rotulo">Questões</p>
        <p class="revisao-total"><strong>${r.questoes.respondidas}</strong><span class="texto-suave">respondidas${r.revisoesFeitas ? ` · ${r.revisoesFeitas} na revisão` : ''}</span></p>
        ${r.questoes.taxa !== null ? barraProgresso(r.questoes.taxa, 'Acerto na semana') : '<p class="campo-ajuda">Nenhuma questão respondida.</p>'}
      </section>
    </div>
    ${r.porAssunto.length ? `<section class="card"><h2 class="card-titulo">Onde foi o seu foco</h2>
      <ul class="lista-simples">${r.porAssunto.map((a) => `<li><span>${esc(a.nome)}</span><strong>${esc(textoMinutos(a.minutos))}</strong></li>`).join('')}</ul></section>` : ''}
    <section class="card">
      <h2 class="card-titulo">Também nesta semana</h2>
      <ul class="lista-simples">
        <li><span>Leituras terminadas</span><strong>${r.leituras.length}</strong></li>
        ${r.leituras.slice(0, 5).map((t) => `<li><span class="campo-ajuda">${esc(t)}</span></li>`).join('')}
        <li><span>Trabalhos e atividades entregues</span><strong>${r.entregues}</strong></li>
        <li><span>Cadernos em que você escreveu</span><strong>${r.cadernos}</strong></li>
        <li><span>Publicações</span><strong>${r.publicados.length}</strong></li>
        ${r.publicados.map((x) => `<li><span class="campo-ajuda">${esc(x.tipo)}: ${esc(x.titulo)}</span></li>`).join('')}
      </ul>
    </section>
    ${cardPadroes(estado, { limite: 6 })}
    <section class="card">
      <h2 class="card-titulo">Na semana seguinte</h2>
      ${r.proximos.length ? `<ul class="lista-simples">${r.proximos.map((e) => `
        <li><span>${esc(NOME_TIPO[e.tipo] || '')}: ${esc(e.titulo)}${e.disciplina ? ` <small class="campo-ajuda">· ${esc(e.disciplina)}</small>` : ''}</span>
          <span class="campo-ajuda">${esc(diaEHora(new Date(e.inicio)))}</span></li>`).join('')}</ul>`
        : '<p class="texto-suave">Nenhum prazo nem prova marcados.</p>'}
      <a class="botao botao-secundario botao-pequeno" href="#calendario">Ver o calendário</a>
    </section>`;
}

export function cardResumoInicio(estado) {
  const semana = semanaDe(Date.now(), fuso());
  const r = resumoDaSemana(dadosDoResumo(estado), semana);
  return `
    <section class="card" aria-labelledby="resumo-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="resumo-titulo">Sua semana</h2>
        <a class="card-link" href="#resumo">Resumo</a>
      </div>
      <ul class="lista-simples">
        <li><span>Foco</span><strong>${esc(textoMinutos(r.minutosFoco))}</strong></li>
        <li><span>Questões</span><strong>${r.questoes.respondidas}${r.questoes.taxa !== null ? ` · ${Math.round(r.questoes.taxa * 100)}%` : ''}</strong></li>
        <li><span>Leituras terminadas</span><strong>${r.leituras.length}</strong></li>
      </ul>
      ${chamadaRetrospectiva(estado)}
    </section>`;
}
