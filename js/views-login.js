// Tela de login: e-mail → código de 6 números (melhor que link para o app instalado,
// porque um link abriria o navegador em vez do app).

import { icone } from './icones.js';
import { esc } from './utilidades.js';

export function renderLogin({ etapa = 'email', email = '', mensagem = '', erro = '', detalhe = '' } = {}) {
  const corpo = etapa === 'email'
    ? `
      <form class="formulario" data-form="login-email" novalidate>
        <label class="campo">
          <span class="campo-rotulo">Seu e-mail</span>
          <input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(email)}" required>
        </label>
        <button class="botao botao-primario" type="submit">Enviar código</button>
      </form>`
    : `
      <p class="texto-suave">Mandamos um código para <strong>${esc(email)}</strong>. Ele chega em até um minuto; confira também o spam.</p>
      <form class="formulario" data-form="login-codigo" novalidate>
        <input type="hidden" name="email" value="${esc(email)}">
        <label class="campo">
          <span class="campo-rotulo">Código</span>
          <input class="campo-codigo" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required>
        </label>
        <button class="botao botao-primario" type="submit">Entrar</button>
        <div class="login-acoes">
          <button class="botao botao-secundario" type="button" data-acao="login-reenviar" data-email="${esc(email)}">Reenviar código</button>
          <button class="botao botao-secundario" type="button" data-acao="login-trocar-email">Usar outro e-mail</button>
        </div>
      </form>`;

  return `
    <section class="login" aria-labelledby="login-titulo">
      <div class="login-marca">${icone('marca')}</div>
      <h1 id="login-titulo" tabindex="-1">Entrar no Hub</h1>
      <p class="texto-suave">Só você tem acesso. Seus dados ficam guardados com segurança e também neste aparelho.</p>
      ${mensagem ? `<p class="ava-status" role="status">${esc(mensagem)}</p>` : ''}
      ${erro ? `<div class="ava-alerta" role="alert">${esc(erro)}${detalhe ? `<small class="detalhe-tecnico">Detalhe: ${esc(detalhe)}</small>` : ''}</div>` : ''}
      ${corpo}
    </section>`;
}
