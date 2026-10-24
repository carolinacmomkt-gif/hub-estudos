// Barra lateral (tablet/computador), barra inferior e folha "Mais" (celular).

import { icone } from './icones.js';
import { ROTAS, ROTA_CONFIGURACOES } from './rotas.js';
import { esc } from './utilidades.js';

function link(rota) {
  return `
    <li>
      <a class="nav-link" href="#${rota.id}" data-rota="${rota.id}">
        ${icone(rota.icone)}<span>${esc(rota.titulo)}</span>
      </a>
    </li>`;
}

function lista(rotas) {
  return `<ul class="nav-lista">${rotas.map(link).join('')}</ul>`;
}

const rotasDoMais = [...ROTAS.filter((r) => !r.fixaCelular), ROTA_CONFIGURACOES];

export function montarNavegacao() {
  document.getElementById('nav-lateral').innerHTML = `
    <a class="marca" href="#inicio" aria-label="Hub de Estudos, ir para o Início">
      <span class="marca-icone">${icone('marca')}</span>
      <span class="marca-texto">
        <span class="marca-nome">Hub de Estudos</span>
        <span class="marca-sub">da Carol</span>
      </span>
    </a>
    ${lista(ROTAS)}
    <div class="nav-rodape">${lista([ROTA_CONFIGURACOES])}</div>`;

  document.getElementById('nav-inferior').innerHTML = `
    <ul class="nav-lista">
      ${ROTAS.filter((r) => r.fixaCelular).map(link).join('')}
      <li>
        <button class="nav-link" type="button" data-acao="abrir-mais" aria-haspopup="dialog">
          ${icone('mais')}<span>Mais</span>
        </button>
      </li>
    </ul>`;

  document.getElementById('folha-mais-lista').innerHTML = lista(rotasDoMais);
}

export function marcarRotaAtiva(id) {
  document.querySelectorAll('[data-rota]').forEach((el) => {
    if (el.dataset.rota === id) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const botaoMais = document.querySelector('[data-acao="abrir-mais"]');
  botaoMais?.setAttribute('data-ativo', rotasDoMais.some((r) => r.id === id) ? 'sim' : 'nao');
}
