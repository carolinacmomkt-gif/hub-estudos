// Tela Configurações: tema e teste de conexão com o AVA.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { OPCOES_TEMA, lerPreferenciaTema } from './tema.js';
import { esc } from './utilidades.js';

function cardTema() {
  const atual = lerPreferenciaTema();
  const opcoes = OPCOES_TEMA.map((o) => `
    <button class="opcao-tema" type="button" data-tema-opcao="${o.id}" aria-pressed="${o.id === atual}">
      ${icone(o.id)}
      <span>${esc(o.rotulo)}<small>${esc(o.descricao)}</small></span>
    </button>`).join('');

  return `
    <section class="card" aria-labelledby="config-tema">
      <h2 class="card-titulo" id="config-tema">Aparência</h2>
      <p class="texto-suave">A escolha fica salva neste aparelho.</p>
      <div class="opcoes-tema">${opcoes}</div>
    </section>`;
}

function cardAva() {
  return `
    <section class="card" aria-labelledby="config-ava">
      <h2 class="card-titulo" id="config-ava">Testar a conexão com o AVA</h2>
      <p class="texto-suave">
        Digite a matrícula e a senha do AVA uma vez. O app pede o acesso ao AVA, mostra o que está
        liberado e descarta a senha. Nesta etapa nada fica guardado.
      </p>
      <form class="formulario" data-form="ava-teste" novalidate>
        <label class="campo">
          <span class="campo-rotulo">Matrícula</span>
          <input name="matricula" type="text" inputmode="text" autocomplete="username" autocapitalize="off" spellcheck="false" required>
        </label>
        <label class="campo">
          <span class="campo-rotulo">Senha do AVA</span>
          <input name="senha" type="password" autocomplete="current-password" required>
        </label>
        <label class="campo">
          <span class="campo-rotulo">Código de acesso do Hub</span>
          <input name="codigo" type="password" autocomplete="off" required>
          <span class="campo-ajuda">O código que você criou na Netlify (HUB_CODIGO_ACESSO). Ele protege o teste até o login do app existir.</span>
        </label>
        <div>
          <button class="botao botao-primario" type="submit">Testar conexão</button>
        </div>
      </form>
      <div class="ava-resultado" id="ava-resultado" aria-live="polite"></div>
    </section>`;
}

export function renderConfiguracoes() {
  return `
    ${cabecalho('Configurações', 'Ajustes deste aparelho')}
    <div class="pilha">
      ${cardTema()}
      ${cardAva()}
    </div>`;
}

function itemMetodo(m) {
  return `
    <li class="metodo ${m.liberado ? 'metodo--ok' : 'metodo--bloqueado'}">
      <span class="metodo-marca" aria-hidden="true">${m.liberado ? '✓' : '✕'}</span>
      <span class="metodo-texto">
        <span class="metodo-descricao">${esc(m.descricao)}</span>
        <code>${esc(m.nome)}</code>
      </span>
      <span class="visualmente-oculto">${m.liberado ? 'liberado' : 'bloqueado'}</span>
    </li>`;
}

export function renderCarregandoAva() {
  return '<p class="ava-status">Falando com o AVA… isso leva alguns segundos.</p>';
}

export function renderResultadoAva(r) {
  const etapas = (r.etapas || []).map((e) => `
    <li class="metodo ${e.ok ? 'metodo--ok' : 'metodo--bloqueado'}">
      <span class="metodo-marca" aria-hidden="true">${e.ok ? '✓' : '✕'}</span>
      <span class="metodo-texto">
        <span class="metodo-descricao">${esc(e.nome)}</span>
        <span class="metodo-detalhe">${esc(e.detalhe)}</span>
      </span>
    </li>`).join('');

  const blocoEtapas = etapas ? `<h3 class="ava-subtitulo">Passo a passo</h3><ul class="metodos">${etapas}</ul>` : '';

  if (!r.ok) {
    return `
      <div class="ava-alerta" role="alert">${esc(r.erro || 'Não deu certo desta vez.')}</div>
      ${blocoEtapas}
      <p class="texto-suave">Se aparecer algo que você não entender, copie esta tela e me mande no chat.</p>`;
  }

  const bloqueados = r.metodos.filter((m) => !m.liberado).length;
  const resumo = bloqueados === 0
    ? 'Tudo o que o Hub precisa está liberado.'
    : `${bloqueados} ${bloqueados === 1 ? 'método está bloqueado' : 'métodos estão bloqueados'}. O app segue com o resto e mostra o que faltar.`;

  return `
    <div class="ava-sucesso">
      <strong>Conectou${r.usuaria?.nome ? `, ${esc(r.usuaria.nome)}` : ''}!</strong>
      <span>${esc(r.site?.nome || 'AVA')}${r.site?.versao ? ` · Moodle ${esc(r.site.versao)}` : ''} · ${r.totalFuncoes} funções liberadas no total.</span>
      <span>${esc(resumo)}</span>
    </div>
    ${blocoEtapas}
    <h3 class="ava-subtitulo">O que o Hub usa</h3>
    <ul class="metodos">${r.metodos.map(itemMetodo).join('')}</ul>
    <h3 class="ava-subtitulo">Frequência</h3>
    <p class="texto-suave">${r.frequencia.disponivel
      ? `Disponível pelo AVA (${r.frequencia.funcoes.map(esc).join(', ')}).`
      : 'O plugin de frequência não está no AVA: a frequência fica no Lyceum.'}</p>
    <h3 class="ava-subtitulo">Arquivos</h3>
    <p class="texto-suave">${r.baixarArquivos ? 'O AVA permite baixar os arquivos dos materiais pelo app.' : 'O AVA não liberou o download de arquivos pelo app.'}</p>
    <h3 class="ava-subtitulo">Alternativas (se algo acima estiver bloqueado)</h3>
    <ul class="metodos">${r.reservas.map(itemMetodo).join('')}</ul>
    <p class="texto-suave">Me mande este resultado no chat para eu ajustar o que vier bloqueado.</p>`;
}
