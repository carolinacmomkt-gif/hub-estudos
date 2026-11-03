// Gestão de projetos: Painel de projetos (#portfolio), Revisão semanal (#revisao), Entrada (#entrada)
// e o quadro de um projeto (a fazer → fazendo → feito), usado dentro de Tarefas e projetos.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import { AREAS_TAREFA, iso } from './dados-tarefas.js';
import {
  FAROL, portfolio, quadroDoProjeto, PASSOS_REVISAO, revisaoDaSemana, numerosDaRevisao,
} from './dados-portfolio.js';
import { datasVisiveis, prefsDatas } from './datas-especiais.js';
import { clientesAtivos } from './dados-trabalho.js';
import { cardCaixaEntrada } from './views-criar.js';
import { cardDemandas } from './views-demandas.js';
import { textoDia } from './views-tarefas.js';
import { temPainel } from './dados-projetos.js';

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const curto = (d) => fmtCurto.format(new Date(`${d}T12:00:00`)).replace('.', '');

const farol = (id) => `<span class="farol farol-${id}"><i aria-hidden="true"></i>${esc(FAROL[id].nome)}</span>`;

// ---------------------------------------------------------------------------
// Painel de projetos
// ---------------------------------------------------------------------------

export function renderPortfolio(estado) {
  const hoje = iso(new Date());
  const pf = portfolio(estado, hoje);
  const c = pf.contagem;
  const sub = pf.ativos.length
    ? [`${pf.ativos.length} ${pf.ativos.length === 1 ? 'projeto ativo' : 'projetos ativos'}`, c.atrasado && `${c.atrasado} atrasado${c.atrasado > 1 ? 's' : ''}`, c.risco && `${c.risco} em risco`].filter(Boolean).join(' · ')
    : 'Nenhum projeto ativo ainda';
  return `
    ${cabecalho('Painel de projetos', esc(sub))}
    <div class="acoes cal-acoes">
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="projeto-novo">+ Novo projeto</button>
      <a class="botao botao-secundario botao-pequeno" href="#revisao">Revisão da semana</a>
      <a class="botao botao-secundario botao-pequeno" href="#tarefas/projetos">Lista de projetos</a>
    </div>
    <div class="pf-topo">
      <section class="card pf-resumo" aria-label="Farol dos projetos">
        <p class="tb-rot">Farol</p>
        <ul class="pf-contagem">${['atrasado', 'risco', 'prazo', 'pausado'].map((k) => `<li class="farol-${k}"><b>${c[k]}</b><span>${esc(FAROL[k].nome)}</span></li>`).join('')}</ul>
      </section>
    </div>
    ${pf.areas.length ? pf.areas.map((a) => `
      <section class="pf-area" aria-label="${esc(a.nome)}">
        <h2 class="pf-area-titulo">${esc(a.nome)} <small>${a.itens.length}</small></h2>
        <ul class="pf-projetos">${a.itens.map((x) => cartaoProjeto(x, hoje)).join('')}</ul>
      </section>`).join('')
    : `<section class="card"><p class="texto-suave">Um projeto junta as tarefas de uma entrega maior, como "Lançar o produto da consultoria" ou "Pauta de dezembro da Dra. Fulana". Crie o primeiro e ele aparece aqui com o farol.</p></section>`}`;
}

function cartaoProjeto(x, hoje) {
  const p = x.projeto;
  const destino = temPainel(p) ? `#projetos/${esc(p.id)}` : `#tarefas/projeto-${esc(p.id)}`;
  return `<li><a class="card pf-cartao cor-${esc(p.cor || 1)}" href="${destino}">
    <span class="pf-cartao-topo"><b>${esc(p.titulo)}</b>${farol(x.farol)}</span>
    ${barraProgresso(x.progresso.fracao, `Progresso de ${p.titulo}`)}
    <span class="pf-linha">${x.progresso.total ? `${x.progresso.prontas} de ${x.progresso.total} tarefas` : 'Sem tarefas'}${p.prazo ? ` · prazo ${esc(textoDia(p.prazo, hoje))}` : ''}</span>
    <span class="pf-linha pf-motivo">${esc(x.motivo)}</span>
    ${x.proxima ? `<span class="pf-linha"><span class="texto-suave">Próximo passo:</span> ${esc(x.proxima.titulo)}${x.proxima.data || x.proxima.prazo ? ` · ${esc(textoDia(x.proxima.prazo || x.proxima.data, hoje))}` : ''}</span>` : ''}
    ${x.metas.length ? `<span class="pf-linha pf-meta">Move a meta: ${esc(x.metas.map((m) => m.titulo).join(', '))}</span>` : ''}
  </a></li>`;
}

// ---------------------------------------------------------------------------
// Quadro de um projeto (dentro de Tarefas e projetos)
// ---------------------------------------------------------------------------

export function quadroHtml(projetoId, tarefas, hoje = iso(new Date())) {
  const colunas = quadroDoProjeto(projetoId, tarefas, hoje);
  const mover = (t, coluna) => {
    const b = [];
    if (coluna !== 'afazer') b.push(`<button class="botao botao-secundario botao-pequeno" type="button" data-acao="tarefa-coluna" data-id="${esc(t.id)}" data-valor="afazer" aria-label="Voltar para A fazer: ${esc(t.titulo)}">← A fazer</button>`);
    if (coluna !== 'fazendo') b.push(`<button class="botao botao-secundario botao-pequeno" type="button" data-acao="tarefa-coluna" data-id="${esc(t.id)}" data-valor="fazendo" aria-label="Mover para Fazendo: ${esc(t.titulo)}">${coluna === 'feito' ? '← Fazendo' : 'Fazendo →'}</button>`);
    if (coluna !== 'feito') b.push(`<button class="botao botao-secundario botao-pequeno" type="button" data-acao="tarefa-coluna" data-id="${esc(t.id)}" data-valor="feito" aria-label="Marcar como feita: ${esc(t.titulo)}">Feito ✓</button>`);
    return b.join('');
  };
  return `<div class="pf-quadro">${colunas.map((c) => `
    <section class="card pf-coluna pf-col-${c.id}" aria-label="${esc(c.nome)}">
      <p class="tb-rot">${esc(c.nome)} · ${c.tarefas.length}</p>
      ${c.tarefas.length ? `<ul class="pf-col-lista">${c.tarefas.map((t) => `<li class="pf-tarefa">
        <button class="pf-tarefa-titulo" type="button" data-acao="tarefa-abrir" data-id="${esc(t.id)}">${esc(t.titulo)}</button>
        ${t.prazo || t.data ? `<small class="${!t.feita_em && (t.prazo || t.data) < hoje ? 'tarefa-atrasada' : ''}">${esc(textoDia(t.prazo || t.data, hoje))}</small>` : ''}
        <span class="pf-tarefa-acoes">${mover(t, c.id)}</span>
      </li>`).join('')}</ul>` : '<p class="texto-suave">Nada aqui.</p>'}
    </section>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Revisão semanal
// ---------------------------------------------------------------------------

function datasDas30(estado, hoje) {
  const fim = new Date(`${hoje}T12:00:00`); fim.setDate(fim.getDate() + 30);
  const clientes = clientesAtivos(estado).filter((c) => c.casa !== 'minha');
  return datasVisiveis(hoje, iso(fim), { ...prefsDatas(estado.config), feriados: false, soDasClientes: true }, clientes);
}

export function renderRevisao(estado) {
  const hoje = iso(new Date());
  const r = revisaoDaSemana(estado.config, hoje);
  const datas = datasDas30(estado, hoje);
  const capturas = (estado.caixa || []).filter((i) => !i.processado_em && !i.excluido_em).length;
  const novas = (estado.demandas || []).filter((d) => !d.excluido_em && d.status === 'nova').length;
  const n = numerosDaRevisao(estado, { demandasNovas: novas, capturas, datas30: datas.length }, hoje);
  const feitos = PASSOS_REVISAO.filter((p) => r.passos?.[p.id]).length;
  const abertas = vivos(estado.tarefas).filter((t) => !t.feita_em && !t.recorrencia?.tipo)
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0) || (a.prazo || a.data || '9999').localeCompare(b.prazo || b.data || '9999'));
  const prioridades = (r.prioridades || []).map((id) => abertas.find((t) => t.id === id) || vivos(estado.tarefas).find((t) => t.id === id)).filter(Boolean);
  const contaDe = { entrada: n.entrada, atrasadas: n.atrasadas, projetos: n.projetos, datas: n.datas };
  return `
    ${cabecalho('Revisão da semana', `Semana de ${esc(curto(r.semana))} · ${feitos} de ${PASSOS_REVISAO.length} passos${r.feita_em ? ' · feita' : ''}`)}
    <div class="rv">
      <section class="card rv-passos" aria-label="Passos da revisão">
        <p class="texto-suave">Uns 15 minutos, de preferência na sexta à tarde ou no domingo. Cada passo leva à tela certa; marque quando terminar.</p>
        ${barraProgresso(feitos / PASSOS_REVISAO.length, 'Revisão da semana')}
        <ol class="rv-lista">${PASSOS_REVISAO.map((p, i) => `
          <li class="rv-passo${r.passos?.[p.id] ? ' feito' : ''}">
            <label class="rv-check"><input type="checkbox" data-acao-mudar="revisao-passo" value="${p.id}"${r.passos?.[p.id] ? ' checked' : ''}><span class="visualmente-oculto">Marcar ${esc(p.nome)}</span></label>
            <span class="rv-texto"><b>${i + 1}. ${esc(p.nome)}</b>${contaDe[p.id] !== undefined ? ` <span class="selo${contaDe[p.id] ? ' rv-selo-alerta' : ''}">${contaDe[p.id]}</span>` : ''}<small>${esc(p.ajuda)}</small></span>
            ${p.rota !== '#revisao' ? `<a class="botao botao-secundario botao-pequeno" href="${p.rota}">Abrir</a>` : ''}
          </li>`).join('')}
        </ol>
        <div class="acoes"><button class="botao botao-primario" type="button" data-acao="revisao-concluir"${feitos < PASSOS_REVISAO.length ? '' : ''}>${r.feita_em ? 'Revisão feita ✓' : 'Concluir a revisão'}</button></div>
      </section>
      <div class="rv-lado">
          <section class="card rv-prioridades" aria-label="3 prioridades da semana">
          <p class="tb-rot">3 prioridades da semana</p>
          ${prioridades.length ? `<ol class="rv-prio-lista">${prioridades.map((t) => `<li><span${t.feita_em ? ' class="feita"' : ''}>${esc(t.titulo)}</span><button class="botao-icone" type="button" data-acao="revisao-prioridade" data-id="${esc(t.id)}" aria-label="Tirar das prioridades: ${esc(t.titulo)}" title="Tirar">×</button></li>`).join('')}</ol>` : '<p class="texto-suave">Escolha até 3 tarefas abaixo.</p>'}
          ${prioridades.length < 3 ? `<details class="rv-escolher" open><summary>Escolher entre as tarefas abertas</summary>
            <ul class="rv-opcoes">${abertas.filter((t) => !(r.prioridades || []).includes(t.id)).slice(0, 25).map((t) => `<li><button class="botao botao-secundario botao-pequeno" type="button" data-acao="revisao-prioridade" data-id="${esc(t.id)}">+ ${esc(t.titulo)}</button></li>`).join('') || '<li class="texto-suave">Sem tarefas abertas.</li>'}</ul>
          </details>` : ''}
          <p class="campo-ajuda">As prioridades aparecem no Hoje durante a semana.</p>
        </section>
        ${datas.length ? `<section class="card" aria-label="Datas das clientes"><p class="tb-rot">Datas das clientes · 30 dias</p><ul class="lista-simples datas-lista">${datas.slice(0, 8).map((d) => `<li><b>${esc(curto(d.data))}</b> ${esc(d.titulo)}</li>`).join('')}</ul></section>` : ''}
      </div>
    </div>`;
}

// Card do Hoje: as prioridades da semana (só aparece quando há alguma).
export function cardPrioridadesHoje(estado) {
  const r = revisaoDaSemana(estado.config);
  const lista = (r.prioridades || []).map((id) => vivos(estado.tarefas).find((t) => t.id === id)).filter(Boolean);
  if (!lista.length) return `<section class="card"><p class="tb-rot">Prioridades da semana</p><p class="texto-suave">Ainda não escolhidas.</p><a class="botao botao-secundario botao-pequeno" href="#revisao">Fazer a revisão da semana</a></section>`;
  return `<section class="card rv-hoje"><p class="tb-rot">Prioridades da semana</p><ol class="rv-prio-lista">${lista.map((t) => `<li><span${t.feita_em ? ' class="feita"' : ''}>${t.feita_em ? '✓ ' : ''}${esc(t.titulo)}</span></li>`).join('')}</ol><a class="botao botao-secundario botao-pequeno" href="#revisao">Revisão da semana</a></section>`;
}

// ---------------------------------------------------------------------------
// Entrada única: capturas e demandas novas, num lugar só
// ---------------------------------------------------------------------------

export function renderEntrada(estado) {
  const capturas = (estado.caixa || []).filter((i) => !i.processado_em && !i.excluido_em).length;
  const novas = (estado.demandas || []).filter((d) => !d.excluido_em && d.status === 'nova').length;
  return `
    ${cabecalho('Entrada', `${capturas + novas ? `${capturas + novas} para decidir` : 'Tudo decidido'} · cada item vira tarefa, projeto, ideia ou sai`)}
    <div class="acoes cal-acoes"><a class="botao botao-secundario botao-pequeno" href="#revisao">Revisão da semana</a></div>
    <div class="pf-entrada">
      ${estado.usandoExemplo ? '' : `<div class="pf-entrada-demandas">${cardDemandas(estado)}</div>`}
      <div class="pf-entrada-caixa">${cardCaixaEntrada(estado.caixa || [])}</div>
    </div>`;
}

export { AREAS_TAREFA };
