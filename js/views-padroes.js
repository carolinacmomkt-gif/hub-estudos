// Card "Padrões que você não vê" (Hoje e Resumo da semana).

import { esc } from './utilidades.js';
import { padroesVisiveis } from './dados-padroes.js';
import { dataLocal } from './views-dia.js';

export function cardPadroes(estado, { limite = 2, semVazio = false } = {}) {
  const hoje = dataLocal();
  const { achados, diasComAlgo } = padroesVisiveis(estado, hoje, { limite });
  if (!achados.length && semVazio) return '';
  return `
    <section class="card padroes" aria-labelledby="padroes-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="padroes-titulo">Padrões que você não vê</h2>
        <a class="card-link" href="#resumo">Resumo</a>
      </div>
      ${achados.length ? `<ul class="padroes-lista">${achados.map((a) => `
        <li class="padrao" data-padrao="${esc(a.id)}">
          <p>${esc(a.texto)}</p>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="padrao-dispensar" data-id="${esc(a.id)}" title="Esconder este achado">Não faz sentido</button>
        </li>`).join('')}</ul>`
        : `<p class="texto-suave">${diasComAlgo < 14 ? `Ainda cedo: com umas duas semanas de humor, foco, leitura e gastos registrados, os padrões começam a aparecer (${diasComAlgo} ${diasComAlgo === 1 ? 'dia' : 'dias'} até agora).` : 'Nada forte o bastante para apontar nas últimas 8 semanas. Isso também é informação: o seu dia a dia está parelho.'}</p>`}
    </section>`;
}
