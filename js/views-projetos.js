// Aba Projetos (decisão da Carol, 03/11/2026): a lista (#projetos), o "Novo projeto" em 3 passos
// (#projetos/novo, ou #projetos/novo:<id> para dar um painel a um projeto que já existe) e o painel
// de cada projeto (#projetos/<id>), montado pelo tipo e pelo método.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import { AREAS_TAREFA, iso } from './dados-tarefas.js';
import { TIPOS, CAMPOS, SECOES, ETAPAS, tipoDe, metodoDe, respostasPadrao } from './modelos-projeto.js';
import { montarPlano, painelDoProjeto, listaDeProjetos, formatarValor, serieDoNumero, temPainel } from './dados-projetos.js';
import { statusDoProjeto, FAROL } from './dados-portfolio.js';
import { textoDia } from './views-tarefas.js';

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const curto = (d) => (d ? fmtCurto.format(new Date(`${d}T12:00:00`)).replace('.', '') : '');
const farol = (id) => `<span class="farol farol-${id}"><i aria-hidden="true"></i>${esc(FAROL[id].nome)}</span>`;
const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual) ? ' selected' : ''}>${esc(nome)}</option>`;

export function renderProjetos(estado) {
  const parametro = estado.parametro || '';
  if (parametro.startsWith('novo')) return telaNovo(estado, parametro.split(':')[1] || '');
  if (parametro) return telaPainel(estado, parametro);
  return telaLista(estado);
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

function telaLista(estado) {
  const hoje = iso(new Date());
  const { comPainel, outros } = listaDeProjetos(estado);
  const ativos = comPainel.filter((p) => p.status !== 'concluido').length;
  const sub = ativos ? `${ativos} ${ativos === 1 ? 'projeto com painel' : 'projetos com painel'}` : 'Mentoria, infoproduto, evento, livro… cada um com o painel certo';
  return `
    ${cabecalho('Projetos', esc(sub))}
    <div class="acoes cal-acoes">
      <a class="botao botao-primario botao-pequeno" href="#projetos/novo">+ Novo projeto</a>
      <a class="botao botao-secundario botao-pequeno" href="#portfolio">Painel de projetos</a>
    </div>
    ${comPainel.length ? `<ul class="pj-lista">${comPainel.map((p) => cartaoLista(p, estado, hoje)).join('')}</ul>` : `
      <section class="card pj-vazio">
        <h2 class="card-titulo">Que projeto você quer tirar do papel?</h2>
        <p class="texto-suave">Escolha o tipo e o método: o app monta as fases, as tarefas com data, os números a acompanhar e as seções do painel.</p>
        <ul class="pj-tipos">${TIPOS.map((t) => `<li><a class="pj-tipo" href="#projetos/novo" data-acao="pj-tipo" data-valor="${esc(t.id)}"><span class="pj-emoji" aria-hidden="true">${t.emoji}</span><b>${esc(t.nome)}</b><small>${esc(t.descricao)}</small></a></li>`).join('')}</ul>
      </section>`}
    ${outros.length ? `
      <section class="card pj-outros" aria-labelledby="pj-outros-t">
        <h2 class="card-titulo" id="pj-outros-t">Outros projetos</h2>
        <p class="texto-suave">Projetos sem modelo. Dê um painel para ganhar fases, números e seções.</p>
        <ul class="pj-outros-lista">${outros.map((p) => `<li><a href="#tarefas/projeto-${esc(p.id)}">${esc(p.titulo)}</a><a class="botao botao-secundario botao-pequeno" href="#projetos/novo:${esc(p.id)}">Dar um painel</a></li>`).join('')}</ul>
      </section>` : ''}`;
}

function cartaoLista(p, estado, hoje) {
  const pn = painelDoProjeto(p, estado.tarefas, hoje);
  const st = statusDoProjeto(p, estado.tarefas, hoje);
  const principal = pn.kpis.find((k) => k.principal);
  const progresso = st.progresso;
  return `<li><a class="card pj-cartao" href="#projetos/${esc(p.id)}">
    <span class="pj-cartao-topo"><span class="pj-emoji" aria-hidden="true">${pn.tipo.emoji}</span><span class="pj-cartao-nome"><b>${esc(p.titulo)}</b><small>${esc(pn.tipo.nome)} · ${esc(pn.metodo?.nome || '')}</small></span>${farol(st.farol)}</span>
    <span class="pj-contagem">${esc(pn.contagem)}</span>
    ${pn.atual ? `<span class="pj-linha">Fase: <b>${esc(pn.atual.nome)}</b></span>` : ''}
    ${barraProgresso(progresso.fracao, `Progresso de ${p.titulo}`)}
    ${principal ? `<span class="pj-linha">${esc(principal.nome)}: <b>${esc(formatarValor(principal.valor, principal.unidade))}</b>${principal.meta ? ` de ${esc(formatarValor(principal.meta, principal.unidade))}` : ''}</span>` : ''}
    ${st.farol === 'risco' || st.farol === 'atrasado' ? `<span class="pj-linha pj-motivo">${esc(st.motivo)}</span>` : ''}
  </a></li>`;
}

// ---------------------------------------------------------------------------
// Novo projeto
// ---------------------------------------------------------------------------

export function rascunhoNovo(estado, baseId = '') {
  const r = estado.projetoNovo || {};
  if ((r.base || '') === baseId && r.iniciado) return r;
  const base = baseId ? vivos(estado.projetos).find((p) => p.id === baseId) : null;
  return { iniciado: true, base: baseId, tipo: r.tipo || '', metodo: '', titulo: base?.titulo || '', area: base?.area || '', chave: base?.prazo || '', respostas: {}, desmarcadas: [] };
}

function telaNovo(estado, baseId) {
  const r = rascunhoNovo(estado, baseId);
  const t = tipoDe(r.tipo);
  const m = t ? metodoDe(r.tipo, r.metodo) : null;
  const base = baseId ? vivos(estado.projetos).find((p) => p.id === baseId) : null;
  return `
    ${cabecalho(base ? `Painel para ${base.titulo}` : 'Novo projeto', 'Escolha o tipo e o método, responda poucas perguntas e confira a prévia.')}
    <a class="botao botao-secundario botao-pequeno pj-voltar" href="#projetos">← Projetos</a>
    <section class="card pj-passo" aria-labelledby="pj-p1">
      <h2 class="pj-passo-titulo" id="pj-p1"><span>1</span> Que tipo de projeto?</h2>
      <div class="pj-tipos pj-escolha" role="group" aria-label="Tipo de projeto">${TIPOS.map((x) => `
        <button class="pj-tipo" type="button" data-acao="pj-tipo" data-valor="${esc(x.id)}" aria-pressed="${x.id === r.tipo}">
          <span class="pj-emoji" aria-hidden="true">${x.emoji}</span><b>${esc(x.nome)}</b><small>${esc(x.descricao)}</small></button>`).join('')}</div>
    </section>
    ${t ? `
    <section class="card pj-passo" aria-labelledby="pj-p2">
      <h2 class="pj-passo-titulo" id="pj-p2"><span>2</span> Qual método?</h2>
      <div class="pj-metodos" role="group" aria-label="Método">${t.metodos.map((x) => `
        <button class="pj-metodo" type="button" data-acao="pj-metodo" data-valor="${esc(x.id)}" aria-pressed="${x.id === r.metodo}">
          <b>${esc(x.nome)}</b><small>${esc(x.descricao)}</small></button>`).join('')}</div>
    </section>` : ''}
    ${m ? formNovo(r, t, m) : ''}`;
}

function campoHtml(id, valor) {
  const c = CAMPOS[id];
  const v = valor ?? c.padrao;
  if (c.tipo === 'opcoes') return `<label class="campo"><span class="campo-rotulo">${esc(c.rotulo)}</span><select name="${id}" data-acao-mudar="pj-campo">${c.opcoes.map(([o, n]) => opcao(o, v, n)).join('')}</select></label>`;
  if (c.tipo === 'texto') return `<label class="campo pj-campo-largo"><span class="campo-rotulo">${esc(c.rotulo)}</span><input name="${id}" type="text" maxlength="300" value="${esc(v)}" data-acao-mudar="pj-campo"></label>`;
  return `<label class="campo"><span class="campo-rotulo">${esc(c.rotulo)}</span><input name="${id}" type="number" inputmode="numeric" min="0" step="1" value="${esc(v)}" data-acao-mudar="pj-campo"></label>`;
}

function formNovo(r, t, m) {
  const respostas = { ...respostasPadrao(t.id), ...r.respostas };
  return `
    <form class="card pj-passo formulario" data-form="pj-novo" novalidate aria-labelledby="pj-p3">
      <h2 class="pj-passo-titulo" id="pj-p3"><span>3</span> Os detalhes</h2>
      <div class="pj-campos">
        <label class="campo pj-campo-largo"><span class="campo-rotulo">Nome do projeto</span>
          <input name="titulo" type="text" maxlength="120" required value="${esc(r.titulo)}" placeholder="${esc(`Ex.: ${t.nome} de ${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())}`)}" data-acao-mudar="pj-campo"></label>
        <label class="campo"><span class="campo-rotulo">${esc(m.chave)}</span>
          <input name="chave" type="date" required value="${esc(r.chave)}" data-acao-mudar="pj-campo"></label>
        <label class="campo"><span class="campo-rotulo">Área</span>
          <select name="area" data-acao-mudar="pj-campo">${AREAS_TAREFA.map((a) => opcao(a.id, r.area || t.area, a.nome)).join('')}</select></label>
        ${t.campos.map((c) => campoHtml(c, respostas[c])).join('')}
      </div>
      <div data-pj-previa>${previaHtml(r)}</div>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
    </form>`;
}

// A prévia é redesenhada sozinha a cada mudança nos campos (sem tirar o foco de onde ela digita).
export function previaHtml(r, hoje = iso(new Date())) {
  const t = tipoDe(r.tipo);
  if (!t || !r.metodo) return '';
  if (!r.chave) return '<p class="texto-suave pj-previa-vazia">Escolha a data para ver as fases e as tarefas com as datas.</p>';
  const plano = montarPlano({ tipo: r.tipo, metodo: r.metodo, respostas: { ...respostasPadrao(r.tipo), ...r.respostas }, chave: r.chave, hoje });
  if (!plano) return '';
  const fora = new Set(r.desmarcadas || []);
  const ficam = plano.fases.reduce((n, fz) => n + fz.tarefas.filter((x) => !fora.has(x.chave)).length, 0);
  return `
    <h3 class="pj-previa-titulo">Prévia: ${plano.fases.length} fases e ${ficam} tarefas, de ${esc(curto(plano.inicio))} a ${esc(curto(plano.fim))}</h3>
    ${plano.noPassado ? `<p class="pj-aviso">${plano.noPassado} ${plano.noPassado === 1 ? 'tarefa cairia' : 'tarefas cairiam'} antes de hoje: ${plano.noPassado === 1 ? 'ela fica' : 'elas ficam'} para hoje. Se for muito, escolha uma data mais para frente.</p>` : ''}
    <ol class="pj-previa">${plano.fases.map((fz) => `
      <li class="pj-previa-fase">
        <p class="pj-previa-fase-nome"><b>${esc(fz.nome)}</b> <small>${esc(curto(fz.inicio))}${fz.fim !== fz.inicio ? ` – ${esc(curto(fz.fim))}` : ''}</small></p>
        <ul>${fz.tarefas.map((x) => `
          <li><label class="pj-previa-tarefa"><input type="checkbox" name="tarefa" value="${esc(x.chave)}" data-acao-mudar="pj-desmarcar"${fora.has(x.chave) ? '' : ' checked'}>
            <span>${esc(x.titulo)}${x.marco ? ` <span class="selo pj-selo-marco">No Calendário</span>` : ''}</span><small>${esc(curto(x.data))}</small></label></li>`).join('')}</ul>
      </li>`).join('')}</ol>
    <div class="acoes pj-criar">
      <button class="botao botao-primario" type="submit">${r.base ? 'Dar o painel' : 'Criar projeto'} e ${ficam} ${ficam === 1 ? 'tarefa' : 'tarefas'}</button>
      <span class="texto-suave">${plano.marcos.length ? `${plano.marcos.length} ${plano.marcos.length === 1 ? 'data vai' : 'datas vão'} para o Calendário.` : ''}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Painel do projeto
// ---------------------------------------------------------------------------

function telaPainel(estado, id) {
  const hoje = iso(new Date());
  const p = vivos(estado.projetos).find((x) => x.id === id);
  if (!p) return `${cabecalho('Projeto')}<section class="card"><p>Esse projeto não existe mais.</p><a class="botao botao-secundario" href="#projetos">Ver os projetos</a></section>`;
  if (!temPainel(p)) {
    return `${cabecalho(p.titulo, 'Projeto sem painel')}
      <section class="card"><p class="texto-suave">Dê um painel a este projeto para ganhar fases, números e seções.</p>
      <div class="acoes"><a class="botao botao-primario" href="#projetos/novo:${esc(p.id)}">Dar um painel</a><a class="botao botao-secundario" href="#tarefas/projeto-${esc(p.id)}">Ver as tarefas</a></div></section>`;
  }
  const pn = painelDoProjeto(p, estado.tarefas, hoje);
  const st = statusDoProjeto(p, estado.tarefas, hoje);
  const escolhida = (estado.pjFase || {})[p.id];
  const fase = pn.fases.find((x) => x.id === escolhida) || pn.atual || pn.fases[0];
  const somas = pn.kpis.filter((k) => k.tipo === 'soma');
  const grafico = somas.find((k) => k.principal) || somas[0];
  return `
    ${cabecalho(p.titulo, `${pn.tipo.emoji} ${esc(pn.tipo.nome)} · ${esc(pn.metodo?.nome || '')}${p.status === 'pausado' ? ' · pausado' : p.status === 'concluido' ? ' · concluído' : ''}`)}
    <div class="acoes cal-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#projetos">← Projetos</a>
      <a class="botao botao-secundario botao-pequeno" href="#tarefas/projeto-${esc(p.id)}">Todas as tarefas</a>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="projeto-editar" data-id="${esc(p.id)}">Editar</button>
    </div>
    <div class="pj-painel">
      <section class="card pj-agora" aria-label="Agora">
        <div class="pj-agora-topo">${farol(st.farol)}<span class="pj-agora-data">${esc(pn.rotuloChave)}: ${esc(textoDia(pn.chave, hoje))}</span></div>
        <p class="pj-agora-contagem">${esc(pn.contagem)}</p>
        ${pn.atual ? `<p class="pj-linha">Fase atual: <b>${esc(pn.atual.nome)}</b> · ${pn.atual.feitas} de ${pn.atual.total}</p>` : ''}
        ${barraProgresso(st.progresso.fracao, 'Progresso do projeto')}
        ${st.farol === 'risco' || st.farol === 'atrasado' ? `<p class="pj-linha pj-motivo">${esc(st.motivo)}</p>` : ''}
        ${pn.proxima ? `<div class="pj-proximo"><p><small>Próximo passo</small><b>${esc(pn.proxima.titulo)}</b>${pn.proxima.data ? `<small>${esc(textoDia(pn.proxima.data, hoje))}</small>` : ''}</p>
          <button class="botao botao-primario botao-pequeno" type="button" data-acao="tarefa-coluna" data-valor="feito" data-id="${esc(pn.proxima.id)}">Feito</button></div>` : '<p class="texto-suave">Nenhuma tarefa aberta.</p>'}
      </section>
      ${`
      <section class="card pj-numeros" aria-labelledby="pj-num-t">
        <div class="card-topo"><h2 class="card-titulo" id="pj-num-t">Números</h2><button class="card-link" type="button" data-acao="pj-extra" data-id="${esc(p.id)}">+ Número</button></div>
        ${pn.kpis.length ? `<ul class="pj-kpis">${pn.kpis.map(kpiHtml).join('')}</ul>` : '<p class="texto-suave">Crie um número para acompanhar (ex.: inscritos, vendas, páginas).</p>'}
        ${pn.ritmo && !pn.ritmo.encerrada ? `<p class="pj-linha${pn.ritmo.abaixo ? ' pj-motivo' : ''}">${pn.ritmo.abaixo ? esc(pn.ritmo.texto) : `No ritmo: ~${esc(formatarValor(pn.ritmo.esperado, pn.ritmo.kpi.unidade))} esperados até hoje.`}</p>` : ''}
        ${grafico ? graficoHtml(p, grafico, hoje) : ''}
        ${somas.length ? `
        <form class="pj-lancar" data-form="pj-numeros" data-id="${esc(p.id)}" novalidate>
          <p class="pj-lancar-titulo">Lançar os números</p>
          <div class="pj-lancar-campos">
            <label class="campo"><span class="campo-rotulo">Dia</span><input name="dia" type="date" value="${hoje}" max="${hoje}"></label>
            ${somas.map((k) => `<label class="campo"><span class="campo-rotulo">${esc(k.nome)}</span><input name="k:${esc(k.id)}" type="number" inputmode="numeric" step="1" placeholder="0"></label>`).join('')}
          </div>
          <button class="botao botao-primario botao-pequeno" type="submit">Lançar</button>
        </form>` : ''}
      </section>`}
    </div>
    <section class="card pj-fases-card" aria-labelledby="pj-fases-t">
      <h2 class="card-titulo" id="pj-fases-t">Fases</h2>
      <ol class="pj-fases" role="list">${pn.fases.map((fz) => `
        <li><button class="pj-fase pj-fase-${fz.estado}" type="button" data-acao="pj-fase" data-id="${esc(p.id)}" data-valor="${esc(fz.id)}" aria-pressed="${fz.id === fase?.id}">
          <b>${esc(fz.nome)}</b><small>${esc(curto(fz.inicio))}${fz.fim !== fz.inicio ? ` – ${esc(curto(fz.fim))}` : ''}</small>
          <span class="pj-fase-barra"><i style="width:${Math.round(fz.fracao * 100)}%"></i></span><small>${fz.feitas}/${fz.total}</small></button></li>`).join('')}</ol>
      ${fase ? `
      <div class="pj-checklist">
        <ul>${fase.tarefas.map((x) => `
          <li class="pj-tarefa${x.feita_em ? ' feita' : ''}">
            <button class="pj-marcar" type="button" data-acao="tarefa-coluna" data-valor="${x.feita_em ? 'afazer' : 'feito'}" data-id="${esc(x.id)}" aria-pressed="${Boolean(x.feita_em)}" aria-label="${x.feita_em ? 'Desmarcar' : 'Marcar como feita'}: ${esc(x.titulo)}"></button>
            <span class="pj-tarefa-nome">${esc(x.titulo)}${x.dados?.marco ? ' <span class="selo pj-selo-marco">marco</span>' : ''}</span>
            <small>${x.data ? esc(textoDia(x.data, hoje)) : ''}</small>
          </li>`).join('') || '<li class="texto-suave">Nenhuma tarefa nesta fase.</li>'}</ul>
        <form class="pj-nova-tarefa" data-form="pj-tarefa" data-id="${esc(p.id)}" data-fase="${esc(fase.id)}" novalidate>
          <input name="titulo" type="text" maxlength="200" placeholder="Nova tarefa em ${esc(fase.nome)}" aria-label="Nova tarefa nesta fase">
          <input name="data" type="date" value="${esc(fase.inicio > hoje ? fase.inicio : hoje)}" aria-label="Dia da tarefa">
          <button class="botao botao-secundario botao-pequeno" type="submit">Pôr</button>
        </form>
      </div>` : ''}
    </section>
    <div class="pj-secoes">${pn.secoes.map((s) => secaoHtml(p, s, pn.itens[s] || [])).join('')}</div>
    <section class="card pj-aprendizados">
      <label class="campo"><span class="card-titulo">Aprendizados</span>
        <textarea rows="4" maxlength="6000" data-acao-mudar="pj-aprendizados" data-id="${esc(p.id)}" placeholder="O que funcionou, o que mudar no próximo">${esc(p.dados.aprendizados || '')}</textarea></label>
    </section>`;
}

function kpiHtml(k) {
  return `<li class="pj-kpi${k.principal ? ' principal' : ''}">
    <span class="pj-kpi-nome">${esc(k.nome)}</span>
    <b class="pj-kpi-valor">${esc(formatarValor(k.valor, k.unidade))}</b>
    ${k.meta ? `<span class="pj-kpi-meta">de ${esc(formatarValor(k.meta, k.unidade))}</span><span class="pj-fase-barra"><i style="width:${Math.round((k.fracao || 0) * 100)}%"></i></span>` : `<span class="pj-kpi-meta">${k.tipo === 'soma' ? 'lançado' : 'calculado'}</span>`}
  </li>`;
}

function graficoHtml(p, k, hoje) {
  const serie = serieDoNumero(p, k.id, hoje, 14);
  const max = Math.max(1, ...serie.map((x) => x.valor));
  if (!serie.some((x) => x.valor)) return '';
  return `<figure class="pj-grafico" aria-label="${esc(k.nome)} nos últimos 14 dias">
    <div class="pj-barras">${serie.map((x) => `<span title="${esc(curto(x.data))}: ${x.valor}" style="height:${Math.max(2, Math.round((x.valor / max) * 100))}%"${x.data === hoje ? ' class="hoje"' : ''}></span>`).join('')}</div>
    <figcaption class="texto-suave">${esc(k.nome)} por dia, últimas 2 semanas</figcaption>
  </figure>`;
}

function secaoHtml(p, id, itens) {
  const s = SECOES[id];
  if (!s) return '';
  const etapas = s.etapas ? ETAPAS[s.etapas] : null;
  const contagem = etapas ? `<ul class="pj-funil">${etapas.map(([e, nome]) => `<li><b>${itens.filter((x) => x.etapa === e).length}</b><small>${esc(nome)}</small></li>`).join('')}</ul>` : '';
  const feitos = s.checklist ? itens.filter((x) => x.feito).length : s.comData ? itens.filter((x) => x.feito).length : null;
  return `
    <section class="card pj-secao" aria-labelledby="pj-s-${id}">
      <div class="card-topo"><h2 class="card-titulo" id="pj-s-${id}">${esc(s.nome)}</h2><span class="texto-suave">${feitos !== null ? `${feitos} de ${itens.length}` : itens.length}</span></div>
      ${contagem}
      <ul class="pj-itens">${itens.map((x) => `
        <li class="pj-item${x.feito ? ' feito' : ''}">
          ${s.checklist || s.comData ? `<button class="pj-marcar" type="button" data-acao="pj-item-feito" data-id="${esc(p.id)}" data-secao="${id}" data-valor="${esc(x.id)}" aria-pressed="${Boolean(x.feito)}" aria-label="${x.feito ? 'Desmarcar' : 'Marcar'}: ${esc(x.nome)}"></button>` : ''}
          <span class="pj-item-nome">${esc(x.nome)}</span>
          ${s.comData ? `<input type="date" value="${esc(x.data || '')}" data-acao-mudar="pj-item-campo" data-campo="data" data-id="${esc(p.id)}" data-secao="${id}" data-item="${esc(x.id)}" aria-label="Dia de ${esc(x.nome)}">` : ''}
          ${s.comPalavras ? `<input type="number" inputmode="numeric" min="0" step="100" value="${esc(x.palavras || 0)}" data-acao-mudar="pj-item-campo" data-campo="palavras" data-id="${esc(p.id)}" data-secao="${id}" data-item="${esc(x.id)}" aria-label="Palavras de ${esc(x.nome)}" class="pj-palavras">` : ''}
          ${etapas ? `<select data-acao-mudar="pj-item-campo" data-campo="etapa" data-id="${esc(p.id)}" data-secao="${id}" data-item="${esc(x.id)}" aria-label="Etapa de ${esc(x.nome)}">${etapas.map(([e, nome]) => opcao(e, x.etapa, nome)).join('')}</select>` : ''}
          <button class="pj-tirar" type="button" data-acao="pj-item-tirar" data-id="${esc(p.id)}" data-secao="${id}" data-valor="${esc(x.id)}" aria-label="Tirar ${esc(x.nome)}">×</button>
        </li>`).join('')}</ul>
      <form class="pj-novo-item" data-form="pj-item" data-id="${esc(p.id)}" data-secao="${id}" novalidate>
        <input name="nome" type="text" maxlength="160" placeholder="${esc(s.placeholder)}" aria-label="Novo ${esc(s.item)}">
        <button class="botao botao-secundario botao-pequeno" type="submit">Pôr</button>
      </form>
    </section>`;
}

