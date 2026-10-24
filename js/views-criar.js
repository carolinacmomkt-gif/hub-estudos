// Botão "+": caixa de entrada rápida (ideias em 2 segundos) e atalhos para criar coisas.
// Os atalhos ganham vida nas etapas de cada área.

import { icone } from './icones.js';
import { esc, haQuantoTempo } from './utilidades.js';

const EM_BREVE = [
  { icone: 'cadernos', rotulo: 'Novo caderno', etapa: '5' },
  { icone: 'calendario', rotulo: 'Novo evento', etapa: '4' },
  { icone: 'biblioteca', rotulo: 'Novo artigo', etapa: '6' },
  { icone: 'questoes', rotulo: 'Gerar questões', etapa: '7' },
];

export function renderFolhaCriar() {
  const atalhos = EM_BREVE.map((a) => `
    <li class="atalho-criar" aria-disabled="true">
      ${icone(a.icone)}<span>${esc(a.rotulo)}</span><span class="selo">Etapa ${esc(a.etapa)}</span>
    </li>`).join('');

  return `
    <form class="formulario" data-form="caixa-entrada" novalidate>
      <label class="campo">
        <span class="campo-rotulo">Ideia rápida</span>
        <textarea name="texto" rows="3" maxlength="2000" placeholder="Anote aqui. Depois você decide se vira pauta, tarefa ou nota."></textarea>
      </label>
      <button class="botao botao-primario" type="submit">Guardar na caixa de entrada</button>
    </form>
    <h3 class="ava-subtitulo">Em breve</h3>
    <ul class="atalhos-criar">${atalhos}</ul>`;
}

export function cardCaixaEntrada(itens, agora = Date.now()) {
  const abertos = itens
    .filter((i) => !i.processado_em)
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));

  const lista = abertos.slice(0, 6).map((item) => `
    <li class="entrada">
      <div class="entrada-texto">
        <p>${esc(item.texto)}</p>
        <p class="entrada-meta">${esc(haQuantoTempo(new Date(item.criado_em).getTime(), agora))}</p>
      </div>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="entrada-feita" data-id="${esc(item.id)}"
        aria-label="Marcar como resolvida: ${esc(item.texto.slice(0, 60))}">Feito</button>
    </li>`).join('');

  return `
    <section class="card" aria-labelledby="caixa-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="caixa-titulo">Caixa de entrada${abertos.length ? ` <span class="selo">${abertos.length}</span>` : ''}</h2>
        <button class="card-link" type="button" data-acao="abrir-criar">Anotar ideia</button>
      </div>
      ${lista
        ? `<ul class="entradas">${lista}</ul>`
        : '<p class="texto-suave">Nada por aqui. Toque no <strong>+</strong> para anotar uma ideia em segundos.</p>'}
    </section>`;
}
