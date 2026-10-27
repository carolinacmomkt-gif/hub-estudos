// Botão "+": caixa de entrada rápida (ideias em 2 segundos) e atalhos para criar coisas.

import { icone } from './icones.js';
import { esc, haQuantoTempo } from './utilidades.js';

export function renderFolhaCriar() {
  return `
    <form class="formulario" data-form="caixa-entrada" novalidate>
      <label class="campo">
        <span class="campo-rotulo">Ideia rápida</span>
        <textarea name="texto" rows="3" maxlength="2000" placeholder="Anote aqui. Depois você decide se vira pauta, tarefa ou nota."></textarea>
      </label>
      <button class="botao botao-primario" type="submit">Guardar na caixa de entrada</button>
    </form>
    <h3 class="ava-subtitulo">Criar</h3>
    <ul class="atalhos-criar">
      <li><button class="atalho-criar" type="button" data-acao="tarefa-nova">${icone('tarefas')}<span>Nova tarefa</span></button></li>
      <li><button class="atalho-criar" type="button" data-acao="cal-novo">${icone('calendario')}<span>Novo evento</span></button></li>
      <li><button class="atalho-criar" type="button" data-acao="caderno-novo">${icone('cadernos')}<span>Novo caderno</span></button></li>
      <li><button class="atalho-criar" type="button" data-acao="yt-novo">${icone('youtube')}<span>Ideia de vídeo</span></button></li>
      <li><a class="atalho-criar" href="#biblioteca/novo" data-acao="fechar-criar">${icone('biblioteca')}<span>Nova leitura</span></a></li>
      <li><a class="atalho-criar" href="#questoes/gerar" data-acao="fechar-criar">${icone('questoes')}<span>Gerar questões</span></a></li>
      <li><button class="atalho-criar" type="button" data-acao="ss-nova">${icone('substack')}<span>Pauta do Substack</span></button></li>
      <li><button class="atalho-criar" type="button" data-acao="est-nova">${icone('estudos')}<span>Trilha ou tema</span></button></li>
      <li><a class="atalho-criar" href="#foco" data-acao="fechar-criar">${icone('estudos')}<span>Sessão de foco</span></a></li>
      <li><a class="atalho-criar" href="#resumo" data-acao="fechar-criar">${icone('calendario')}<span>Resumo da semana</span></a></li>
    </ul>`;
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
