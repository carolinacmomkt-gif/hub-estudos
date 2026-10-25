// Tela Cadernos: estantes (por disciplina e por tema), pastas, favoritos, busca e lixeira,
// e o formulário de caderno novo / editar caderno.
// O editor de cada caderno (#cadernos/<id>) fica em editor-caderno.js.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { esc, haQuantoTempo } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina } from './dados-faculdade.js';
import { TAMANHOS_PAPEL, opcoesDeModelo } from './folhas.js';
import { renderEditorCaderno } from './editor-caderno.js';
import { areasAtivas } from './dados-estudos.js';
import { artigosAtivos } from './dados-biblioteca.js';
import { modelosProprios } from './fundos.js';
import {
  TIPOS_CADERNO, ESTILOS_CAPA, CORES_CAPA, nomeDoTipo, cadernosAtivos, pastasAtivas, subpastas, caminhoDaPasta,
  textoDeBusca, estantes, capaDe,
} from './dados-cadernos.js';

const VISOES = [
  { id: 'estantes', nome: 'Estantes' },
  { id: 'pastas', nome: 'Pastas' },
  { id: 'favoritos', nome: 'Favoritos' },
  { id: 'lixeira', nome: 'Lixeira' },
];

const opcoes = (lista, atual) => lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(atual ?? '') ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');

export function capaHtml(c, { disciplina = '' } = {}) {
  const { cor, estilo } = capaDe(c);
  return `
    <div class="caderno-capa capa-${cor} capa-estilo-${estilo}">
      <span class="caderno-capa-titulo">${esc(c.titulo)}</span>
      ${disciplina ? `<span class="caderno-capa-disciplina">${esc(disciplina)}</span>` : ''}
    </div>`;
}

function cartao(estado, c, agora) {
  const disciplina = nomeDaDisciplina(estado, c.disciplina_id);
  return `
    <li data-busca="${esc(textoDeBusca(estado, c))}">
      <a class="caderno" href="#cadernos/${esc(c.id)}">
        ${capaHtml(c, { disciplina })}
      </a>
      <div class="caderno-info caderno-info-acoes">
        <span>${esc(nomeDoTipo(c.tipo))} · ${esc(haQuantoTempo(new Date(c.atualizado_em).getTime(), agora))}</span>
        <span class="caderno-botoes">
          <button class="botao-icone botao-icone-p" type="button" data-acao="caderno-favorito" data-id="${esc(c.id)}" aria-pressed="${Boolean(c.favorito)}" aria-label="${c.favorito ? 'Tirar dos favoritos' : 'Favoritar'} ${esc(c.titulo)}">${c.favorito ? '★' : '☆'}</button>
          <button class="botao-icone botao-icone-p" type="button" data-acao="caderno-editar" data-id="${esc(c.id)}" aria-label="Editar ${esc(c.titulo)}">⋯</button>
        </span>
      </div>
    </li>`;
}

const grade = (estado, lista, agora) => `<ul class="cadernos cadernos-grade">${lista.map((c) => cartao(estado, c, agora)).join('')}</ul>`;

function visaoEstantes(estado, agora) {
  return estantes(estado).map((g) => `
    <section class="estante" data-estante>
      <h2 class="estante-titulo">${esc(g.nome)}${g.rotulo ? ` <span class="selo">${esc(g.rotulo)}</span>` : ''}</h2>
      ${grade(estado, g.itens, agora)}
    </section>`).join('');
}

function visaoPastas(estado, agora) {
  const atual = estado.cadPasta && pastasAtivas(estado).some((p) => p.id === estado.cadPasta) ? estado.cadPasta : null;
  const caminho = atual ? caminhoDaPasta(estado, atual) : [];
  const filhas = subpastas(estado, atual);
  const idsPastas = new Set(pastasAtivas(estado).map((p) => p.id));
  const cadernos = cadernosAtivos(estado).filter((c) => (atual ? c.pasta_id === atual : !c.pasta_id || !idsPastas.has(c.pasta_id)));
  return `
    <nav class="pasta-caminho" aria-label="Você está em">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-pasta-abrir" data-id="">Todas as pastas</button>
      ${caminho.map((p) => `<span aria-hidden="true">›</span><button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-pasta-abrir" data-id="${esc(p.id)}">${esc(p.nome)}</button>`).join('')}
    </nav>
    <div class="acoes">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-pasta-nova">+ ${atual ? 'Subpasta' : 'Pasta'}</button>
      ${atual ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-pasta-renomear" data-id="${esc(atual)}">Renomear</button>
        <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="caderno-pasta-excluir" data-id="${esc(atual)}">Excluir pasta</button>` : ''}
    </div>
    ${filhas.length ? `<ul class="pastas">${filhas.map((p) => `
      <li><button class="pasta" type="button" data-acao="caderno-pasta-abrir" data-id="${esc(p.id)}">
        ${icone('cadernos')}<span>${esc(p.nome)}</span>
        <small class="campo-ajuda">${cadernosAtivos(estado).filter((c) => c.pasta_id === p.id).length} cadernos</small>
      </button></li>`).join('')}</ul>` : ''}
    ${cadernos.length ? grade(estado, cadernos, agora) : `<p class="texto-suave">${atual ? 'Nenhum caderno nesta pasta. Para pôr um caderno aqui, toque em ⋯ no caderno e escolha a pasta.' : 'Cadernos fora de pastas aparecem aqui.'}</p>`}`;
}

function visaoFavoritos(estado, agora) {
  const lista = cadernosAtivos(estado).filter((c) => c.favorito);
  return lista.length ? grade(estado, lista, agora) : '<p class="texto-suave">Toque na ☆ de um caderno para ele aparecer aqui.</p>';
}

function visaoLixeira(estado, agora) {
  const lista = estado.cadLixeira;
  if (!lista) return '<p class="texto-suave">Abrindo a lixeira…</p>';
  if (!lista.length) return '<p class="texto-suave">A lixeira está vazia.</p>';
  return `
    <p class="campo-ajuda">Cadernos excluídos ficam aqui até você restaurar ou apagar de vez.</p>
    <ul class="lista-simples">${lista.map((c) => `
      <li><span><strong>${esc(c.titulo)}</strong> <small class="campo-ajuda">· excluído ${esc(haQuantoTempo(new Date(c.excluido_em).getTime(), agora))}</small></span>
        <span class="caderno-botoes">
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-restaurar" data-id="${esc(c.id)}">Restaurar</button>
          <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="caderno-apagar" data-id="${esc(c.id)}">Apagar de vez</button>
        </span></li>`).join('')}</ul>`;
}

export function renderCadernos(estado) {
  if (estado.parametro) return renderEditorCaderno(estado);
  const agora = Date.now();
  const total = cadernosAtivos(estado).length;
  const visao = VISOES.some((v) => v.id === estado.cadVisao) ? estado.cadVisao : 'estantes';
  if (!total && visao !== 'lixeira') {
    return `
      ${cabecalho('Cadernos', 'Escrita à mão com a S Pen')}
      <section class="card vazio">
        <div class="vazio-icone">${icone('cadernos')}</div>
        <h2>Seu primeiro caderno</h2>
        <p class="texto-suave">Caderno comum, por matéria, fichário, de PDF, quadro infinito ou planner, com capa e folha do seu jeito.</p>
        <button class="botao botao-primario" type="button" data-acao="caderno-novo">Criar caderno</button>
      </section>
      <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="caderno-visao" data-valor="lixeira">Ver a lixeira</button></div>`;
  }
  const corpo = { estantes: visaoEstantes, pastas: visaoPastas, favoritos: visaoFavoritos, lixeira: visaoLixeira }[visao](estado, agora);
  return `
    ${cabecalho('Cadernos', 'Escrita à mão com a S Pen')}
    <div class="acoes cal-acoes"><button class="botao botao-primario" type="button" data-acao="caderno-novo">Novo caderno</button></div>
    <div class="filtros">
      <label class="campo"><span class="campo-rotulo">Buscar</span>
        <input type="search" id="caderno-busca" data-filtrar-cadernos placeholder="Título, tag, disciplina ou tema" value="${esc(estado.cadBusca || '')}"></label>
    </div>
    <div class="segmentado cad-visoes" role="tablist" aria-label="Organização">${VISOES.map((v) => `
      <button type="button" role="tab" data-acao="caderno-visao" data-valor="${v.id}" aria-selected="${visao === v.id}" aria-pressed="${visao === v.id}">${v.nome}</button>`).join('')}
    </div>
    <div class="cad-corpo">${corpo}</div>
    <p class="texto-suave" data-cadernos-vazio hidden>Nenhum caderno com essa busca.</p>`;
}

// ---------------------------------------------------------------------------
// Formulários (folha de baixo)
// ---------------------------------------------------------------------------

function seletorCapa(capa) {
  return `
    <fieldset class="grupo-marcar grupo-marcar-linha">
      <legend class="campo-rotulo">Cor da capa</legend>
      ${CORES_CAPA.map((n) => `
        <label class="capa-opcao">
          <input type="radio" name="capa" value="${n}"${n === capa.cor ? ' checked' : ''}>
          <span class="capa-amostra capa-${n}" aria-hidden="true"></span>
          <span class="visualmente-oculto">Cor ${n}</span>
        </label>`).join('')}
    </fieldset>
    <fieldset class="grupo-marcar grupo-marcar-linha">
      <legend class="campo-rotulo">Estilo da capa</legend>
      ${ESTILOS_CAPA.map((e) => `
        <label class="capa-opcao">
          <input type="radio" name="estilo" value="${e.id}"${e.id === capa.estilo ? ' checked' : ''}>
          <span class="capa-amostra capa-${capa.cor} capa-estilo-${e.id}" aria-hidden="true"></span>
          <span class="capa-opcao-nome">${esc(e.nome)}</span>
        </label>`).join('')}
    </fieldset>`;
}

function ligacoes(estado, c = {}) {
  const disciplinas = disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
  const areas = areasAtivas(estado).map((a) => ({ id: a.id, nome: a.nome }));
  const pastas = pastasAtivas(estado).map((p) => ({ id: p.id, nome: caminhoDaPasta(estado, p.id).map((x) => x.nome).join(' › ') }));
  return `
    <div class="cal-form-linha">
      <label class="campo"><span class="campo-rotulo">Disciplina <small>(opcional)</small></span>
        <select name="disciplina"><option value="">Nenhuma</option>${opcoes(disciplinas, c.disciplina_id || '')}</select></label>
      ${areas.length ? `<label class="campo"><span class="campo-rotulo">Trilha ou tema <small>(opcional)</small></span>
        <select name="area"><option value="">Nenhum</option>${opcoes(areas, c.area_id || '')}</select></label>` : ''}
    </div>
    ${pastas.length ? `<label class="campo"><span class="campo-rotulo">Pasta</span>
      <select name="pasta"><option value="">Fora de pastas</option>${opcoes(pastas, c.pasta_id || '')}</select></label>` : ''}
    <label class="campo"><span class="campo-rotulo">Tags <small>(separe por vírgula)</small></span>
      <input name="tags" type="text" maxlength="300" value="${esc((c.tags || []).join(', '))}"></label>`;
}

export function renderFormCaderno(estado, { area = '', tipo = 'comum' } = {}) {
  const pdfsDaBiblioteca = artigosAtivos(estado).filter((a) => a.pdf_path).map((a) => ({ id: a.id, nome: a.titulo }));
  const hoje = new Date();
  const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const extra = {
    materia: `<label class="campo"><span class="campo-rotulo">Divisórias <small>(uma por linha)</small></span>
      <textarea name="secoes" rows="4" maxlength="2000">Matéria 1\nMatéria 2\nMatéria 3</textarea></label>`,
    pdf: `
      <label class="campo"><span class="campo-rotulo">PDF do aparelho</span>
        <input name="pdf" type="file" accept="application/pdf,.pdf"></label>
      ${pdfsDaBiblioteca.length ? `<label class="campo"><span class="campo-rotulo">…ou um PDF da Biblioteca</span>
        <select name="artigo"><option value="">Nenhum</option>${opcoes(pdfsDaBiblioteca, '')}</select></label>` : ''}
      <p class="campo-ajuda">Cada página do PDF vira uma página do caderno, para escrever por cima. Até 200 páginas.</p>`,
    planner: `
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Tipo</span>
          <select name="periodo"><option value="semana">Semanal</option><option value="mes">Mensal</option></select></label>
        <label class="campo"><span class="campo-rotulo">Começa em</span>
          <input name="inicio" type="date" value="${chaveHoje}"></label>
        <label class="campo"><span class="campo-rotulo">Quantas páginas</span>
          <input name="quantidade" type="number" min="1" max="60" value="8" inputmode="numeric"></label>
      </div>`,
  }[tipo] || '';
  const semTamanho = tipo === 'pdf' || tipo === 'infinito';
  return `
    <form class="formulario" data-form="caderno-novo" data-tipo="${esc(tipo)}" novalidate>
      <label class="campo"><span class="campo-rotulo">Tipo</span>
        <select name="tipo" data-caderno-tipo>${opcoes(TIPOS_CADERNO, tipo)}</select>
        <span class="campo-ajuda">${esc(TIPOS_CADERNO.find((t) => t.id === tipo)?.descricao || '')}</span></label>
      <label class="campo"><span class="campo-rotulo">Título</span>
        <input name="titulo" type="text" maxlength="80" required placeholder="Ex.: Estatística: anotações de aula"></label>
      ${extra}
      ${semTamanho ? '' : `<div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Tamanho</span>
          <select name="tamanho">${opcoes(Object.entries(TAMANHOS_PAPEL).map(([id, t]) => ({ id, nome: t.nome })), 'A4')}</select></label>
        <label class="campo"><span class="campo-rotulo">Orientação</span>
          <select name="orientacao">${opcoes([{ id: 'retrato', nome: 'Em pé (retrato)' }, { id: 'paisagem', nome: 'Deitado (paisagem)' }], 'retrato')}</select></label>
      </div>`}
      ${tipo === 'planner' || tipo === 'pdf' ? '' : `<label class="campo"><span class="campo-rotulo">Folha</span>
        <select name="modelo">${opcoesDeModelo(tipo === 'infinito' ? 'pontilhada' : 'pautada-media', modelosProprios(estado))}</select>
        <span class="campo-ajuda">Dá para trocar a folha de cada página depois.</span></label>`}
      ${ligacoes(estado, { area_id: area })}
      ${seletorCapa({ cor: 1, estilo: 'lisa' })}
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Criar e abrir</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

export function renderFormEditarCaderno(estado, c) {
  return `
    <form class="formulario" data-form="caderno-editar" data-id="${esc(c.id)}" novalidate>
      <div class="caderno-previa">${capaHtml(c, { disciplina: nomeDaDisciplina(estado, c.disciplina_id) })}</div>
      <label class="campo"><span class="campo-rotulo">Título</span>
        <input name="titulo" type="text" maxlength="80" required value="${esc(c.titulo)}"></label>
      <p class="campo-ajuda">${esc(nomeDoTipo(c.tipo))}${c.tipo === 'pdf' || c.tipo === 'infinito' ? '' : ` · ${esc(TAMANHOS_PAPEL[c.tamanho]?.nome || 'A4')}${c.orientacao === 'paisagem' ? ', paisagem' : ''}`}</p>
      ${ligacoes(estado, c)}
      ${seletorCapa(capaDe(c))}
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
        <button class="botao botao-secundario botao-perigo" type="button" data-acao="caderno-excluir" data-id="${esc(c.id)}">Mandar para a lixeira</button>
      </div>
    </form>`;
}

export function renderFormPasta(pasta = null) {
  return `
    <form class="formulario" data-form="caderno-pasta" data-id="${esc(pasta?.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Nome da pasta</span>
        <input name="nome" type="text" maxlength="80" required value="${esc(pasta?.nome || '')}"></label>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}
