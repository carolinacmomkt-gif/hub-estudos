// Card "Plano para a prova" (Início e Calendário) e a folha para ajustar as sessões.

import { esc, diasAte } from './utilidades.js';
import { nomeDaDisciplina } from './dados-faculdade.js';
import { chaveDia, dataDaChave } from './dados-calendario.js';
import { provasParaPlanejar, preferenciasPlano, sugerirSessoes, diasPossiveis, OPCOES_MINUTOS } from './plano-estudo.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const diaCurto = (chave) => fmtDia.format(dataDaChave(chave)).replace('.', '');
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const horaBonita = (hora) => (hora.endsWith(':00') ? `${Number(hora.slice(0, 2))}h` : hora.replace(':', 'h'));

function quandoEhAProva(prova, agora) {
  const dias = diasAte(new Date(prova.inicio).getTime(), agora);
  const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  return `${quando} (${fmtDiaLongo.format(new Date(prova.inicio))})`;
}

export function cardPlano(estado, { classes = '', agora = Date.now() } = {}) {
  const lista = provasParaPlanejar(estado, agora);
  if (!lista.length) return '';
  const { prova, situacao } = lista[0];
  const prefs = preferenciasPlano(estado);
  const disciplina = nomeDaDisciplina(estado, prova.disciplina_id);
  const cabecalhoProva = `
    <p class="plano-prova"><strong>${esc(prova.titulo)}</strong>${disciplina ? ` · ${esc(disciplina)}` : ''}</p>
    <p class="texto-suave">${esc(maiuscula(quandoEhAProva(prova, agora)))}</p>`;

  let corpo;
  if (situacao === 'remarcar') {
    corpo = `
      ${cabecalhoProva}
      <p class="texto-suave">A data desta prova mudou. As sessões de revisão ainda estão marcadas pela data antiga.</p>
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="plano-remarcar" data-id="${esc(prova.id)}">Remarcar as sessões</button>
        <button class="botao botao-secundario" type="button" data-acao="plano-manter" data-id="${esc(prova.id)}">Manter como está</button>
      </div>`;
  } else {
    const sessoes = sugerirSessoes(prova, prefs, agora);
    corpo = `
      ${cabecalhoProva}
      <p class="texto-suave">${sessoes.length === 1 ? 'Sugestão: 1 sessão' : `Sugestão: ${sessoes.length} sessões`} de ${prefs.minutos} min, às ${esc(horaBonita(prefs.hora))}:</p>
      <ul class="plano-dias">${sessoes.map((s) => `<li class="chip urg-semana">${esc(diaCurto(s.dia))}</li>`).join('')}</ul>
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="plano-criar" data-id="${esc(prova.id)}" ${sessoes.length ? '' : 'disabled'}>Criar o plano</button>
        <button class="botao botao-secundario" type="button" data-acao="plano-ajustar" data-id="${esc(prova.id)}">Ajustar</button>
        <button class="botao botao-secundario" type="button" data-acao="plano-dispensar" data-id="${esc(prova.id)}">Agora não</button>
      </div>`;
  }
  const mais = lista.length - 1;
  return `
    <section class="card plano ${classes}" aria-labelledby="plano-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="plano-titulo">Plano para a prova</h2>
        ${mais > 0 ? `<span class="selo">+${mais} ${mais === 1 ? 'prova' : 'provas'}</span>` : ''}
      </div>
      ${corpo}
    </section>`;
}


// Folha "Ajustar": escolher os dias, o horário e a duração das sessões.
export function renderFolhaPlano(estado, prova, agora = Date.now()) {
  const prefs = preferenciasPlano(estado);
  const sugeridos = new Set(sugerirSessoes(prova, prefs, agora).map((s) => s.dia));
  const dias = diasPossiveis(prova, agora);
  const hoje = chaveDia(new Date(agora));
  return `
    <form class="formulario" data-form="plano" data-id="${esc(prova.id)}" novalidate>
      <p class="texto-suave"><strong>${esc(prova.titulo)}</strong> · ${esc(quandoEhAProva(prova, agora))}</p>
      <fieldset class="grupo-marcar">
        <legend class="campo-rotulo">Dias de revisão</legend>
        ${dias.length ? dias.map((d) => `
          <label class="campo-marcar">
            <input type="checkbox" name="dia" value="${d}"${sugeridos.has(d) ? ' checked' : ''}>
            <span>${esc(maiuscula(fmtDiaLongo.format(dataDaChave(d))))}${d === hoje ? ' (hoje)' : ''}</span>
          </label>`).join('') : '<p class="texto-suave">A prova é amanhã: não sobra dia antes dela.</p>'}
      </fieldset>
      <div class="cal-form-linha">
        <label class="campo">
          <span class="campo-rotulo">Horário</span>
          <input name="hora" type="time" value="${esc(prefs.hora)}" required>
        </label>
        <label class="campo">
          <span class="campo-rotulo">Duração</span>
          <select name="minutos">${OPCOES_MINUTOS.map((m) => `<option value="${m}"${m === prefs.minutos ? ' selected' : ''}>${m} min</option>`).join('')}</select>
        </label>
      </div>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Criar as sessões</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}
