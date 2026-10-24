// Tela de login: e-mail e senha da conta do Supabase (só a Carol tem conta).

import { icone } from './icones.js';
import { esc } from './utilidades.js';

export function renderLogin({ email = '', mensagem = '', erro = '', detalhe = '' } = {}) {
  return `
    <section class="login" aria-labelledby="login-titulo">
      <div class="login-marca">${icone('marca')}</div>
      <h1 id="login-titulo" tabindex="-1">Entrar no Hub</h1>
      <p class="texto-suave">Só você tem acesso. Seus dados ficam guardados com segurança e também neste aparelho.</p>
      ${mensagem ? `<p class="ava-status" role="status">${esc(mensagem)}</p>` : ''}
      ${erro ? `<div class="ava-alerta" role="alert">${esc(erro)}${detalhe ? `<small class="detalhe-tecnico">Detalhe: ${esc(detalhe)}</small>` : ''}</div>` : ''}
      <form class="formulario" data-form="login" novalidate>
        <label class="campo">
          <span class="campo-rotulo">E-mail</span>
          <input name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(email)}" required>
        </label>
        <label class="campo">
          <span class="campo-rotulo">Senha</span>
          <input name="senha" type="password" autocomplete="current-password" required>
        </label>
        <button class="botao botao-primario" type="submit">Entrar</button>
      </form>
      <p class="campo-ajuda">Esqueceu a senha? No Supabase, em Authentication → Users, dá para criar a usuária de novo com uma senha nova.</p>
    </section>`;
}
