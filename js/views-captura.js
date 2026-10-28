// Captura por voz no "+": falar (ou escrever) e, com "Organizar", a prévia do que vai ser criado.
// A Carol confere o destino e o título de cada item antes de salvar.

import { esc } from './utilidades.js';
import { DESTINOS_CAPTURA } from './dados-captura.js';

export const temMicrofone = () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export function formCaptura() {
  const mic = temMicrofone();
  return `
    <form class="formulario captura" data-form="captura" novalidate>
      <label class="campo">
        <span class="campo-rotulo">Fale ou escreva</span>
        <textarea id="captura-texto" name="texto" rows="3" maxlength="3000"
          placeholder='Ex.: "gastei 40 no mercado, ligar pro banco amanhã às 10 e ideia de vídeo sobre rotina de provas"'></textarea>
      </label>
      <div class="captura-acoes">
        ${mic ? '<button class="botao botao-secundario captura-mic" type="button" data-acao="captura-falar" aria-pressed="false">🎙️ Falar</button>' : ''}
        <button class="botao botao-primario" type="submit">✨ Organizar</button>
        <button class="botao botao-secundario" type="button" data-acao="captura-caixa">Só guardar na caixa</button>
      </div>
      <p class="campo-ajuda">${mic ? 'Toque em Falar e diga tudo de uma vez.' : 'Use o microfone do teclado para ditar.'} A IA separa em tarefas, compromissos, gastos, ideias de vídeo, pautas e demandas, e você confere antes de salvar.</p>
    </form>
    <div id="captura-previa" aria-live="polite"></div>`;
}

const dinheiro = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

export function previaCaptura(itens, { simples = false } = {}) {
  if (!itens.length) return '<p class="texto-suave">Não achei nada para guardar. Fale de novo ou escreva.</p>';
  return `
    <form class="formulario captura-previa" data-form="captura-salvar" novalidate>
      ${simples ? '<p class="ava-alerta">Sem a IA agora: organizei do jeito simples. Confira o destino.</p>' : ''}
      <ul class="captura-itens">${itens.map((x, i) => `
        <li class="captura-item">
          <div class="captura-linha">
            <label class="visualmente-oculto" for="captura-destino-${i}">Destino do item ${i + 1}</label>
            <select id="captura-destino-${i}" name="destino-${i}">${DESTINOS_CAPTURA.map((d) => `<option value="${d.id}"${d.id === x.destino ? ' selected' : ''}>${esc(d.nome)}</option>`).join('')}</select>
            <button class="botao-icone botao-icone-p" type="button" data-acao="captura-tirar" data-i="${i}" aria-label="Tirar: ${esc(x.titulo)}" title="Tirar">×</button>
          </div>
          <label class="visualmente-oculto" for="captura-titulo-${i}">Título do item ${i + 1}</label>
          <input id="captura-titulo-${i}" name="titulo-${i}" type="text" maxlength="200" value="${esc(x.titulo)}">
          ${[x.data && dia(x.data), x.hora, x.valor && dinheiro(x.valor), x.prioridade === 2 ? 'urgente' : x.prioridade === 1 ? 'importante' : '', x.notas].filter(Boolean).length
    ? `<small class="campo-ajuda">${esc([x.data && dia(x.data), x.hora, x.valor && dinheiro(x.valor), x.prioridade === 2 ? 'urgente' : x.prioridade === 1 ? 'importante' : '', x.notas].filter(Boolean).join(' · '))}</small>` : ''}
        </li>`).join('')}</ul>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar ${itens.length === 1 ? 'o item' : `os ${itens.length}`}</button>
        <button class="botao botao-secundario" type="button" data-acao="captura-voltar">Voltar</button>
      </div>
    </form>`;
}
