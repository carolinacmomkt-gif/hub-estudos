// Tela Sessão de foco (#foco) e o card do Início.

import { cabecalho } from './componentes.js';
import { esc, diaEHora } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina } from './dados-faculdade.js';
import { areasAtivas, nomeDaArea } from './dados-estudos.js';
import { semanaDe, textoMinutos } from './dados-resumo.js';
import { situacaoFoco, relogioTexto, prefsFoco, sessoesDoPeriodo, OPCOES_FOCO } from './foco.js';

const opcoes = (lista, atual) => lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(atual ?? '') ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
const fuso = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

function hojeEsemana(estado, agora = Date.now()) {
  const meia = new Date(agora);
  meia.setHours(0, 0, 0, 0);
  const hoje = sessoesDoPeriodo(estado, meia.getTime(), meia.getTime() + 864e5);
  const semana = semanaDe(agora, fuso());
  const daSemana = sessoesDoPeriodo(estado, semana.inicio, semana.fim);
  const soma = (l) => l.reduce((t, s) => t + (Number(s.minutos) || 0), 0);
  return { hoje, minHoje: soma(hoje), minSemana: soma(daSemana) };
}

function relogioGrande(s, p) {
  const aguardando = s.fase === 'aguardando';
  return `
    <section class="card foco-relogio fase-${esc(s.fase)}" aria-live="polite">
      <p class="proximo-rotulo">${esc(s.nomeFase)}${s.fase === 'foco' ? ` · ${s.ciclo} de ${s.ciclos}` : ''}${s.pausado ? ' · pausado' : ''}</p>
      ${aguardando ? '<p class="foco-tempo">✓</p>' : `<p class="foco-tempo" data-foco-relogio>${relogioTexto(s.restante)}</p>`}
      <div class="progresso-trilho foco-trilho" aria-hidden="true"><div class="progresso-barra" data-foco-progresso style="width: ${s.total ? Math.round(((s.total - s.restante) / s.total) * 100) : 0}%"></div></div>
      <p class="foco-titulo">${esc(s.titulo)}</p>
      <div class="acoes foco-acoes">
        ${aguardando
          ? '<button class="botao botao-primario" type="button" data-acao="foco-proximo">Começar o próximo foco</button>'
          : `<button class="botao botao-primario" type="button" data-acao="${s.pausado ? 'foco-retomar' : 'foco-pausar'}">${s.pausado ? 'Retomar' : 'Pausar'}</button>
             <button class="botao botao-secundario" type="button" data-acao="foco-pular">${s.fase === 'foco' ? 'Terminar este foco' : 'Pular a pausa'}</button>`}
        <button class="botao botao-secundario botao-perigo" type="button" data-acao="foco-encerrar">Encerrar sessão</button>
      </div>
      ${s.fase === 'foco' ? '' : `<p class="campo-ajuda">Próximo foco: ${p.foco} min.</p>`}
    </section>`;
}

function formInicio(estado, p) {
  const pre = estado.focoPreset || {};
  const disciplinas = disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
  const areas = areasAtivas(estado).map((a) => ({ id: a.id, nome: a.nome }));
  return `
    <section class="card">
      <form class="formulario" data-form="foco-iniciar" novalidate>
        <label class="campo"><span class="campo-rotulo">O que você vai estudar?</span>
          <input name="titulo" type="text" maxlength="140" value="${esc(pre.titulo || '')}" placeholder="Ex.: Revisar Estatística, capítulo 3"></label>
        <div class="cal-form-linha">
          ${disciplinas.length ? `<label class="campo"><span class="campo-rotulo">Disciplina <small>(opcional)</small></span>
            <select name="disciplina"><option value="">Nenhuma</option>${opcoes(disciplinas, pre.disciplina || '')}</select></label>` : ''}
          ${areas.length ? `<label class="campo"><span class="campo-rotulo">Trilha ou tema <small>(opcional)</small></span>
            <select name="area"><option value="">Nenhum</option>${opcoes(areas, pre.area || '')}</select></label>` : ''}
        </div>
        <fieldset class="grupo-marcar grupo-marcar-linha">
          <legend class="campo-rotulo">Duração do foco</legend>
          ${OPCOES_FOCO.map((m) => `<label class="campo-marcar"><input type="radio" name="minutos" value="${m}"${m === p.foco ? ' checked' : ''}><span>${m} min</span></label>`).join('')}
        </fieldset>
        <div class="acoes"><button class="botao botao-primario" type="submit">Começar</button></div>
        <p class="campo-ajuda">Com o app aberto, toca um som e o celular vibra no fim de cada fase. Com o app fechado, o tempo continua certo e você vê ao voltar.</p>
      </form>
    </section>`;
}

function formPrefs(p) {
  return `
    <details class="card">
      <summary><strong>Ajustes do foco</strong></summary>
      <form class="formulario" data-form="foco-prefs" novalidate>
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Pausa curta (min)</span><input name="pausa" type="number" min="1" max="60" value="${p.pausa}" inputmode="numeric"></label>
          <label class="campo"><span class="campo-rotulo">Pausa longa (min)</span><input name="longa" type="number" min="1" max="90" value="${p.longa}" inputmode="numeric"></label>
          <label class="campo"><span class="campo-rotulo">Pausa longa a cada</span><input name="ciclos" type="number" min="2" max="12" value="${p.ciclos}" inputmode="numeric"></label>
        </div>
        <label class="campo-marcar"><input type="checkbox" name="som"${p.som ? ' checked' : ''}><span>Tocar um som no fim de cada fase</span></label>
        <label class="campo-marcar"><input type="checkbox" name="seguir"${p.seguir ? ' checked' : ''}><span>Começar a pausa sozinha quando o foco acabar</span></label>
      </form>
    </details>`;
}

export function renderFoco(estado) {
  const s = situacaoFoco();
  const p = prefsFoco(estado);
  const { hoje, minHoje, minSemana } = hojeEsemana(estado);
  return `
    ${cabecalho('Sessão de foco', 'Foco e pausas no seu ritmo')}
    ${s.ativa ? relogioGrande(s, p) : formInicio(estado, p)}
    <section class="card">
      <div class="card-topo"><h2 class="card-titulo">Hoje: ${esc(textoMinutos(minHoje))} de foco</h2>
        <a class="card-link" href="#resumo">Semana: ${esc(textoMinutos(minSemana))}</a></div>
      ${hoje.length ? `<ul class="lista-simples">${hoje.map((x) => `
        <li><span>${esc(x.titulo || 'Estudo')}${x.disciplina_id || x.area_id ? ` <small class="campo-ajuda">· ${esc(nomeDaDisciplina(estado, x.disciplina_id) || nomeDaArea(estado, x.area_id))}</small>` : ''}</span>
          <span class="campo-ajuda">${esc(diaEHora(new Date(x.inicio)).split(' · ')[1] || '')} · ${esc(textoMinutos(x.minutos))}${x.concluida ? '' : ' (parcial)'}</span></li>`).join('')}</ul>`
        : '<p class="texto-suave">Nenhum foco hoje ainda.</p>'}
    </section>
    ${formPrefs(p)}`;
}

export function cardFocoInicio(estado) {
  const s = situacaoFoco();
  const { minHoje, minSemana } = hojeEsemana(estado);
  return `
    <section class="card" aria-labelledby="foco-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="foco-titulo">Sessão de foco</h2>
        <a class="card-link" href="#foco">Abrir</a>
      </div>
      ${s.ativa
        ? `<p class="revisao-total"><strong data-foco-relogio>${s.fase === 'aguardando' ? '✓' : relogioTexto(s.restante)}</strong><span class="texto-suave">${esc(s.nomeFase)} · ${esc(s.titulo)}</span></p>`
        : `<p class="revisao-total"><strong>${esc(textoMinutos(minHoje))}</strong><span class="texto-suave">hoje · ${esc(textoMinutos(minSemana))} na semana</span></p>
           <button class="botao botao-secundario" type="button" data-acao="foco-iniciar">Começar ${prefsFoco(estado).foco} min</button>`}
    </section>`;
}
