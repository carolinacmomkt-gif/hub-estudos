// Tela Tarefas e projetos (#tarefas, #tarefas/proximos, #tarefas/algum-dia, #tarefas/feitas,
// #tarefas/projetos, #tarefas/projeto-<id>), os formulários e os cards do Hoje.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import {
  AREAS_TAREFA, PRIORIDADES, NOMES_DIA, iso, deIso, somarDias, textoRepeticao, lerTarefaRapida,
  tarefasDeHoje, proximosDias, algumDia, depois, feitas, progressoDoProjeto,
} from './dados-tarefas.js';

export const ABAS_TAREFAS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'proximos', nome: 'Próximos' },
  { id: 'algum-dia', nome: 'Algum dia' },
  { id: 'feitas', nome: 'Feitas' },
  { id: 'projetos', nome: 'Projetos' },
];
export const STATUS_PROJETO = [
  { id: 'ativo', nome: 'Em andamento' },
  { id: 'pausado', nome: 'Pausado' },
  { id: 'concluido', nome: 'Concluído' },
];
const CORES = [1, 2, 3, 4, 5, 6];
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

export const hojeIso = () => iso(new Date());
const nomeArea = (id) => AREAS_TAREFA.find((a) => a.id === id)?.nome || '';
const vivos = (lista) => (lista || []).filter((x) => !x.excluido_em);

export function textoDia(data, hoje = hojeIso()) {
  if (!data) return '';
  if (data === hoje) return 'Hoje';
  if (data === somarDias(hoje, 1)) return 'Amanhã';
  if (data === somarDias(hoje, -1)) return 'Ontem';
  const dias = Math.round((deIso(data) - deIso(hoje)) / 864e5);
  if (dias > 1 && dias < 7) return NOMES_DIA[deIso(data).getDay()].replace(/^./, (c) => c.toUpperCase());
  return fmtCurto.format(deIso(data)).replace('.', '');
}

// Uma tarefa na lista. "mostrarData": nas visões em que a data não é óbvia.
export function itemTarefa(t, { projetos = [], hoje = hojeIso(), mostrarData = true, feitaHoje = false, semProjeto = false } = {}) {
  const feita = Boolean(t.feita_em) || feitaHoje;
  const projeto = t.projeto_id && !semProjeto ? projetos.find((p) => p.id === t.projeto_id) : null;
  const atrasada = !feita && t.data && t.data < hoje;
  const meta = [
    t.hora && `<span class="tarefa-hora">${esc(t.hora)}</span>`,
    mostrarData && t.data && `<span class="${atrasada ? 'tarefa-atrasada' : ''}">${esc(textoDia(t.data, hoje))}</span>`,
    t.recorrencia?.tipo && `<span title="Repete">↻ ${esc(textoRepeticao(t.recorrencia))}</span>`,
    projeto && `<span class="tarefa-projeto cor-${esc(projeto.cor || 1)}">${esc(projeto.titulo)}</span>`,
    t.area && t.area !== 'pessoal' && !semProjeto && `<span>${esc(nomeArea(t.area))}</span>`,
    t.notas && '<span aria-label="Tem notas">✎</span>',
  ].filter(Boolean);
  return `
    <li class="tarefa prio-${t.prioridade || 0}${feita ? ' feita' : ''}" data-tarefa="${esc(t.id)}">
      <button class="tarefa-check" type="button" data-acao="${feita ? 'tarefa-reabrir' : 'tarefa-feita'}" data-id="${esc(t.id)}"
        aria-label="${feita ? 'Reabrir' : 'Concluir'}: ${esc(t.titulo)}" aria-pressed="${feita}"><span aria-hidden="true"></span></button>
      <button class="tarefa-corpo" type="button" data-acao="tarefa-abrir" data-id="${esc(t.id)}">
        <span class="tarefa-titulo">${esc(t.titulo)}</span>
        ${meta.length ? `<span class="tarefa-meta">${meta.join('')}</span>` : ''}
      </button>
    </li>`;
}

const lista = (itens, op) => `<ul class="tarefas">${itens.map((t) => itemTarefa(t, op)).join('')}</ul>`;

// Campo de criação rápida, com a prévia do que foi entendido.
export function campoRapido({ projetoId = '', placeholder = 'Nova tarefa', compacto = false, dica = false } = {}) {
  return `
    <form class="tarefa-rapida${compacto ? ' compacta' : ''}" data-form="tarefa-rapida" data-projeto="${esc(projetoId)}" novalidate>
      <label class="visualmente-oculto" for="tarefa-rapida-${esc(projetoId || 'geral')}${compacto ? '-c' : ''}">Nova tarefa</label>
      <input id="tarefa-rapida-${esc(projetoId || 'geral')}${compacto ? '-c' : ''}" name="texto" type="text" maxlength="300" autocomplete="off" enterkeyhint="done"
        placeholder="${esc(placeholder)}" data-acao-mudar="tarefa-previa">
      <button class="botao botao-primario" type="submit" aria-label="Adicionar tarefa">+</button>
      <p class="tarefa-previa" data-previa aria-live="polite"></p>
      ${dica ? `<p class="tarefa-dica campo-ajuda">Dica: escreva do jeito que fala, como "pagar luz sexta 18h #casa !" (! importante, !! urgente).</p>` : ''}
    </form>`;
}

export function textoPrevia(texto, hoje = hojeIso()) {
  if (!texto.trim()) return '';
  const r = lerTarefaRapida(texto, hoje);
  const partes = [
    r.data && `📅 ${textoDia(r.data, hoje)}`,
    r.hora && `🕒 ${r.hora}`,
    r.recorrencia && `↻ ${textoRepeticao(r.recorrencia)}`,
    r.area && `🏷 ${nomeArea(r.area)}`,
    r.prioridade === 2 ? '‼ Urgente' : r.prioridade === 1 ? '! Importante' : '',
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : '';
}

function filtroAreas(estado) {
  const atual = estado.filtroTarefas || '';
  return `
    <div class="tarefa-filtros" role="group" aria-label="Filtrar por área">
      ${[{ id: '', nome: 'Todas' }, ...AREAS_TAREFA].map((a) => `
        <button class="chip-filtro" type="button" data-acao="tarefa-filtro" data-valor="${a.id}" aria-pressed="${atual === a.id}">${esc(a.nome)}</button>`).join('')}
    </div>`;
}

function vazio(texto) {
  return `<p class="texto-suave tarefa-vazio">${texto}</p>`;
}

function visaoHoje(tarefas, op) {
  const h = tarefasDeHoje(tarefas, op.hoje);
  if (!h.atrasadas.length && !h.hoje.length && !h.feitas.length) {
    return vazio('Nada para hoje. Escreva acima o que precisa fazer, do jeito que falaria: "ligar para a Sensus amanhã 10h".');
  }
  return `
    ${h.atrasadas.length ? `<section class="card"><h2 class="card-titulo tarefa-grupo-titulo atraso">Atrasadas <span class="selo">${h.atrasadas.length}</span></h2>${lista(h.atrasadas, op)}
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="tarefa-atrasadas-hoje">Passar todas para hoje</button></section>` : ''}
    <section class="card"><h2 class="card-titulo tarefa-grupo-titulo">Hoje${h.hoje.length ? ` <span class="selo">${h.hoje.length}</span>` : ''}</h2>
      ${h.hoje.length ? lista(h.hoje, { ...op, mostrarData: false }) : vazio(h.feitas.length ? 'Tudo feito por hoje. ✨' : 'Nenhuma tarefa marcada para hoje.')}</section>
    ${h.feitas.length ? `<details class="card tarefa-feitas-hoje"><summary>Feitas hoje (${h.feitas.length})</summary>
      ${lista(h.feitas, { ...op, mostrarData: false, feitaHoje: true })}</details>` : ''}`;
}

function visaoProximos(tarefas, op) {
  const grupos = proximosDias(tarefas, op.hoje);
  const mais = depois(tarefas, op.hoje);
  if (!grupos.length && !mais.length) return vazio('Nada marcado para os próximos dias.');
  return `
    ${grupos.map((g) => `<section class="card"><h2 class="card-titulo tarefa-grupo-titulo">${esc(textoDia(g.data, op.hoje))} <small class="campo-ajuda">${esc(fmtDia.format(deIso(g.data)))}</small></h2>
      ${lista(g.itens, { ...op, mostrarData: false })}</section>`).join('')}
    ${mais.length ? `<section class="card"><h2 class="card-titulo tarefa-grupo-titulo">Mais para a frente</h2>${lista(mais, op)}</section>` : ''}`;
}

function cartaoProjeto(p, tarefas) {
  const pr = progressoDoProjeto(p, tarefas);
  const status = STATUS_PROJETO.find((s) => s.id === p.status)?.nome || '';
  return `
    <li><a class="card projeto-cartao cor-${esc(p.cor || 1)}" href="#tarefas/projeto-${esc(p.id)}">
      <span class="projeto-faixa" aria-hidden="true"></span>
      <span class="projeto-nome">${esc(p.titulo)}</span>
      <span class="campo-ajuda">${esc([nomeArea(p.area), status, p.prazo && `até ${textoDia(p.prazo)}`].filter(Boolean).join(' · '))}</span>
      ${barraProgresso(pr.fracao, `Progresso de ${p.titulo}`)}
      <span class="campo-ajuda">${pr.total ? `${pr.prontas} de ${pr.total} tarefas` : 'Sem tarefas ainda'}</span>
    </a></li>`;
}

function visaoProjetos(estado, tarefas) {
  const projetos = vivos(estado.projetos).filter((p) => !estado.filtroTarefas || p.area === estado.filtroTarefas);
  const ativos = projetos.filter((p) => p.status !== 'concluido');
  const prontos = projetos.filter((p) => p.status === 'concluido');
  return `
    <div class="acoes"><button class="botao botao-primario" type="button" data-acao="projeto-novo">+ Novo projeto</button></div>
    ${ativos.length ? `<ul class="projetos">${ativos.map((p) => cartaoProjeto(p, tarefas)).join('')}</ul>`
      : vazio('Nenhum projeto ainda. Um projeto junta as tarefas de uma meta maior, como "Lançar o produto da consultoria".')}
    ${prontos.length ? `<details class="card"><summary>Concluídos (${prontos.length})</summary><ul class="projetos">${prontos.map((p) => cartaoProjeto(p, tarefas)).join('')}</ul></details>` : ''}`;
}

function telaProjeto(estado, id, op) {
  const p = vivos(estado.projetos).find((x) => x.id === id);
  if (!p) return `${cabecalho('Projeto')}<section class="card"><p class="texto-suave">Esse projeto não existe mais.</p><a class="botao botao-secundario" href="#tarefas/projetos">Ver os projetos</a></section>`;
  const todas = vivos(estado.tarefas).filter((t) => t.projeto_id === id);
  const pr = progressoDoProjeto(p, estado.tarefas);
  const abertas = todas.filter((t) => !t.feita_em).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || (a.ordem || 0) - (b.ordem || 0));
  const prontas = todas.filter((t) => t.feita_em);
  return `
    ${cabecalho(p.titulo, esc([nomeArea(p.area), STATUS_PROJETO.find((s) => s.id === p.status)?.nome, p.prazo && `prazo ${textoDia(p.prazo)}`].filter(Boolean).join(' · ')))}
    <div class="acoes cal-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#tarefas/projetos">‹ Projetos</a>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="projeto-editar" data-id="${esc(p.id)}">Editar projeto</button>
    </div>
    <div class="tarefa-visao">
    <section class="card projeto-topo cor-${esc(p.cor || 1)}">
      ${barraProgresso(pr.fracao, 'Progresso do projeto')}
      <p class="campo-ajuda">${pr.total ? `${pr.prontas} de ${pr.total} tarefas prontas` : 'Adicione as tarefas deste projeto abaixo.'}</p>
      ${p.notas ? `<p class="proprio-texto">${esc(p.notas)}</p>` : ''}
    </section>
    ${campoRapido({ projetoId: p.id, placeholder: 'Nova tarefa deste projeto' })}
    <section class="card">${abertas.length ? lista(abertas, { ...op, semProjeto: true }) : vazio(pr.total ? 'Todas as tarefas prontas. 🎉' : 'Sem tarefas ainda.')}</section>
    ${prontas.length ? `<details class="card"><summary>Prontas (${prontas.length})</summary>${lista(prontas, { ...op, semProjeto: true })}</details>` : ''}
    </div>`;
}

export function renderTarefas(estado) {
  const hoje = hojeIso();
  const parametro = estado.parametro || 'hoje';
  const op = { projetos: vivos(estado.projetos), hoje };
  if (parametro.startsWith('projeto-')) return telaProjeto(estado, parametro.slice(8), op);
  const aba = ABAS_TAREFAS.some((a) => a.id === parametro) ? parametro : 'hoje';
  const filtro = estado.filtroTarefas || '';
  const tarefas = vivos(estado.tarefas).filter((t) => !filtro || t.area === filtro);
  const h = tarefasDeHoje(tarefas, hoje);
  const sub = [
    h.hoje.length ? `${h.hoje.length} para hoje` : 'nada para hoje',
    h.atrasadas.length && `${h.atrasadas.length} ${h.atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`,
    h.feitas.length && `${h.feitas.length} ${h.feitas.length === 1 ? 'feita' : 'feitas'} hoje`,
  ].filter(Boolean).join(' · ');
  let corpo;
  if (aba === 'hoje') corpo = visaoHoje(tarefas, op);
  else if (aba === 'proximos') corpo = visaoProximos(tarefas, op);
  else if (aba === 'algum-dia') {
    const itens = algumDia(tarefas);
    corpo = itens.length ? `<section class="card">${lista(itens, op)}</section>` : vazio('Tarefas sem data ficam aqui. Bom lugar para ideias que ainda não têm dia.');
  } else if (aba === 'feitas') {
    const itens = feitas(tarefas);
    corpo = itens.length ? `<section class="card">${lista(itens, op)}</section>` : vazio('As tarefas concluídas aparecem aqui.');
  } else corpo = visaoProjetos(estado, tarefas);
  return `
    ${cabecalho('Tarefas e projetos', esc(sub))}
    ${aba !== 'projetos' ? campoRapido({ dica: vivos(estado.tarefas).length < 5 }) : ''}
    <nav class="segmentado tarefa-abas" aria-label="Visões das tarefas">
      ${ABAS_TAREFAS.map((a) => `<a href="#tarefas/${a.id}" class="aba-link" aria-current="${a.id === aba ? 'page' : 'false'}">${esc(a.nome)}</a>`).join('')}
    </nav>
    ${filtroAreas(estado)}
    <div class="tarefa-visao">${corpo}</div>`;
}

// ---------------------------------------------------------------------------
// Formulários (abrem na folha de baixo)
// ---------------------------------------------------------------------------

const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;

export function formTarefa(t = {}, projetos = []) {
  const rec = t.recorrencia || {};
  const dias = rec.dias || [];
  return `
    <form class="formulario" data-form="tarefa" data-id="${esc(t.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">O que fazer</span>
        <input name="titulo" type="text" maxlength="300" required value="${esc(t.titulo || '')}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Dia</span><input name="data" type="date" value="${esc(t.data || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Hora (opcional)</span><input name="hora" type="time" value="${esc(t.hora || '')}"></label>
      </div>
      <fieldset class="campo"><legend class="campo-rotulo">Prioridade</legend>
        <div class="segmentado">${PRIORIDADES.map((p) => `
          <label class="segmentado-opcao"><input type="radio" name="prioridade" value="${p.valor}"${(t.prioridade || 0) === p.valor ? ' checked' : ''}><span>${esc(p.nome)}</span></label>`).join('')}</div>
      </fieldset>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Área</span>
          <select name="area">${AREAS_TAREFA.map((a) => opcao(a.id, t.area || 'pessoal', a.nome)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Projeto</span>
          <select name="projeto_id">${opcao('', t.projeto_id, 'Nenhum')}${vivos(projetos).filter((p) => p.status !== 'concluido' || p.id === t.projeto_id).map((p) => opcao(p.id, t.projeto_id, p.titulo)).join('')}</select></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Repetir</span>
        <select name="rep" data-acao-mudar="tarefa-rep">
          ${opcao('', rec.tipo, 'Não repete')}${opcao('diaria', rec.tipo, 'Todo dia')}${opcao('uteis', rec.tipo, 'Dias úteis')}${opcao('semanal', rec.tipo, 'Toda semana')}${opcao('mensal', rec.tipo, 'Todo mês')}
        </select></label>
      <fieldset class="campo" data-rep-semanal${rec.tipo === 'semanal' ? '' : ' hidden'}><legend class="campo-rotulo">Em quais dias</legend>
        <div class="grupo-marcar grupo-marcar-linha">${NOMES_DIA.map((n, i) => `
          <label class="campo-marcar"><input type="checkbox" name="dias" value="${i}"${dias.includes(i) ? ' checked' : ''}><span>${esc(n.slice(0, 3))}</span></label>`).join('')}</div>
      </fieldset>
      <label class="campo" data-rep-mensal${rec.tipo === 'mensal' ? '' : ' hidden'}><span class="campo-rotulo">Dia do mês</span>
        <input name="dia_mes" type="number" min="1" max="31" value="${esc(rec.dia || '')}"></label>
      <label class="campo"><span class="campo-rotulo">Notas</span><textarea name="notas" rows="3" maxlength="4000">${esc(t.notas || '')}</textarea></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${t.id ? 'Salvar' : 'Adicionar'}</button>
        ${t.id ? `<button class="botao botao-secundario" type="button" data-acao="tarefa-excluir" data-id="${esc(t.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function lerFormTarefa(form) {
  const f = new FormData(form);
  const titulo = String(f.get('titulo') || '').trim();
  if (!titulo) return { erro: 'Escreva o que é para fazer.' };
  const rep = f.get('rep');
  let recorrencia = null;
  if (rep === 'diaria' || rep === 'uteis') recorrencia = { tipo: rep };
  if (rep === 'semanal') {
    const dias = f.getAll('dias').map(Number);
    recorrencia = { tipo: 'semanal', dias: dias.length ? dias : [deIso(f.get('data') || hojeIso()).getDay()] };
  }
  if (rep === 'mensal') recorrencia = { tipo: 'mensal', dia: Math.min(31, Math.max(1, Number(f.get('dia_mes')) || deIso(f.get('data') || hojeIso()).getDate())) };
  let data = f.get('data') || null;
  if (recorrencia && !data) data = hojeIso();
  return {
    dados: {
      titulo, data, hora: f.get('hora') || null, prioridade: Number(f.get('prioridade')) || 0,
      area: f.get('area') || 'pessoal', projeto_id: f.get('projeto_id') || null, recorrencia, notas: String(f.get('notas') || '').trim() || null,
    },
  };
}

export function formProjeto(p = {}) {
  return `
    <form class="formulario" data-form="projeto" data-id="${esc(p.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Nome do projeto</span>
        <input name="titulo" type="text" maxlength="120" required value="${esc(p.titulo || '')}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Área</span>
          <select name="area">${AREAS_TAREFA.map((a) => opcao(a.id, p.area || 'pessoal', a.nome)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Prazo (opcional)</span><input name="prazo" type="date" value="${esc(p.prazo || '')}"></label>
      </div>
      <fieldset class="campo"><legend class="campo-rotulo">Cor</legend>
        <div class="cores-projeto">${CORES.map((c) => `
          <label class="cor-opcao cor-${c}"><input type="radio" name="cor" value="${c}"${String(p.cor || 1) === String(c) ? ' checked' : ''}><span class="visualmente-oculto">Cor ${c}</span></label>`).join('')}</div>
      </fieldset>
      ${p.id ? `<label class="campo"><span class="campo-rotulo">Situação</span>
        <select name="status">${STATUS_PROJETO.map((s) => opcao(s.id, p.status || 'ativo', s.nome)).join('')}</select></label>` : ''}
      <label class="campo"><span class="campo-rotulo">Notas</span><textarea name="notas" rows="3" maxlength="4000" placeholder="Objetivo, links, ideias">${esc(p.notas || '')}</textarea></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${p.id ? 'Salvar' : 'Criar projeto'}</button>
        ${p.id ? `<button class="botao botao-secundario" type="button" data-acao="projeto-excluir" data-id="${esc(p.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function lerFormProjeto(form) {
  const f = new FormData(form);
  const titulo = String(f.get('titulo') || '').trim();
  if (!titulo) return { erro: 'Dê um nome ao projeto.' };
  const dados = { titulo, area: f.get('area') || 'pessoal', prazo: f.get('prazo') || null, cor: String(f.get('cor') || '1'), notas: String(f.get('notas') || '').trim() || null };
  if (f.get('status')) dados.status = f.get('status');
  return { dados };
}

// ---------------------------------------------------------------------------
// Cards do Hoje
// ---------------------------------------------------------------------------

export function cardTarefasHoje(estado) {
  const hoje = hojeIso();
  const h = tarefasDeHoje(estado.tarefas, hoje);
  const op = { projetos: vivos(estado.projetos), hoje };
  const itens = [...h.atrasadas, ...h.hoje];
  return `
    <section class="card" aria-labelledby="tarefas-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="tarefas-hoje-titulo">Tarefas de hoje${itens.length ? ` <span class="selo">${itens.length}</span>` : ''}</h2>
        <a class="card-link" href="#tarefas">Ver todas</a>
      </div>
      ${campoRapido({ compacto: true, placeholder: 'Nova tarefa para hoje' })}
      ${itens.length ? lista(itens.slice(0, 8), { ...op, mostrarData: true })
        : `<p class="texto-suave">${h.feitas.length ? `Tudo feito por hoje (${h.feitas.length}). ✨` : 'Nada para hoje ainda.'}</p>`}
      ${itens.length > 8 ? `<a class="card-link" href="#tarefas">Mais ${itens.length - 8}</a>` : ''}
    </section>`;
}

export function cardProjetosHoje(estado) {
  const ativos = vivos(estado.projetos).filter((p) => p.status === 'ativo' || !p.status);
  if (!ativos.length) return '';
  return `
    <section class="card" aria-labelledby="projetos-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="projetos-hoje-titulo">Projetos em andamento</h2>
        <a class="card-link" href="#tarefas/projetos">Projetos</a>
      </div>
      <ul class="lista-simples">${ativos.slice(0, 5).map((p) => {
        const pr = progressoDoProjeto(p, estado.tarefas);
        return `<li><a class="projeto-linha cor-${esc(p.cor || 1)}" href="#tarefas/projeto-${esc(p.id)}"><span class="projeto-bolinha" aria-hidden="true"></span>${esc(p.titulo)}</a>${barraProgresso(pr.fracao, `Progresso de ${p.titulo}`)}</li>`;
      }).join('')}</ul>
    </section>`;
}

// Tarefas com hora marcada para hoje, no formato dos eventos da Agenda de hoje.
export function tarefasNaAgenda(tarefas, hoje = hojeIso()) {
  return vivos(tarefas)
    .filter((t) => t.hora && t.data === hoje && !t.feita_em)
    .map((t) => ({ id: t.id, titulo: t.titulo, tipo: 'tarefa', inicio: new Date(`${t.data}T${t.hora}:00`).toISOString(), fim: null, dia_inteiro: false }));
}
