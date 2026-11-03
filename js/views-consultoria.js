// Consultoria (Sensus) (#consultoria, grupo Consultoria): carteira de clientes, funil de propostas e
// entregas/encontros, no mesmo padrão do Trabalho. Tabelas da migração 009: `clientes` e `consultoria`
// (tipo 'proposta' | 'entrega' | 'encontro'; etapa da proposta em dados.etapa; feito em dados.feito).

import { cabecalho } from './componentes.js';
import { esc } from './utilidades.js';
import { iso } from './dados-tarefas.js';

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const real = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const dia = (d) => (d ? fmt.format(new Date(`${d}T12:00:00`)).replace('.', '') : '');

export const STATUS_CLIENTE = [
  { id: 'prospect', nome: 'Em conversa' },
  { id: 'ativo', nome: 'Ativo' },
  { id: 'pausado', nome: 'Pausado' },
  { id: 'encerrado', nome: 'Encerrado' },
];
export const ETAPAS_PROPOSTA = [
  { id: 'rascunho', nome: 'Rascunho' },
  { id: 'enviada', nome: 'Enviada' },
  { id: 'negociando', nome: 'Negociando' },
  { id: 'fechada', nome: 'Fechada' },
  { id: 'perdida', nome: 'Perdida' },
];
const nomeStatus = (id) => STATUS_CLIENTE.find((s) => s.id === id)?.nome || id;

export function resumoConsultoria(estado, hoje = iso(new Date())) {
  const clientes = vivos(estado.clientesConsultoria);
  const itens = vivos(estado.consultoria);
  const ativos = clientes.filter((c) => c.status === 'ativo');
  const propostas = itens.filter((i) => i.tipo === 'proposta');
  const abertas = propostas.filter((p) => !['fechada', 'perdida'].includes(p.dados?.etapa || 'rascunho'));
  const fim = new Date(`${hoje}T12:00:00`); fim.setDate(fim.getDate() + 7);
  const entregas = itens.filter((i) => i.tipo !== 'proposta' && !i.dados?.feito).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return {
    clientes, ativos, propostas, abertas, entregas,
    receita: ativos.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
    emAberto: abertas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
    semana: entregas.filter((e) => e.data <= iso(fim)).length,
    atrasadas: entregas.filter((e) => e.data < hoje).length,
  };
}

export function renderConsultoria(estado) {
  const hoje = iso(new Date());
  const r = resumoConsultoria(estado, hoje);
  const projetos = vivos(estado.projetos).filter((p) => p.area === 'consultoria' && p.status !== 'concluido');
  const nomeCliente = (id) => r.clientes.find((c) => c.id === id)?.nome || '';
  return `
    ${cabecalho('Consultoria', `Sensus · ${r.ativos.length} ${r.ativos.length === 1 ? 'cliente ativo' : 'clientes ativos'} · ${esc(real(r.receita))} por mês`)}
    <div class="acoes cal-acoes">
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="cons-novo" data-valor="cliente">+ Cliente</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cons-novo" data-valor="proposta">+ Proposta</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cons-novo" data-valor="entrega">+ Entrega ou encontro</button>
    </div>
    <ul class="cons-numeros">
      <li class="card"><small>Receita por mês</small><b>${esc(real(r.receita))}</b><span>${r.ativos.length} ativos</span></li>
      <li class="card"><small>Propostas em aberto</small><b>${r.abertas.length}</b><span>${esc(real(r.emAberto))}</span></li>
      <li class="card"><small>Entregas em 7 dias</small><b>${r.semana}</b><span>${r.atrasadas ? `${r.atrasadas} atrasada${r.atrasadas > 1 ? 's' : ''}` : 'nada atrasado'}</span></li>
      <li class="card"><small>Projetos</small><b>${projetos.length}</b><span><a href="#portfolio">ver no painel</a></span></li>
    </ul>

    <section class="cons-secao" aria-label="Funil de propostas">
      <h2 class="pf-area-titulo">Propostas</h2>
      ${r.propostas.length ? `<div class="cons-funil">${ETAPAS_PROPOSTA.map((e) => {
        const lista = r.propostas.filter((p) => (p.dados?.etapa || 'rascunho') === e.id);
        // Rascunho e Perdida só aparecem quando têm alguma (para o funil não ocupar a tela à toa).
        if (!lista.length && (e.id === 'rascunho' || e.id === 'perdida')) return '';
        return `<section class="card cons-etapa" aria-label="${esc(e.nome)}"><p class="tb-rot">${esc(e.nome)} · ${lista.length}</p>
          ${lista.map((p) => `<article class="cons-item">
            <button class="pf-tarefa-titulo" type="button" data-acao="cons-editar" data-id="${esc(p.id)}">${esc(p.titulo)}</button>
            <small>${esc([nomeCliente(p.cliente_id) || p.dados?.prospect, p.valor ? real(p.valor) : '', p.data ? `desde ${dia(p.data)}` : ''].filter(Boolean).join(' · '))}</small>
            ${['fechada', 'perdida'].includes(e.id) ? '' : `<span class="pf-tarefa-acoes">${ETAPAS_PROPOSTA.filter((x) => x.id !== e.id && x.id !== 'rascunho').map((x) => `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="cons-etapa" data-id="${esc(p.id)}" data-valor="${x.id}">${esc(x.nome)}</button>`).join('')}</span>`}
          </article>`).join('') || '<p class="texto-suave">Nada aqui.</p>'}
        </section>`;
      }).join('')}</div>` : '<section class="card"><p class="texto-suave">Nenhuma proposta ainda. Registre as que você manda para acompanhar o funil: enviada → negociando → fechada.</p></section>'}
    </section>

    <div class="cons-duas">
      <section class="cons-secao" aria-label="Clientes">
        <h2 class="pf-area-titulo">Clientes</h2>
        ${r.clientes.length ? `<ul class="cons-lista">${r.clientes.sort((a, b) => STATUS_CLIENTE.findIndex((s) => s.id === a.status) - STATUS_CLIENTE.findIndex((s) => s.id === b.status) || a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => `
          <li><button class="card cons-cliente" type="button" data-acao="cons-editar" data-id="${esc(c.id)}" data-tipo="cliente">
            <b>${esc(c.nome)}</b><span class="selo">${esc(nomeStatus(c.status))}</span>
            <small>${esc([c.valor_mensal ? `${real(c.valor_mensal)}/mês` : '', c.inicio ? `desde ${dia(c.inicio)}` : ''].filter(Boolean).join(' · '))}</small>
          </button></li>`).join('')}</ul>` : '<section class="card"><p class="texto-suave">A carteira da consultoria fica aqui: quem está ativo, em conversa, pausado ou encerrado, e quanto cada um paga.</p></section>'}
      </section>
      <section class="cons-secao" aria-label="Entregas e encontros">
        <h2 class="pf-area-titulo">Entregas e encontros</h2>
        ${r.entregas.length ? `<ul class="cons-lista">${r.entregas.slice(0, 12).map((e) => `
          <li class="card cons-entrega${e.data < hoje ? ' atrasada' : ''}">
            <span><b>${esc(e.titulo)}</b><small>${esc([dia(e.data), e.dados?.hora, e.tipo === 'encontro' ? 'encontro' : 'entrega', nomeCliente(e.cliente_id)].filter(Boolean).join(' · '))}</small></span>
            <span class="pf-tarefa-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="cons-feito" data-id="${esc(e.id)}">Feito ✓</button>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cons-editar" data-id="${esc(e.id)}">Editar</button></span>
          </li>`).join('')}</ul>` : '<section class="card"><p class="texto-suave">Nada marcado. Entregas e encontros com data também aparecem no Calendário.</p></section>'}
      </section>
    </div>`;
}

const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;

export function formConsultoria(tipo, item = {}, clientes = []) {
  if (tipo === 'cliente') {
    return `<form class="formulario" data-form="cons-cliente" data-id="${esc(item.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Nome</span><input name="nome" type="text" maxlength="120" required value="${esc(item.nome || '')}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Situação</span><select name="status">${STATUS_CLIENTE.map((s) => opcao(s.id, item.status || 'ativo', s.nome)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Valor por mês (R$)</span><input name="valor_mensal" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(item.valor_mensal ?? '')}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Desde</span><input name="inicio" type="date" value="${esc(item.inicio || '')}"></label>
      <label class="campo"><span class="campo-rotulo">Notas</span><textarea name="notas" rows="3" maxlength="4000">${esc(item.notas || '')}</textarea></label>
      <p class="ava-alerta" data-erro hidden></p>
      <div class="acoes"><button class="botao botao-primario" type="submit">${item.id ? 'Salvar' : 'Adicionar'}</button>${item.id ? `<button class="botao botao-secundario" type="button" data-acao="cons-excluir" data-id="${esc(item.id)}" data-tipo="cliente">Excluir</button>` : ''}</div>
    </form>`;
  }
  const proposta = tipo === 'proposta';
  return `<form class="formulario" data-form="cons-item" data-tipo="${esc(tipo)}" data-id="${esc(item.id || '')}" novalidate>
    <label class="campo"><span class="campo-rotulo">${proposta ? 'Proposta' : 'O que é'}</span><input name="titulo" type="text" maxlength="160" required value="${esc(item.titulo || '')}" placeholder="${proposta ? 'Ex.: Consultoria de posicionamento' : 'Ex.: Entregar o plano de conteúdo'}"></label>
    ${proposta ? '' : `<label class="campo"><span class="campo-rotulo">Tipo</span><select name="tipo">${opcao('entrega', item.tipo || 'entrega', 'Entrega')}${opcao('encontro', item.tipo, 'Encontro')}</select></label>`}
    <div class="cal-form-linha">
      <label class="campo"><span class="campo-rotulo">Cliente</span><select name="cliente_id">${opcao('', item.cliente_id, proposta ? 'Ainda não é cliente' : 'Nenhum')}${clientes.map((c) => opcao(c.id, item.cliente_id, c.nome)).join('')}</select></label>
      ${proposta ? `<label class="campo"><span class="campo-rotulo">Para quem (se ainda não é cliente)</span><input name="prospect" type="text" maxlength="120" value="${esc(item.dados?.prospect || '')}"></label>` : ''}
    </div>
    <div class="cal-form-linha">
      <label class="campo"><span class="campo-rotulo">${proposta ? 'Enviada em' : 'Dia'}</span><input name="data" type="date" required value="${esc(item.data || iso(new Date()))}"></label>
      ${proposta ? `<label class="campo"><span class="campo-rotulo">Valor (R$ por mês)</span><input name="valor" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(item.valor ?? '')}"></label>` : `<label class="campo"><span class="campo-rotulo">Hora (opcional)</span><input name="hora" type="time" value="${esc(item.dados?.hora || '')}"></label>`}
    </div>
    ${proposta ? `<label class="campo"><span class="campo-rotulo">Etapa</span><select name="etapa">${ETAPAS_PROPOSTA.map((e) => opcao(e.id, item.dados?.etapa || 'enviada', e.nome)).join('')}</select></label>` : ''}
    <label class="campo"><span class="campo-rotulo">Notas</span><textarea name="texto" rows="3" maxlength="4000">${esc(item.texto || '')}</textarea></label>
    <p class="ava-alerta" data-erro hidden></p>
    <div class="acoes"><button class="botao botao-primario" type="submit">${item.id ? 'Salvar' : 'Adicionar'}</button>${item.id ? `<button class="botao botao-secundario" type="button" data-acao="cons-excluir" data-id="${esc(item.id)}">Excluir</button>` : ''}</div>
  </form>`;
}
