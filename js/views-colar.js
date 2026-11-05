// "Colar demandas" na Caixa de entrada: o texto colado e a prévia das tarefas, já distribuídas
// nos dias, para a Carol conferir (título, área, prioridade, dia, hora, tempo e "Pôr no calendário").

import { esc } from './utilidades.js';
import { AREAS_TAREFA, PRIORIDADES } from './dados-tarefas.js';
import { textoDoDia } from './dados-organizar.js';
import { botaoDitado } from './ditado.js';

const TEMPOS = [15, 30, 45, 60, 90, 120, 180, 240];
const tempo = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`);
const opcao = (valor, atual, nome) => `<option value="${esc(valor)}"${String(valor) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;


export function formColarTexto(texto = '', ocupado = false) {
  return `
    <form class="formulario colar" data-form="colar-texto" novalidate>
      <label class="campo"><span class="campo-rotulo">Cole aqui a mensagem, o e-mail ou a lista</span>
        <textarea id="colar-texto" name="texto" rows="9" maxlength="8000" placeholder="Ex.: Oi Carol! Precisamos da legenda do carrossel da Dra. Karyne até sexta, ajustar a arte do reels (urgente) e marcar a reunião de pauta dia 12 às 10h.">${esc(texto)}</textarea></label>
      <div class="colar-acoes">
        <button class="botao botao-primario" type="submit"${ocupado ? ' disabled aria-busy="true"' : ''}>${ocupado ? 'Lendo o texto…' : '✨ Organizar em tarefas'}</button>
        <button class="botao botao-secundario" type="button" data-acao="colar-simples"${ocupado ? ' disabled' : ''}>Separar sem IA</button>
        ${botaoDitado('#colar-texto')}
      </div>
      <p class="campo-ajuda">A IA separa cada pedido numa tarefa e o app distribui nos seus próximos dias de trabalho, sem passar por cima dos compromissos e das horas protegidas. Você confere tudo antes de criar.</p>
    </form>`;
}

export function previaColar(itens, { fonte = 'ia', aviso = '' } = {}) {
  if (!itens.length) {
    return `<p class="texto-suave">Não achei nenhum pedido nesse texto.</p>
      <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="colar-voltar">← Voltar ao texto</button></div>`;
  }
  const dias = new Set(itens.filter((x) => x.data).map((x) => x.data)).size;
  return `
    <form class="formulario colar-previa" data-form="colar-salvar" novalidate>
      <div class="colar-topo">
        <p><strong>${itens.length} ${itens.length === 1 ? 'tarefa' : 'tarefas'}</strong>${dias ? ` em ${dias} ${dias === 1 ? 'dia' : 'dias'}` : ''}.</p>
        <div class="colar-acoes">
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="colar-voltar">← Voltar ao texto</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="colar-cal-todas">Pôr todas no calendário</button>
        </div>
      </div>
      ${fonte === 'simples' ? `<p class="ava-alerta">${esc(aviso || 'Sem a IA agora: separei uma tarefa por linha.')} Confira os títulos.</p>` : ''}
      <ul class="colar-itens">${itens.map((x, i) => `
        <li class="colar-item" data-i="${i}">
          <div class="colar-linha">
            <label class="colar-usar"><input type="checkbox" name="usar" value="${i}" checked><span class="visualmente-oculto">Criar esta tarefa</span></label>
            <label class="campo colar-titulo"><span class="visualmente-oculto">Título da tarefa ${i + 1}</span>
              <input name="t-${i}" type="text" maxlength="140" value="${esc(x.titulo)}"></label>
          </div>
          <div class="colar-grade">
            <label class="campo"><span class="campo-rotulo">Dia</span><input name="d-${i}" type="date" value="${esc(x.data || '')}"></label>
            <label class="campo"><span class="campo-rotulo">Hora</span><input name="h-${i}" type="time" value="${esc(x.inicio || '')}"></label>
            <label class="campo"><span class="campo-rotulo">Tempo</span><select name="m-${i}">${TEMPOS.map((m) => opcao(m, x.minutos, tempo(m))).join('')}</select></label>
            <label class="campo"><span class="campo-rotulo">Área</span><select name="a-${i}">${AREAS_TAREFA.map((a) => opcao(a.id, x.area, a.nome)).join('')}</select></label>
            <label class="campo"><span class="campo-rotulo">Prioridade</span><select name="p-${i}">${PRIORIDADES.map((p) => opcao(p.valor, x.prioridade, p.nome)).join('')}</select></label>
            <label class="campo-marcar colar-cal"><input type="checkbox" name="c-${i}"${x.hora ? ' checked' : ''}><span>Pôr no calendário</span></label>
          </div>
          ${x.prazo || x.quem ? `<p class="campo-ajuda">${[x.quem, x.prazo ? `prazo ${esc(textoDoDia(x.prazo))}` : ''].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
          ${x.semEspaco ? `
            <div class="colar-sem-espaco">
              <p>${x.semEspaco.sugestao ? `Não coube até o prazo. Ficou para ${esc(textoDoDia(x.semEspaco.sugestao))}.` : 'Não achei espaço nos próximos 14 dias. Escolha o dia.'}</p>
              ${x.semEspaco.mensagem ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="colar-copiar" data-i="${i}">Copiar mensagem pedindo prazo</button>` : ''}
            </div>` : ''}
          ${x.trecho ? `<p class="colar-trecho">“${esc(x.trecho)}”</p>` : ''}
        </li>`).join('')}</ul>
      <div class="acoes colar-salvar">
        <button class="botao botao-primario" type="submit">Criar as tarefas</button>
      </div>
    </form>`;
}

