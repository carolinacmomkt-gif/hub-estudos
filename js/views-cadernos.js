// Tela Cadernos: lista de cadernos e criação de um caderno novo.
// O editor de cada caderno (#cadernos/<id>) fica em editor-caderno.js.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { esc, haQuantoTempo } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina } from './dados-faculdade.js';
import { TAMANHOS_PAPEL, MODELOS_BASICOS } from './folhas.js';
import { renderEditorCaderno } from './editor-caderno.js';

export const CORES_CAPA = [1, 2, 3, 4, 5, 6];

export function renderCadernos(estado) {
  if (estado.parametro) return renderEditorCaderno(estado);
  const cadernos = (estado.cadernos || [])
    .filter((c) => !c.excluido_em)
    .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
  const agora = Date.now();

  const lista = cadernos.length ? `
    <ul class="cadernos cadernos-grade">${cadernos.map((c) => {
      const disciplina = nomeDaDisciplina(estado, c.disciplina_id);
      return `
      <li>
        <a class="caderno" href="#cadernos/${esc(c.id)}">
          <div class="caderno-capa capa-${Number(c.capa?.cor) || 1}">
            <span class="caderno-capa-titulo">${esc(c.titulo)}</span>
            ${disciplina ? `<span class="caderno-capa-disciplina">${esc(disciplina)}</span>` : ''}
          </div>
          <div class="caderno-info">
            <span>${esc(TAMANHOS_PAPEL[c.tamanho]?.nome || c.tamanho || 'A4')}${c.orientacao === 'paisagem' ? ' · paisagem' : ''}</span>
            <span>Editado ${esc(haQuantoTempo(new Date(c.atualizado_em).getTime(), agora))}</span>
          </div>
        </a>
      </li>`;
    }).join('')}</ul>` : `
    <section class="card vazio">
      <div class="vazio-icone">${icone('cadernos')}</div>
      <h2>Seu primeiro caderno</h2>
      <p class="texto-suave">Crie um caderno para escrever com a S Pen. Estantes, capas e mais modelos de folha chegam na próxima parte.</p>
      <button class="botao botao-primario" type="button" data-acao="caderno-novo">Criar caderno</button>
    </section>`;

  return `
    ${cabecalho('Cadernos', 'Escrita à mão com a S Pen')}
    ${cadernos.length ? '<div class="acoes cal-acoes"><button class="botao botao-primario" type="button" data-acao="caderno-novo">Novo caderno</button></div>' : ''}
    ${lista}`;
}

export function renderFormCaderno(estado) {
  const disciplinas = disciplinasAtivas(estado);
  const opcoes = (lista, atual) => lista.map((o) => `<option value="${esc(o.id)}"${o.id === atual ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
  return `
    <form class="formulario" data-form="caderno-novo" novalidate>
      <label class="campo"><span class="campo-rotulo">Título</span>
        <input name="titulo" type="text" maxlength="80" required placeholder="Ex.: Estatística — anotações de aula"></label>
      <label class="campo"><span class="campo-rotulo">Disciplina <small>(opcional)</small></span>
        <select name="disciplina"><option value="">Nenhuma</option>${opcoes(disciplinas.map((d) => ({ id: d.id, nome: d.nome })), '')}</select></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Tamanho</span>
          <select name="tamanho">${opcoes(Object.entries(TAMANHOS_PAPEL).map(([id, t]) => ({ id, nome: t.nome })), 'A4')}</select></label>
        <label class="campo"><span class="campo-rotulo">Orientação</span>
          <select name="orientacao">${opcoes([{ id: 'retrato', nome: 'Em pé (retrato)' }, { id: 'paisagem', nome: 'Deitado (paisagem)' }], 'retrato')}</select></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Folha</span>
        <select name="modelo">${opcoes(MODELOS_BASICOS, 'pautada-media')}</select>
        <span class="campo-ajuda">Dá para trocar a folha de cada página depois.</span></label>
      <fieldset class="grupo-marcar grupo-marcar-linha">
        <legend class="campo-rotulo">Cor da capa</legend>
        ${CORES_CAPA.map((n) => `
          <label class="capa-opcao">
            <input type="radio" name="capa" value="${n}"${n === 1 ? ' checked' : ''}>
            <span class="capa-amostra capa-${n}" aria-hidden="true"></span>
            <span class="visualmente-oculto">Cor ${n}</span>
          </label>`).join('')}
      </fieldset>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Criar e abrir</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}
