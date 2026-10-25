// Tela Estudos gerais: trilhas e temas com progresso (#estudos) e o painel de cada um
// (#estudos/<id>), com etapas, leituras, cadernos e questões ligados a ele.

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { esc } from './utilidades.js';
import { nomeStatus } from './dados-biblioteca.js';
import { taxaDeAcerto } from './dados-questoes.js';
import {
  TIPOS_AREA, CORES_AREA, areasAtivas, areaPeloId, conteudoDaArea, progressoDaArea, proximaEtapa,
} from './dados-estudos.js';

function cartaoArea(estado, a, i) {
  const prog = progressoDaArea(estado, a);
  const prox = a.tipo === 'trilha' ? proximaEtapa(a) : null;
  return `
    <li class="numerado est-cartao cor-area-${Number(a.cor) || 1}">
      <a class="est-cartao-link" href="#estudos/${esc(a.id)}">
        <span class="numerado-num">${String(i + 1).padStart(2, '0')}</span>
        <p class="numerado-titulo">${esc(a.nome)} <span class="selo">${a.tipo === 'trilha' ? 'Trilha' : 'Tema'}</span></p>
        <p class="numerado-detalhe">${esc(prog.detalhe)}</p>
        ${prox ? `<p class="campo-ajuda">Próxima etapa: ${esc(prox.texto)}</p>` : ''}
        ${barraProgresso(prog.fracao, `Progresso em ${a.nome}`)}
      </a>
    </li>`;
}

function painel(estado) {
  const areas = areasAtivas(estado);
  if (!areas.length) {
    return `
      ${cabecalho('Estudos gerais', 'O que você estuda por conta própria')}
      <section class="card vazio">
        <div class="vazio-icone">${icone('estudos')}</div>
        <h2>Trilhas e temas</h2>
        <p class="texto-suave">Uma <strong>trilha</strong> é um caminho com etapas (um curso, um livro por capítulos). Um <strong>tema</strong> é um assunto que você acompanha. Cada um junta as leituras, os cadernos e as questões dele.</p>
        <button class="botao botao-primario" type="button" data-acao="est-nova">Criar trilha ou tema</button>
      </section>`;
  }
  return `
    ${cabecalho('Estudos gerais', 'O que você estuda por conta própria')}
    <div class="acoes cal-acoes"><button class="botao botao-primario" type="button" data-acao="est-nova">Nova trilha ou tema</button></div>
    <ol class="numerados est-lista">${areas.map((a, i) => cartaoArea(estado, a, i)).join('')}</ol>`;
}

function detalhe(estado, a) {
  const prog = progressoDaArea(estado, a);
  const { artigos, cadernos, questoes } = conteudoDaArea(estado, a.id);
  const itens = Array.isArray(a.itens) ? a.itens : [];
  const respondidas = questoes.filter((q) => taxaDeAcerto(q) !== null);
  const acerto = respondidas.length ? Math.round((respondidas.reduce((s, q) => s + taxaDeAcerto(q), 0) / respondidas.length) * 100) : null;
  return `
    ${cabecalho(a.nome, esc(a.descricao || (a.tipo === 'trilha' ? 'Trilha' : 'Tema')))}
    <div class="acoes cal-acoes leitor-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#estudos">← Estudos gerais</a>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="est-editar">Editar</button>
      <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="est-excluir">Excluir</button>
    </div>
    <section class="card cor-area-${Number(a.cor) || 1} est-topo">
      <p class="numerado-detalhe">${esc(prog.detalhe)}</p>
      ${barraProgresso(prog.fracao, `Progresso em ${a.nome}`)}
      ${a.meta?.texto ? `<p><strong>Meta:</strong> ${esc(a.meta.texto)}${a.meta.ate ? ` · até ${esc(new Date(`${a.meta.ate}T12:00`).toLocaleDateString('pt-BR'))}` : ''}</p>` : ''}
      <div class="acoes">
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="est-questoes">Gerar questões sobre o tema</button>
        ${questoes.length ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="est-simulado">Fazer simulado</button>' : ''}
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="est-leitura">Adicionar leitura</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-novo" data-area="${esc(a.id)}">Novo caderno</button>
      </div>
    </section>
    ${a.tipo === 'trilha' ? `
    <section class="card">
      <h2 class="card-titulo">Etapas</h2>
      ${itens.length ? `<ol class="est-etapas">${itens.map((it, i) => `
        <li class="${it.feito ? 'feito' : ''}">
          <label class="campo-marcar"><input type="checkbox" data-est-item="${esc(it.id)}"${it.feito ? ' checked' : ''}><span>${esc(it.texto)}</span></label>
          <span class="est-etapa-acoes">
            <button class="botao-icone botao-icone-p" type="button" data-acao="est-item-mover" data-id="${esc(it.id)}" data-passo="-1" aria-label="Subir ${esc(it.texto)}"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="est-item-mover" data-id="${esc(it.id)}" data-passo="1" aria-label="Descer ${esc(it.texto)}"${i === itens.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="est-item-tirar" data-id="${esc(it.id)}" aria-label="Tirar ${esc(it.texto)}">×</button>
          </span>
        </li>`).join('')}</ol>` : '<p class="texto-suave">Nenhuma etapa ainda.</p>'}
      <form class="formulario est-novo-item" data-form="est-item" novalidate>
        <label class="campo"><span class="campo-rotulo">Nova etapa</span>
          <input name="texto" type="text" maxlength="200" placeholder="Ex.: Capítulo 3 · Módulo 2"></label>
        <button class="botao botao-secundario" type="submit">Adicionar</button>
      </form>
    </section>` : ''}
    <section class="card">
      <div class="card-topo"><h2 class="card-titulo">Leituras <span class="selo">${artigos.length}</span></h2>
        <a class="card-link" href="#biblioteca">Biblioteca</a></div>
      ${artigos.length ? `<ul class="lista-simples">${artigos.map((x) => `
        <li><a href="#biblioteca/${esc(x.id)}"><span class="bib-status status-${esc(x.status)}">${esc(nomeStatus(x.status))}</span> ${esc(x.titulo)}</a></li>`).join('')}</ul>`
      : '<p class="texto-suave">Nenhuma leitura ligada. Escolha este tema ao salvar na Biblioteca.</p>'}
    </section>
    <section class="card">
      <h2 class="card-titulo">Cadernos <span class="selo">${cadernos.length}</span></h2>
      ${cadernos.length ? `<ul class="lista-simples">${cadernos.map((c) => `<li><a href="#cadernos/${esc(c.id)}">${esc(c.titulo)}</a></li>`).join('')}</ul>`
      : '<p class="texto-suave">Nenhum caderno ligado.</p>'}
    </section>
    <section class="card">
      <h2 class="card-titulo">Questões <span class="selo">${questoes.length}</span></h2>
      ${questoes.length ? `<p>${acerto !== null ? `<strong>${acerto}%</strong> de acerto nas respondidas.` : 'Nenhuma respondida ainda.'}</p>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="est-ver-questoes">Ver no banco</button>`
      : '<p class="texto-suave">Nenhuma questão deste tema ainda.</p>'}
    </section>`;
}

export function renderEstudos(estado) {
  if (estado.parametro) {
    const a = areaPeloId(estado, estado.parametro);
    if (!a) {
      return `${cabecalho('Estudos gerais')}<section class="card"><p class="texto-suave">Não encontrado.</p>
        <a class="botao botao-secundario" href="#estudos">Voltar</a></section>`;
    }
    return detalhe(estado, a);
  }
  return painel(estado);
}

export function renderFormArea(a = null) {
  const tipo = a?.tipo || 'trilha';
  return `
    <form class="formulario" data-form="est-area" data-id="${esc(a?.id || '')}" novalidate>
      <fieldset class="campo">
        <legend class="campo-rotulo">Tipo</legend>
        ${TIPOS_AREA.map((t) => `<label class="campo-marcar"><input type="radio" name="tipo" value="${t.id}"${tipo === t.id ? ' checked' : ''}><span><strong>${t.nome}</strong> · ${esc(t.descricao)}</span></label>`).join('')}
      </fieldset>
      <label class="campo"><span class="campo-rotulo">Nome</span>
        <input name="nome" type="text" maxlength="100" required value="${esc(a?.nome || '')}" placeholder="Ex.: Curso de inglês · Filosofia política"></label>
      <label class="campo"><span class="campo-rotulo">Descrição <small>(opcional)</small></span>
        <input name="descricao" type="text" maxlength="300" value="${esc(a?.descricao || '')}"></label>
      ${a ? '' : `<label class="campo"><span class="campo-rotulo">Etapas <small>(trilha: uma por linha, opcional)</small></span>
        <textarea name="itens" rows="4" maxlength="5000"></textarea></label>`}
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Meta <small>(opcional)</small></span>
          <input name="meta" type="text" maxlength="200" value="${esc(a?.meta?.texto || '')}" placeholder="Ex.: terminar o curso"></label>
        <label class="campo"><span class="campo-rotulo">Até</span>
          <input name="ate" type="date" value="${esc(a?.meta?.ate || '')}"></label>
      </div>
      <fieldset class="grupo-marcar grupo-marcar-linha">
        <legend class="campo-rotulo">Cor</legend>
        ${CORES_AREA.map((c) => `
          <label class="capa-opcao">
            <input type="radio" name="cor" value="${c}"${Number(a?.cor || 1) === c ? ' checked' : ''}>
            <span class="capa-amostra capa-${c}" aria-hidden="true"></span>
            <span class="visualmente-oculto">Cor ${c}</span>
          </label>`).join('')}
      </fieldset>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

