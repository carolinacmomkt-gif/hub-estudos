// Tela Questões: painel com revisões do dia e banco (#questoes), gerador com IA
// (#questoes/gerar) e simulados nos modos prova, fixação e revisão (#questoes/<id do simulado>).

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { esc, haQuantoTempo, numeroNota } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina } from './dados-faculdade.js';
import { areasAtivas, nomeDaArea } from './dados-estudos.js';
import { artigosAtivos } from './dados-biblioteca.js';
import { opcoes } from './views-youtube.js';
import { trabalhosDoTipo } from './trabalhos-ia.js';
import {
  NIVEIS, TIPOS_QUESTAO, MODOS, LETRAS, nomeNivel, nomeTipo, questaoPeloId, revisoesDoDia, proximasRevisoes,
  filtrarQuestoes, tagsDasQuestoes, resumoDoBanco, simuladosFeitos, taxaDeAcerto, textoDaResposta, revisaoDaQuestao, INTERVALOS,
} from './dados-questoes.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const VISOES = [
  { id: 'banco', nome: 'Banco' },
  { id: 'simulados', nome: 'Simulados feitos' },
  { id: 'agenda', nome: 'Agenda de revisão' },
];
const SITUACOES = [
  { id: '', nome: 'Todas' },
  { id: 'erradas', nome: 'Que já errei' },
  { id: 'novas', nome: 'Nunca respondidas' },
  { id: 'revisao', nome: 'Em revisão' },
];

const listaDisciplinas = (estado) => disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
const listaAreas = (estado) => areasAtivas(estado).map((a) => ({ id: a.id, nome: a.nome }));

function ligacoes(estado, q) {
  return [nomeDaDisciplina(estado, q.disciplina_id), nomeDaArea(estado, q.area_id)].filter(Boolean);
}

function fontesHtml(fontes) {
  const lista = (fontes || []).filter((f) => /^https?:\/\//i.test(f.url));
  if (!lista.length) return '';
  return `<p class="q-fontes"><strong>Fontes:</strong> ${lista.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo || f.url)}</a>`).join(' · ')}</p>`;
}

// Enunciado, alternativas com a certa marcada e o gabarito comentado.
// oculto: mostra só as alternativas, sem marcar a certa; o gabarito fica num "Ver gabarito" fechado
// (para a revisão das questões novas e o banco não entregarem a resposta antes da hora).
export function gabaritoHtml(q, { resposta, oculto = false } = {}) {
  const alternativas = q.tipo === 'multipla' ? `<ol class="q-alternativas q-gabarito">${(q.alternativas || []).map((alt, i) => {
    const letra = LETRAS[i];
    const certa = !oculto && letra === q.resposta_correta;
    const marcada = resposta !== undefined && letra === resposta;
    return `<li class="${certa ? 'certa' : ''}${marcada && !certa ? ' errada' : ''}"><span class="q-letra">${letra}</span> ${esc(alt)}${certa ? ' <span class="visualmente-oculto">(correta)</span>' : ''}</li>`;
  }).join('')}</ol>` : '';
  const certaMultipla = q.tipo === 'multipla' && oculto
    ? `<p><strong>Resposta:</strong> ${esc(q.resposta_correta)}) ${esc(q.alternativas?.[LETRAS.indexOf(q.resposta_correta)] || '')}</p>` : '';
  const certa = q.tipo === 'vf' ? `<p><strong>Resposta:</strong> ${q.resposta_correta === 'V' ? 'Verdadeiro' : 'Falso'}</p>`
    : q.tipo === 'dissertativa' ? `<p><strong>Resposta esperada:</strong> ${esc(q.resposta_correta)}</p>` : certaMultipla;
  const comentario = `${certa}${q.explicacao ? `<p class="q-explicacao"><strong>Por quê:</strong> ${esc(q.explicacao)}</p>` : ''}${fontesHtml(q.fontes)}`;
  if (oculto) return `${alternativas}<details class="q-ver-gabarito"><summary>Ver gabarito</summary>${comentario}</details>`;
  return `${alternativas}${comentario}`;
}

function itemDoBanco(estado, q) {
  const taxa = taxaDeAcerto(q);
  const rev = revisaoDaQuestao(estado, q.id);
  const meta = [nomeTipo(q.tipo), nomeNivel(q.nivel), ...ligacoes(estado, q)];
  return `
    <li class="q-item" data-busca="${esc(`${q.enunciado} ${(q.tags || []).join(' ')}`.toLowerCase())}">
      <details>
        <summary>
          <span class="q-item-enunciado">${esc(q.enunciado)}</span>
          <span class="q-item-meta">${esc(meta.join(' · '))}${taxa !== null ? ` · <strong>${Math.round(taxa * 100)}%</strong> de acerto (${Number(q.acertos) || 0}/${(Number(q.acertos) || 0) + (Number(q.erros) || 0)})` : ' · nunca respondida'}${rev ? ` · <span class="chip">revisar ${esc(fmtDia.format(new Date(`${String(rev.proxima_em).slice(0, 10)}T12:00`)))}</span>` : ''}</span>
        </summary>
        <div class="q-item-corpo">
          ${gabaritoHtml(q, { oculto: true })}
          ${(q.tags || []).length ? `<p>${q.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join(' ')}</p>` : ''}
          <div class="acoes">
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-editar" data-id="${esc(q.id)}">Editar</button>
            ${rev ? '' : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-revisar-amanha" data-id="${esc(q.id)}">Revisar amanhã</button>`}
            <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="q-excluir" data-id="${esc(q.id)}">Excluir</button>
          </div>
        </div>
      </details>
    </li>`;
}

function visaoBanco(estado) {
  const f = estado.qFiltros || {};
  const lista = filtrarQuestoes(estado, { ...f, busca: '' });
  const tags = tagsDasQuestoes(estado);
  const disciplinas = listaDisciplinas(estado);
  const areas = listaAreas(estado);
  return `
    <div class="filtros">
      <label class="campo"><span class="campo-rotulo">Buscar</span>
        <input type="search" id="q-busca" data-filtrar-lista="q-lista" placeholder="Enunciado ou tag" value="${esc(f.busca || '')}"></label>
      <label class="campo campo-curto"><span class="campo-rotulo">Situação</span>
        <select data-acao-mudar="q-filtro" data-campo="situacao">${opcoes(SITUACOES, f.situacao)}</select></label>
      ${disciplinas.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Disciplina</span>
        <select data-acao-mudar="q-filtro" data-campo="disciplina">${opcoes([{ id: '', nome: 'Todas' }, ...disciplinas], f.disciplina)}</select></label>` : ''}
      ${areas.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Trilha ou tema</span>
        <select data-acao-mudar="q-filtro" data-campo="area">${opcoes([{ id: '', nome: 'Todos' }, ...areas], f.area)}</select></label>` : ''}
      <label class="campo campo-curto"><span class="campo-rotulo">Tipo</span>
        <select data-acao-mudar="q-filtro" data-campo="tipo">${opcoes([{ id: '', nome: 'Todos' }, ...TIPOS_QUESTAO], f.tipo)}</select></label>
      <label class="campo campo-curto"><span class="campo-rotulo">Nível</span>
        <select data-acao-mudar="q-filtro" data-campo="nivel">${opcoes([{ id: '', nome: 'Todos' }, ...NIVEIS], f.nivel)}</select></label>
      ${tags.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Tag</span>
        <select data-acao-mudar="q-filtro" data-campo="tag">${opcoes([{ id: '', nome: 'Todas' }, ...tags.map((t) => ({ id: t, nome: `#${t}` }))], f.tag)}</select></label>` : ''}
    </div>
    <div class="acoes">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-simulado-novo" data-filtrado="1"${lista.length ? '' : ' disabled'}>Simulado com estas (${lista.length})</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-nova">Escrever uma questão</button>
    </div>
    ${lista.length ? `<ul class="q-lista" id="q-lista">${lista.map((q) => itemDoBanco(estado, q)).join('')}</ul>
      <p class="texto-suave" data-lista-vazia="q-lista" hidden>Nada com essa busca.</p>` : '<p class="texto-suave">Nenhuma questão com esses filtros.</p>'}`;
}

function visaoSimulados(estado) {
  const feitos = simuladosFeitos(estado);
  if (!feitos.length) return '<p class="texto-suave">Nenhum simulado ainda. Comece um pelo botão "Fazer simulado".</p>';
  return `<ul class="lista-simples q-simulados">${feitos.map((s) => {
    const nome = MODOS.find((m) => m.id === s.modo)?.nome || '';
    const quando = haQuantoTempo(new Date(s.iniciado_em || s.criado_em).getTime());
    return `
      <li><a href="#questoes/${esc(s.id)}">
        <span><strong>${esc(s.titulo)}</strong><small class="campo-ajuda"> · ${esc(nome)} · ${esc(quando)}</small></span>
        <span>${s.concluido_em ? `<strong>${numeroNota(Number(s.nota) || 0)}</strong>/10 · ${Number(s.acertos) || 0} de ${Number(s.total) || (s.questoes || []).length}` : '<span class="chip">Em andamento</span>'}</span>
      </a></li>`;
  }).join('')}</ul>`;
}

function visaoAgenda(estado) {
  const proximas = proximasRevisoes(estado);
  if (!proximas.length) return '<p class="texto-suave">Nenhuma revisão marcada para os próximos dias.</p>';
  const porDia = new Map();
  for (const r of proximas) {
    const dia = String(r.proxima_em).slice(0, 10);
    porDia.set(dia, (porDia.get(dia) || 0) + 1);
  }
  return `
    <p class="campo-ajuda">Cada questão errada volta em ${INTERVALOS.join(', ')} dias. Acertou na revisão, sobe de etapa; errou, recomeça.</p>
    <ul class="lista-simples">${[...porDia].map(([dia, n]) => `
      <li><span>${esc(fmtDia.format(new Date(`${dia}T12:00`)))}</span><strong>${n} ${n === 1 ? 'questão' : 'questões'}</strong></li>`).join('')}</ul>`;
}

function trabalhosEmAndamento() {
  const lista = trabalhosDoTipo('questoes');
  if (!lista.length) return '';
  return `
    <section class="card q-trabalhos">
      ${lista.map((t) => `
        <p><strong>${esc(t.rotulo || 'Questões')}</strong> ·
          ${t.status === 'pronto' ? '<span class="chip urg-semana">Prontas para revisar</span>' : t.status === 'erro' ? '<span class="chip urg-atrasado">Não deu certo</span>' : '<span class="chip">A IA está preparando…</span>'}
          <a class="card-link" href="#questoes/gerar">Ver</a></p>`).join('')}
    </section>`;
}

function painel(estado) {
  const r = resumoDoBanco(estado);
  const visao = VISOES.some((v) => v.id === estado.qVisao) ? estado.qVisao : 'banco';
  const corpo = { banco: visaoBanco, simulados: visaoSimulados, agenda: visaoAgenda }[visao](estado);
  if (!r.total) {
    return `
      ${cabecalho('Questões', 'Gerador com IA, banco, simulados e revisão espaçada')}
      ${trabalhosEmAndamento()}
      <section class="card vazio">
        <div class="vazio-icone">${icone('questoes')}</div>
        <h2>Gere as primeiras questões</h2>
        <p class="texto-suave">A partir de um tema, de uma leitura da Biblioteca, de um texto ou da foto de uma página. A IA pesquisa, escreve o gabarito comentado e cita as fontes.</p>
        <div class="acoes"><a class="botao botao-primario" href="#questoes/gerar">Gerar questões</a>
          <button class="botao botao-secundario" type="button" data-acao="q-nova">Escrever uma questão</button></div>
      </section>`;
  }
  return `
    ${cabecalho('Questões', 'Gerador com IA, banco, simulados e revisão espaçada')}
    <div class="acoes cal-acoes">
      <a class="botao botao-primario" href="#questoes/gerar">Gerar questões</a>
      <button class="botao botao-secundario" type="button" data-acao="q-simulado-novo">Fazer simulado</button>
    </div>
    ${trabalhosEmAndamento()}
    <div class="q-resumo">
      <section class="card q-revisar${r.hoje ? ' tem' : ''}">
        <p class="proximo-rotulo">Revisão de hoje</p>
        <p class="revisao-total"><strong>${r.hoje}</strong><span class="texto-suave">${r.hoje === 1 ? 'questão para refazer' : 'questões para refazer'}</span></p>
        ${r.hoje ? '<button class="botao botao-primario" type="button" data-acao="q-revisar">Revisar agora</button>' : '<p class="texto-suave">Nada para hoje. As erradas voltam sozinhas no dia certo.</p>'}
      </section>
      <section class="card">
        <p class="proximo-rotulo">Banco</p>
        <p class="revisao-total"><strong>${r.total}</strong><span class="texto-suave">${r.total === 1 ? 'questão' : 'questões'} · ${r.novas} nunca respondida${r.novas === 1 ? '' : 's'}</span></p>
        ${r.acerto !== null ? barraProgresso(r.acerto, 'Acerto geral') : ''}
        <p class="campo-ajuda">${r.acerto !== null ? 'Acerto geral nas respostas.' : 'Responda um simulado para ver seu acerto.'}</p>
      </section>
    </div>
    <div class="segmentado q-visoes" role="tablist" aria-label="Partes">${VISOES.map((v) => `
      <button type="button" role="tab" data-acao="q-visao" data-valor="${v.id}" aria-selected="${visao === v.id}" aria-pressed="${visao === v.id}">${v.nome}</button>`).join('')}
    </div>
    ${corpo}`;
}

// ---------------------------------------------------------------------------
// Gerador
// ---------------------------------------------------------------------------

const FONTES = [
  { id: 'tema', nome: 'Tema' },
  { id: 'artigo', nome: 'Leitura' },
  { id: 'imagem', nome: 'Foto ou página' },
  { id: 'texto', nome: 'Texto' },
];

function formGerar(estado) {
  const pre = estado.questoesPreset || {};
  const fonte = estado.qFonte || pre.fonte || 'tema';
  const artigos = artigosAtivos(estado).filter((a) => String(a.texto || '').trim()).map((a) => ({ id: a.id, nome: a.titulo }));
  const imagem = estado.questoesImagem;
  const modo = pre.modo || 'prova';
  const campo = {
    tema: `<label class="campo"><span class="campo-rotulo">Tema</span>
      <input name="tema" type="text" maxlength="500" required placeholder="Ex.: Teorias da comunicação de massa" value="${esc(pre.tema || '')}"></label>`,
    artigo: artigos.length ? `<label class="campo"><span class="campo-rotulo">Leitura da Biblioteca</span>
      <select name="artigo" required>${opcoes(artigos, pre.artigo)}</select></label>` : '<p class="texto-suave">Nenhuma leitura com texto na Biblioteca ainda. <a href="#biblioteca/novo">Adicionar leitura</a></p>',
    imagem: imagem ? `
      <figure class="q-imagem"><img src="${esc(imagem.url)}" alt="Página escolhida para gerar as questões"><figcaption>${esc(imagem.rotulo || 'Página do caderno')}</figcaption></figure>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-tirar-imagem">Trocar a imagem</button>` : `
      <label class="campo"><span class="campo-rotulo">Foto da página, slide ou print</span>
        <input name="imagem" type="file" accept="image/*" required></label>
      <p class="campo-ajuda">Dentro de um caderno, o botão "Gerar questões desta página" manda a página para cá.</p>`,
    texto: `<label class="campo"><span class="campo-rotulo">Texto</span>
      <textarea name="texto" rows="8" required placeholder="Cole aqui o conteúdo (resumo de aula, trecho de livro…)">${esc(pre.texto || '')}</textarea></label>`,
  }[fonte];
  return `
    <section class="card">
      <div class="segmentado q-fontes-escolha" role="group" aria-label="A partir de">${FONTES.map((x) => `
        <button type="button" data-acao="q-fonte" data-valor="${x.id}" aria-pressed="${fonte === x.id}">${x.nome}</button>`).join('')}
      </div>
      <form class="formulario" data-form="q-gerar" data-fonte="${fonte}" novalidate>
        ${campo}
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Quantas</span>
            <input name="quantidade" type="number" min="1" max="20" value="${Number(pre.quantidade) || 5}" inputmode="numeric"></label>
          <label class="campo"><span class="campo-rotulo">Nível</span>
            <select name="dificuldade">${opcoes(NIVEIS, pre.dificuldade || 'medio')}</select></label>
        </div>
        <fieldset class="campo">
          <legend class="campo-rotulo">Modo</legend>
          ${MODOS.filter((m) => m.id !== 'revisao').map((m) => `
            <label class="campo-marcar"><input type="radio" name="modo" value="${m.id}"${modo === m.id ? ' checked' : ''}><span><strong>${m.nome}</strong> · ${esc(m.descricao)}</span></label>`).join('')}
        </fieldset>
        <fieldset class="campo" data-so-prova>
          <legend class="campo-rotulo">Tipos (modo prova)</legend>
          <label class="campo-marcar"><input type="checkbox" name="tipos" value="multipla" checked><span>Múltipla escolha</span></label>
          <label class="campo-marcar"><input type="checkbox" name="tipos" value="vf"><span>Verdadeiro ou falso</span></label>
          <label class="campo campo-curto"><span class="campo-rotulo">Alternativas</span>
            <select name="alternativas"><option value="4">4 (A a D)</option><option value="5">5 (A a E)</option></select></label>
        </fieldset>
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Disciplina <small>(opcional)</small></span>
            <select name="disciplina">${opcoes([{ id: '', nome: 'Nenhuma' }, ...listaDisciplinas(estado)], pre.disciplina)}</select></label>
          <label class="campo"><span class="campo-rotulo">Trilha ou tema <small>(opcional)</small></span>
            <select name="area">${opcoes([{ id: '', nome: 'Nenhum' }, ...listaAreas(estado)], pre.area)}</select></label>
        </div>
        ${fonte === 'imagem' ? '' : `<label class="campo-marcar"><input type="checkbox" name="pesquisar"${fonte === 'tema' ? ' checked' : ''}><span>Pesquisar na web para conferir os fatos e citar as fontes${fonte === 'tema' ? '' : ' (o texto já é a fonte; marque para completar com a web)'}</span></label>`}
        <p class="ava-alerta" role="alert" data-erro hidden></p>
        <div class="acoes"><button class="botao botao-primario" type="submit">Gerar com a IA</button></div>
        <p class="campo-ajuda">Leva de 30 segundos a alguns minutos. Pode sair da tela: as questões ficam esperando aqui.</p>
      </form>
    </section>`;
}

function revisarGeradas(estado, t) {
  const qs = t.resultado?.questoes || [];
  const escolha = estado.qEscolha?.[t.id] || {};
  return `
    <section class="card">
      <div class="card-topo">
        <h2 class="card-titulo">${qs.length} ${qs.length === 1 ? 'questão pronta' : 'questões prontas'}: ${esc(t.rotulo || '')}</h2>
      </div>
      <p class="campo-ajuda">Desmarque as que não quiser guardar. O gabarito fica escondido para não estragar o simulado; toque em "Ver gabarito" só se quiser conferir.</p>
      <form class="formulario" data-form="q-salvar-geradas" data-id="${esc(t.id)}" novalidate>
        <ol class="q-previa">${qs.map((q, i) => `
          <li class="q-previa-item">
            <label class="campo-marcar"><input type="checkbox" name="incluir" value="${i}"${escolha[i] === false ? '' : ' checked'}><span><strong>${esc(nomeTipo(q.tipo))} · ${esc(nomeNivel(q.nivel))}</strong></span></label>
            <p class="q-enunciado">${esc(q.enunciado)}</p>
            ${gabaritoHtml(q, { oculto: true })}
          </li>`).join('')}</ol>
        <label class="campo"><span class="campo-rotulo">Tags para todas <small>(separe por vírgula)</small></span>
          <input name="tags" type="text" maxlength="300" value="${esc((t.ligado?.tags || []).join(', '))}"></label>
        <div class="acoes">
          <button class="botao botao-primario" type="submit" name="depois" value="fazer">Salvar e fazer agora</button>
          <button class="botao botao-secundario" type="submit" name="depois" value="banco">Só salvar no banco</button>
          <button class="botao botao-secundario botao-perigo" type="button" data-acao="q-descartar" data-id="${esc(t.id)}">Descartar</button>
        </div>
      </form>
    </section>`;
}

function telaGerar(estado) {
  const trabalhos = trabalhosDoTipo('questoes');
  const ultimo = trabalhos[trabalhos.length - 1];
  let situacao = '';
  if (ultimo?.status === 'pronto') situacao = revisarGeradas(estado, ultimo);
  else if (ultimo?.status === 'erro') {
    situacao = `<div class="ava-alerta" role="alert"><strong>Não deu certo:</strong> ${esc(ultimo.erro || 'tente de novo.')}
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-descartar" data-id="${esc(ultimo.id)}">Fechar</button></div>`;
  } else if (ultimo) {
    situacao = `<section class="card q-carregando" aria-live="polite"><span class="girando" aria-hidden="true"></span>
      <p><strong>A IA está preparando: ${esc(ultimo.rotulo || 'questões')}</strong><br><span class="texto-suave">Pesquisando, escrevendo e conferindo o gabarito. Pode sair da tela.</span></p></section>`;
  }
  return `
    ${cabecalho('Gerar questões', 'Com gabarito comentado e fontes')}
    <div class="acoes cal-acoes"><a class="botao botao-secundario botao-pequeno" href="#questoes">← Questões</a></div>
    ${situacao}
    ${ultimo?.status === 'pronto' ? '' : formGerar(estado)}`;
}

// ---------------------------------------------------------------------------
// Simulado
// ---------------------------------------------------------------------------

function perguntaDoSimulado(estado, s, q, indice, total) {
  const r = s.respostas?.[q.id] || {};
  const revelar = s.modo !== 'prova' && r.respondida;
  const corrigindo = estado.qCorrigindo === q.id;
  let corpo;
  if (q.tipo === 'multipla') {
    corpo = `<ol class="q-alternativas q-escolha" role="radiogroup" aria-label="Alternativas">${(q.alternativas || []).map((alt, i) => {
      const letra = LETRAS[i];
      const marcada = r.resposta === letra;
      const classe = revelar ? (letra === q.resposta_correta ? ' certa' : marcada ? ' errada' : '') : '';
      return `<li><button type="button" class="q-alternativa${marcada ? ' marcada' : ''}${classe}" role="radio" aria-checked="${marcada}" data-acao="q-responder" data-valor="${letra}"${revelar ? ' disabled' : ''}>
        <span class="q-letra">${letra}</span><span>${esc(alt)}</span></button></li>`;
    }).join('')}</ol>`;
  } else if (q.tipo === 'vf') {
    corpo = `<div class="q-vf" role="radiogroup" aria-label="Verdadeiro ou falso">${[['V', 'Verdadeiro'], ['F', 'Falso']].map(([v, nome]) => {
      const marcada = r.resposta === v;
      const classe = revelar ? (v === q.resposta_correta ? ' certa' : marcada ? ' errada' : '') : '';
      return `<button type="button" class="q-alternativa${marcada ? ' marcada' : ''}${classe}" role="radio" aria-checked="${marcada}" data-acao="q-responder" data-valor="${v}"${revelar ? ' disabled' : ''}>${nome}</button>`;
    }).join('')}</div>`;
  } else {
    corpo = revelar ? `<blockquote class="q-sua-resposta">${esc(r.resposta)}</blockquote>` : `
      <form class="formulario" data-form="q-dissertativa" data-id="${esc(q.id)}" novalidate>
        <label class="campo"><span class="campo-rotulo">Sua resposta</span>
          <textarea name="resposta" rows="6" maxlength="4000" required placeholder="Escreva com as suas palavras.">${esc(estado.qRascunho?.[q.id] || '')}</textarea></label>
        <p class="ava-alerta" role="alert" data-erro hidden></p>
        <div class="acoes">
          <button class="botao botao-primario" type="submit" name="como" value="ia"${corrigindo ? ' disabled' : ''}>${corrigindo ? 'Corrigindo…' : 'Corrigir com a IA'}</button>
          <button class="botao botao-secundario" type="submit" name="como" value="eu"${corrigindo ? ' disabled' : ''}>Ver a resposta e eu mesma avalio</button>
        </div>
      </form>`;
  }
  let retorno = '';
  if (revelar) {
    const nota = q.tipo === 'dissertativa' && r.nota !== undefined && r.nota !== null ? ` · nota <strong>${numeroNota(Number(r.nota))}</strong>/10` : '';
    retorno = `
      <div class="q-retorno ${r.correta ? 'acertou' : 'errou'}" role="status">
        <p class="q-retorno-titulo">${r.correta ? 'Acertou!' : r.autoavaliar ? 'Compare com a resposta esperada' : 'Não foi dessa vez'}${nota}</p>
        ${r.comentario ? `<p>${esc(r.comentario)}</p>` : ''}
        ${gabaritoHtml(q, { resposta: r.resposta })}
        ${r.autoavaliar ? `<div class="acoes">
          <button class="botao botao-primario botao-pequeno" type="button" data-acao="q-autoavaliar" data-valor="1">Acertei</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="q-autoavaliar" data-valor="0">Errei</button></div>` : ''}
      </div>`;
  }
  const respondidas = (s.questoes || []).filter((id) => s.respostas?.[id]?.respondida || (s.modo === 'prova' && s.respostas?.[id]?.resposta)).length;
  const ultima = indice >= total - 1;
  const podeSeguir = s.modo === 'prova' || (r.respondida && !r.autoavaliar);
  return `
    <div class="q-progresso">${barraProgresso(respondidas / total, 'Questões respondidas')}<span class="campo-ajuda">Questão ${indice + 1} de ${total}</span></div>
    <section class="card q-pergunta">
      <p class="q-item-meta">${esc([nomeTipo(q.tipo), nomeNivel(q.nivel), ...ligacoes(estado, q)].join(' · '))}</p>
      <h2 class="q-enunciado">${esc(q.enunciado)}</h2>
      ${corpo}
      ${retorno}
    </section>
    <div class="acoes q-navegar">
      <button class="botao botao-secundario" type="button" data-acao="q-ir" data-passo="-1"${indice === 0 ? ' disabled' : ''}>‹ Anterior</button>
      ${ultima
        ? `<button class="botao botao-primario" type="button" data-acao="q-terminar"${podeSeguir ? '' : ' disabled'}>${s.modo === 'prova' ? 'Terminar e ver a nota' : 'Terminar'}</button>`
        : `<button class="botao ${podeSeguir ? 'botao-primario' : 'botao-secundario'}" type="button" data-acao="q-ir" data-passo="1">Próxima ›</button>`}
    </div>
    ${s.modo === 'prova' ? `<nav class="q-mapa" aria-label="Ir para a questão">${(s.questoes || []).map((id, i) => `
      <button type="button" class="q-mapa-num${s.respostas?.[id]?.resposta ? ' feita' : ''}${i === indice ? ' atual' : ''}" data-acao="q-ir-para" data-valor="${i}" aria-label="Questão ${i + 1}${s.respostas?.[id]?.resposta ? ', respondida' : ''}">${i + 1}</button>`).join('')}</nav>` : ''}`;
}

function resultado(estado, s, questoes) {
  const nota = Number(s.nota) || 0;
  return `
    <section class="card q-nota">
      <p class="proximo-rotulo">Resultado</p>
      <p class="q-nota-valor"><strong>${numeroNota(nota)}</strong><small>/10</small></p>
      <p class="texto-suave">${Number(s.acertos) || 0} de ${questoes.length} ${questoes.length === 1 ? 'certa' : 'certas'}. ${nota >= 7 ? 'Mandou bem!' : 'As erradas entram na revisão de amanhã.'}</p>
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="q-refazer-erradas"${Number(s.acertos) === questoes.length ? ' disabled' : ''}>Refazer as erradas</button>
        <a class="botao botao-secundario" href="#questoes">Voltar para Questões</a>
      </div>
    </section>
    <ol class="q-correcao">${questoes.map((q) => {
      const r = s.respostas?.[q.id] || {};
      return `
      <li class="card q-correcao-item ${r.correta ? 'acertou' : 'errou'}">
        <p class="q-item-meta">${r.correta ? '✓ Certa' : '✗ Errada'}${q.tipo === 'dissertativa' && r.nota !== undefined ? ` · nota ${numeroNota(Number(r.nota) || 0)}` : ''}</p>
        <p class="q-enunciado">${esc(q.enunciado)}</p>
        ${q.tipo !== 'multipla' ? `<p><strong>Sua resposta:</strong> ${esc(textoDaResposta(q, r.resposta))}</p>` : ''}
        ${r.comentario ? `<p>${esc(r.comentario)}</p>` : ''}
        ${gabaritoHtml(q, { resposta: r.resposta })}
      </li>`;
    }).join('')}</ol>`;
}

function telaSimulado(estado, id) {
  const s = (estado.simulados || []).find((x) => x.id === id && !x.excluido_em);
  if (!s) {
    return `${cabecalho('Simulado')}<section class="card"><p class="texto-suave">Este simulado não foi encontrado.</p>
      <a class="botao botao-secundario" href="#questoes">Voltar para Questões</a></section>`;
  }
  const questoes = (s.questoes || []).map((qid) => questaoPeloId(estado, qid)).filter(Boolean);
  const modo = MODOS.find((m) => m.id === s.modo)?.nome || '';
  const topo = `${cabecalho(s.titulo, esc(`Modo ${modo.toLowerCase()} · ${questoes.length} ${questoes.length === 1 ? 'questão' : 'questões'}`))}
    <div class="acoes cal-acoes"><a class="botao botao-secundario botao-pequeno" href="#questoes">← Questões</a>
    ${s.concluido_em ? '' : '<button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="q-abandonar">Desistir deste simulado</button>'}</div>`;
  if (!questoes.length) return `${topo}<p class="texto-suave">As questões deste simulado foram excluídas.</p>`;
  if (s.concluido_em) return `${topo}${resultado(estado, s, questoes)}`;
  const primeiraAberta = questoes.findIndex((q) => !(s.respostas?.[q.id]?.respondida || (s.modo === 'prova' && s.respostas?.[q.id]?.resposta)));
  const indice = Number.isInteger(estado.qIndice?.[s.id]) ? Math.min(estado.qIndice[s.id], questoes.length - 1) : Math.max(0, primeiraAberta);
  return `${topo}${perguntaDoSimulado(estado, s, questoes[indice], indice, questoes.length)}`;
}

export function renderQuestoes(estado) {
  if (estado.parametro === 'gerar') return telaGerar(estado);
  if (estado.parametro) return telaSimulado(estado, estado.parametro);
  return painel(estado);
}

// ---------------------------------------------------------------------------
// Folhas (formulários no painel de baixo)
// ---------------------------------------------------------------------------

export function renderFormSimulado(estado, { filtros = null } = {}) {
  const f = filtros || {};
  const temRevisao = revisoesDoDia(estado).length;
  return `
    <form class="formulario" data-form="q-simulado" data-filtrado="${filtros ? '1' : ''}" novalidate>
      <fieldset class="campo">
        <legend class="campo-rotulo">Modo</legend>
        ${MODOS.map((m) => `<label class="campo-marcar"><input type="radio" name="modo" value="${m.id}"${m.id === 'prova' ? ' checked' : ''}${m.id === 'revisao' && !temRevisao ? ' disabled' : ''}><span><strong>${m.nome}</strong> · ${esc(m.descricao)}${m.id === 'revisao' ? ` (${temRevisao} hoje)` : ''}</span></label>`).join('')}
      </fieldset>
      <label class="campo campo-curto"><span class="campo-rotulo">Quantas questões</span>
        <input name="quantidade" type="number" min="1" max="50" value="10" inputmode="numeric"></label>
      ${filtros ? '<p class="campo-ajuda">Usa as questões filtradas no banco.</p>' : `
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Disciplina</span>
          <select name="disciplina">${opcoes([{ id: '', nome: 'Todas' }, ...listaDisciplinas(estado)], f.disciplina)}</select></label>
        <label class="campo"><span class="campo-rotulo">Trilha ou tema</span>
          <select name="area">${opcoes([{ id: '', nome: 'Todos' }, ...listaAreas(estado)], f.area)}</select></label>
      </div>
      <label class="campo campo-curto"><span class="campo-rotulo">Quais</span>
        <select name="situacao">${opcoes(SITUACOES.filter((x) => x.id !== 'revisao'), '')}</select></label>`}
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Começar</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

export function renderFormQuestao(estado, q = null) {
  const tipo = q?.tipo || 'multipla';
  return `
    <form class="formulario" data-form="q-editar" data-id="${esc(q?.id || '')}" novalidate>
      <label class="campo campo-curto"><span class="campo-rotulo">Tipo</span>
        <select name="tipo">${opcoes(TIPOS_QUESTAO, tipo)}</select></label>
      <label class="campo"><span class="campo-rotulo">Enunciado</span>
        <textarea name="enunciado" rows="3" maxlength="2000" required>${esc(q?.enunciado || '')}</textarea></label>
      <label class="campo"><span class="campo-rotulo">Alternativas <small>(múltipla escolha: uma por linha, na ordem A, B, C…)</small></span>
        <textarea name="alternativas" rows="5" maxlength="3000">${esc((q?.alternativas || []).join('\n'))}</textarea></label>
      <label class="campo"><span class="campo-rotulo">Resposta certa <small>(letra, V ou F, ou a resposta esperada)</small></span>
        <input name="resposta" type="text" maxlength="1500" required value="${esc(q?.resposta_correta || '')}"></label>
      <label class="campo"><span class="campo-rotulo">Explicação</span>
        <textarea name="explicacao" rows="3" maxlength="3000">${esc(q?.explicacao || '')}</textarea></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Nível</span><select name="nivel">${opcoes(NIVEIS, q?.nivel || 'medio')}</select></label>
        <label class="campo"><span class="campo-rotulo">Tags</span><input name="tags" type="text" maxlength="300" value="${esc((q?.tags || []).join(', '))}"></label>
      </div>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Disciplina</span>
          <select name="disciplina">${opcoes([{ id: '', nome: 'Nenhuma' }, ...listaDisciplinas(estado)], q?.disciplina_id || '')}</select></label>
        <label class="campo"><span class="campo-rotulo">Trilha ou tema</span>
          <select name="area">${opcoes([{ id: '', nome: 'Nenhum' }, ...listaAreas(estado)], q?.area_id || '')}</select></label>
      </div>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

