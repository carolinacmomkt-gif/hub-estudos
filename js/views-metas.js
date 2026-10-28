// Tela Metas e lazer (#metas, #metas/lista, #metas/lazer): quadro dos sonhos, metas com
// progresso e ritmo, a lista de lazer, a frase do dia e a trilha do Spotify. E os cards do Hoje.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import {
  AREAS_VIDA, TIPOS_LAZER, STATUS_LAZER, ativas, realizadas, progressoDaMeta, ritmoDaMeta, ideiasDoFimDeSemana, sonhoDoDia, spotifyEmbed,
} from './dados-metas.js';
import { fraseDoDia } from './frases.js';
import { trilhaAberta } from './trilha.js';
import { caixinhas } from './dados-financas.js';
import { ativos as habitosAtivos } from './dados-habitos.js';

export const ABAS_METAS = [
  { id: 'quadro', nome: 'Quadro dos sonhos' },
  { id: 'lista', nome: 'Metas' },
  { id: 'lazer', nome: 'Lazer' },
];
export const JEITOS_QUADRO = [
  { id: 'livre', nome: 'Mural' },
  { id: 'areas', nome: 'Por área' },
  { id: 'ano', nome: 'Por ano' },
];
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const area = (id) => AREAS_VIDA.find((a) => a.id === id);
const tipoLazer = (id) => TIPOS_LAZER.find((t) => t.id === id) || TIPOS_LAZER.at(-1);
const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

export function dadosDasMetas(estado) {
  return {
    financas: estado.financas, habitos: estado.habitos, habitoRegistros: estado.habitoRegistros,
    projetos: estado.projetos, tarefas: estado.tarefas, lazer: estado.lazer,
  };
}

export function prefsMetas(estado) {
  const v = (estado.config || []).find((c) => c.chave === 'metas' && !c.excluido_em)?.valor || {};
  return { spotify: v.spotify || '', jeito: JEITOS_QUADRO.some((j) => j.id === v.jeito) ? v.jeito : 'livre' };
}

function cardFrase() {
  const f = fraseDoDia();
  return `
    <section class="card meta-frase" aria-label="Frase do dia">
      <p class="proximo-rotulo">Frase do dia</p>
      <blockquote><p>“${esc(f.texto)}”</p><footer>${esc(f.autor)}${f.obra ? `, <cite>${esc(f.obra)}</cite>` : ''}</footer></blockquote>
    </section>`;
}

function cardSpotify(prefs) {
  const src = spotifyEmbed(prefs.spotify);
  if (!src) {
    return `
      <details class="card meta-trilha">
        <summary>🎵 Colocar uma trilha do Spotify</summary>
        <form class="formulario" data-form="metas-spotify" novalidate>
          <label class="campo"><span class="campo-rotulo">Link da playlist, álbum ou música</span>
            <input name="link" type="url" inputmode="url" placeholder="https://open.spotify.com/playlist/…" value="${esc(prefs.spotify)}"></label>
          <p class="campo-ajuda">No Spotify: ⋯ → Compartilhar → Copiar link. Toca inteira se você estiver logada no Spotify neste navegador; sem login, toca um trecho.</p>
          <p class="ava-alerta" role="alert" data-erro hidden></p>
          <button class="botao botao-primario botao-pequeno" type="submit">Salvar a trilha</button>
        </form>
      </details>`;
  }
  const tocando = trilhaAberta();
  return `
    <section class="card meta-trilha">
      <div class="card-topo"><h2 class="card-titulo">🎵 Trilha</h2><button class="card-link" type="button" data-acao="metas-spotify-trocar">Trocar</button></div>
      <p class="campo-ajuda">${tocando ? 'Abrimos o player no canto da tela: a música continua enquanto você usa o app.' : 'O player fica no canto da tela e continua tocando em qualquer área do app.'}</p>
      <button class="botao botao-primario" type="button" data-acao="metas-tocar">${tocando ? 'Mostrar o player' : '▶ Tocar a trilha'}</button>
    </section>`;
}

// Um sonho no mural: foto (ou cor), nome, área e a barrinha de progresso.
function tileSonho(m, dados) {
  const p = progressoDaMeta(m, dados);
  const a = area(m.area);
  const feita = m.status === 'realizada';
  return `
    <li class="sonho tam-${esc(m.dados?.tamanho || 'm')} cor-${esc(m.dados?.cor || 1)}${feita ? ' realizado' : ''}">
      <button class="sonho-botao" type="button" data-acao="meta-abrir" data-id="${esc(m.id)}" aria-label="${esc(m.titulo)}">
        ${m.dados?.imagem ? `<img data-thumb="${esc(m.dados.imagem)}" alt="" loading="lazy">` : `<span class="sonho-sem-foto" aria-hidden="true">${a?.emoji || '✨'}</span>`}
        <span class="sonho-texto">
          ${feita ? '<span class="sonho-selo">✦ Realizado</span>' : a ? `<span class="sonho-area">${a.emoji} ${esc(a.nome)}</span>` : ''}
          <strong>${esc(m.titulo)}</strong>
          ${p && !feita ? `<span class="sonho-barra" aria-hidden="true"><i style="width: ${Math.round(p.fracao * 100)}%"></i></span>` : ''}
        </span>
      </button>
    </li>`;
}

function abaQuadro(estado, prefs) {
  const dados = dadosDasMetas(estado);
  const lista = ativas(estado.metas);
  const feitos = realizadas(estado.metas);
  let mural;
  if (!lista.length) {
    mural = `<section class="card meta-vazio"><p class="texto-suave">Seu quadro está esperando os primeiros sonhos. Uma viagem, um curso, um lugar para morar, a consultoria crescendo: coloque uma foto e ele ganha vida.</p>
      <button class="botao botao-primario" type="button" data-acao="meta-nova">Colocar o primeiro sonho</button></section>`;
  } else if (prefs.jeito === 'areas') {
    mural = AREAS_VIDA.map((a) => ({ a, itens: lista.filter((m) => m.area === a.id) })).concat([{ a: { nome: 'Sem área', emoji: '✨' }, itens: lista.filter((m) => !area(m.area)) }])
      .filter((g) => g.itens.length).map((g) => `<h2 class="card-titulo quadro-grupo">${g.a.emoji} ${esc(g.a.nome)}</h2><ul class="quadro">${g.itens.map((m) => tileSonho(m, dados)).join('')}</ul>`).join('');
  } else if (prefs.jeito === 'ano') {
    const anos = [...new Set(lista.map((m) => (m.prazo ? m.prazo.slice(0, 4) : 'Algum dia')))].sort();
    mural = anos.map((ano) => `<h2 class="card-titulo quadro-grupo">${ano === 'Algum dia' ? '🌙 Algum dia' : `Meu ${ano}`}</h2>
      <ul class="quadro">${lista.filter((m) => (m.prazo ? m.prazo.slice(0, 4) : 'Algum dia') === ano).map((m) => tileSonho(m, dados)).join('')}</ul>`).join('');
  } else mural = `<ul class="quadro">${lista.map((m) => tileSonho(m, dados)).join('')}</ul>`;
  return `
    <div class="acoes">
      <button class="botao botao-primario" type="button" data-acao="meta-nova">Novo sonho ou meta</button>
      <div class="segmentado" role="group" aria-label="Jeito do quadro">${JEITOS_QUADRO.map((j) => `<button type="button" data-acao="metas-jeito" data-valor="${j.id}" aria-pressed="${prefs.jeito === j.id}">${esc(j.nome)}</button>`).join('')}</div>
    </div>
    ${mural}
    ${feitos.length ? `<h2 class="card-titulo quadro-grupo">✦ Realizados</h2><ul class="quadro realizados">${feitos.map((m) => tileSonho(m, dados)).join('')}</ul>` : ''}`;
}

function linhaMeta(m, dados) {
  const p = progressoDaMeta(m, dados);
  const r = ritmoDaMeta(m, p);
  const a = area(m.area);
  return `
    <li><section class="card meta-linha">
      <button class="meta-linha-corpo" type="button" data-acao="meta-abrir" data-id="${esc(m.id)}">
        <span class="meta-linha-topo"><strong>${a ? `${a.emoji} ` : ''}${esc(m.titulo)}</strong>${m.prazo ? `<small class="campo-ajuda">até ${esc(fmtData.format(new Date(`${m.prazo}T12:00:00`)).replace('.', ''))}</small>` : ''}</span>
        ${p ? barraProgresso(p.fracao, `Progresso de ${m.titulo}`) : '<small class="campo-ajuda">Sonho no quadro, sem número para acompanhar.</small>'}
        ${p ? `<small class="campo-ajuda">${esc(p.texto || textoAtual(m, p))}</small>` : ''}
        ${r ? `<small class="meta-ritmo ritmo-${r.estado}">${esc(r.texto)}</small>` : ''}
      </button>
    </section></li>`;
}

function textoAtual(m, p) {
  const tipo = m.dados?.ligacao?.tipo;
  if (tipo === 'caixinha') return `${dinheiro(p.atual)} de ${dinheiro(p.alvo)}`;
  if (tipo === 'habito') return `${p.atual} de ${p.alvo} dias feitos`;
  if (tipo === 'lazer') return `${p.atual} de ${p.alvo} feitos`;
  return `${p.atual} de ${p.alvo}${m.unidade ? ` ${m.unidade}` : ''}`;
}

function abaLista(estado) {
  const dados = dadosDasMetas(estado);
  const lista = ativas(estado.metas).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  const pausadas = vivos(estado.metas).filter((m) => m.status === 'pausada');
  return `
    <div class="acoes"><button class="botao botao-primario" type="button" data-acao="meta-nova">Nova meta</button></div>
    ${lista.length ? `<ul class="metas">${lista.map((m) => linhaMeta(m, dados)).join('')}</ul>`
      : '<p class="texto-suave tarefa-vazio">Ligue uma meta a uma caixinha, a um hábito, a um projeto ou aos livros lidos, e o progresso anda sozinho.</p>'}
    ${pausadas.length ? `<details class="card"><summary>Pausadas (${pausadas.length})</summary><ul class="metas">${pausadas.map((m) => linhaMeta(m, dados)).join('')}</ul></details>` : ''}`;
}

function itemLazer(l) {
  const t = tipoLazer(l.tipo);
  return `
    <li class="lazer-item status-${esc(l.status)}">
      <span class="lazer-emoji" aria-hidden="true">${t.emoji}</span>
      <button class="lazer-corpo" type="button" data-acao="lazer-editar" data-id="${esc(l.id)}">
        <strong>${esc(l.titulo)}</strong>
        <small class="campo-ajuda">${esc(t.nome)}${l.dados?.custo ? ` · ${dinheiro(l.dados.custo)}` : ''}${l.status === 'feito' && l.nota ? ` · ${'★'.repeat(l.nota)}` : ''}</small>
      </button>
      ${l.status === 'quero' ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="lazer-status" data-id="${esc(l.id)}" data-valor="fazendo" data-comecar>Começar</button>` : ''}
      ${l.status !== 'feito' ? `<button class="botao botao-primario botao-pequeno" type="button" data-acao="lazer-status" data-id="${esc(l.id)}" data-valor="feito">Feito</button>` : ''}
    </li>`;
}

function abaLazer(estado) {
  const filtro = estado.filtroLazer || '';
  const status = estado.statusLazer || 'quero';
  const lista = vivos(estado.lazer).filter((l) => (!filtro || l.tipo === filtro) && l.status === status)
    .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
  return `
    <form class="tarefa-rapida" data-form="lazer-rapido" novalidate>
      <label class="visualmente-oculto" for="lazer-rapido">Adicionar ao lazer</label>
      <input id="lazer-rapido" name="texto" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder='Ex.: "filme Duna 2", "lugar Pirenópolis 300", "café Santo Grão"'>
      <button class="botao botao-primario" type="submit" aria-label="Adicionar">+</button>
    </form>
    <div class="acoes">
      <button class="botao botao-secundario" type="button" data-acao="lazer-sortear">🎲 Sortear algo para fazer</button>
    </div>
    <nav class="segmentado" aria-label="Situação">${STATUS_LAZER.map((s) => `<button type="button" data-acao="lazer-ver" data-valor="${s.id}" aria-pressed="${status === s.id}">${esc(s.nome)} <small>${vivos(estado.lazer).filter((l) => l.status === s.id).length}</small></button>`).join('')}</nav>
    <div class="tarefa-filtros" role="group" aria-label="Tipo">
      ${[{ id: '', nome: 'Tudo', emoji: '' }, ...TIPOS_LAZER].map((t) => `<button class="chip-filtro" type="button" data-acao="lazer-filtro" data-valor="${t.id}" aria-pressed="${filtro === t.id}">${t.emoji ? `${t.emoji} ` : ''}${esc(t.nome)}</button>`).join('')}
    </div>
    <section class="card">${lista.length ? `<ul class="lazer">${lista.map(itemLazer).join('')}</ul>`
      : `<p class="texto-suave">${status === 'quero' ? 'Filmes, livros, cafés para conhecer, passeios em Goiânia e Brasília: anote aqui o que quer viver.' : 'Nada por aqui ainda.'}</p>`}</section>`;
}

export function renderMetas(estado) {
  const prefs = prefsMetas(estado);
  const aba = ABAS_METAS.some((a) => a.id === estado.parametro) ? estado.parametro : 'quadro';
  const n = ativas(estado.metas).length;
  const r = realizadas(estado.metas).length;
  let corpo;
  if (aba === 'lista') corpo = abaLista(estado);
  else if (aba === 'lazer') corpo = abaLazer(estado);
  else corpo = abaQuadro(estado, prefs);
  return `
    ${cabecalho('Metas e lazer', esc(n ? `${n} ${n === 1 ? 'sonho em andamento' : 'sonhos em andamento'}${r ? ` · ${r} ${r === 1 ? 'realizado' : 'realizados'}` : ''}` : 'Seus sonhos, suas metas e o que você quer viver'))}
    ${aba === 'quadro' ? `<div class="metas-topo">${cardFrase()}${cardSpotify(prefs)}</div>` : ''}
    <nav class="segmentado tarefa-abas" aria-label="Partes">
      ${ABAS_METAS.map((a) => `<a href="#metas/${a.id}" aria-current="${a.id === aba ? 'page' : 'false'}">${esc(a.nome)}</a>`).join('')}
    </nav>
    <div class="tarefa-visao">${corpo}</div>`;
}

// ---------------------------------------------------------------------------
// Formulários e detalhe
// ---------------------------------------------------------------------------

const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;

export function formMeta(m = {}, estado) {
  const lig = m.dados?.ligacao || { tipo: 'nenhuma' };
  const cx = caixinhas(estado.financas);
  const hab = habitosAtivos(estado.habitos);
  const proj = vivos(estado.projetos).filter((p) => p.status !== 'concluido');
  return `
    <form class="formulario" data-form="meta" data-id="${esc(m.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Sonho ou meta</span><input name="titulo" type="text" maxlength="80" required value="${esc(m.titulo || '')}" placeholder="Ex.: Viagem a Brasília em julho"></label>
      <div class="meta-foto">
        ${m.dados?.imagem ? `<img data-thumb="${esc(m.dados.imagem)}" alt="Foto do sonho">` : ''}
        <label class="botao botao-secundario botao-pequeno">${m.dados?.imagem ? 'Trocar a foto' : 'Colocar uma foto'}<input type="file" name="foto" accept="image/*" hidden data-acao-mudar="meta-foto"></label>
        <span class="campo-ajuda" data-foto-nome></span>
      </div>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Área da vida</span><select name="area">${opcao('', m.area, 'Sem área')}${AREAS_VIDA.map((a) => opcao(a.id, m.area, `${a.emoji} ${a.nome}`)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Até quando (opcional)</span><input name="prazo" type="date" value="${esc(m.prazo || '')}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Como acompanhar</span>
        <select name="ligacao" data-acao-mudar="meta-ligacao">
          ${opcao('nenhuma', lig.tipo, 'Só no quadro (sem número)')}
          ${cx.length ? opcao('caixinha', lig.tipo, 'Pelo dinheiro de uma caixinha') : ''}
          ${hab.length ? opcao('habito', lig.tipo, 'Pelos dias de um hábito') : ''}
          ${proj.length ? opcao('projeto', lig.tipo, 'Pelas tarefas de um projeto') : ''}
          ${opcao('lazer', lig.tipo, 'Pelo que eu fizer no Lazer (ex.: livros lidos)')}
          ${opcao('marcos', lig.tipo, 'Por etapas que eu marco')}
          ${opcao('manual', lig.tipo, 'Por um número que eu atualizo')}
        </select></label>
      <label class="campo" data-lig="caixinha"${lig.tipo === 'caixinha' ? '' : ' hidden'}><span class="campo-rotulo">Caixinha</span><select name="caixinha">${cx.map((c) => opcao(c.id, lig.id, c.descricao)).join('')}</select></label>
      <label class="campo" data-lig="habito"${lig.tipo === 'habito' ? '' : ' hidden'}><span class="campo-rotulo">Hábito</span><select name="habito">${hab.map((h) => opcao(h.id, lig.id, `${h.icone || ''} ${h.nome}`)).join('')}</select></label>
      <label class="campo" data-lig="projeto"${lig.tipo === 'projeto' ? '' : ' hidden'}><span class="campo-rotulo">Projeto</span><select name="projeto">${proj.map((p) => opcao(p.id, lig.id, p.titulo)).join('')}</select></label>
      <label class="campo" data-lig="lazer"${lig.tipo === 'lazer' ? '' : ' hidden'}><span class="campo-rotulo">Contar o quê</span><select name="lazerTipo">${opcao('', lig.lazerTipo, 'Tudo do lazer')}${TIPOS_LAZER.map((t) => opcao(t.id, lig.lazerTipo, `${t.emoji} ${t.nome}`)).join('')}</select></label>
      <div class="cal-form-linha" data-lig="alvo"${['habito', 'lazer', 'manual'].includes(lig.tipo) ? '' : ' hidden'}>
        <label class="campo"><span class="campo-rotulo">Quanto quer alcançar</span><input name="alvo" type="number" min="1" step="any" value="${esc(m.alvo || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Unidade (opcional)</span><input name="unidade" type="text" maxlength="20" value="${esc(m.unidade || '')}" placeholder="livros, km, clientes"></label>
      </div>
      <label class="campo" data-lig="marcos"${lig.tipo === 'marcos' ? '' : ' hidden'}><span class="campo-rotulo">Etapas (uma por linha)</span>
        <textarea name="marcos" rows="4" maxlength="2000">${esc((m.dados?.marcos || []).map((x) => x.texto).join('\n'))}</textarea></label>
      <fieldset class="campo"><legend class="campo-rotulo">Tamanho no quadro</legend>
        <div class="segmentado">${[['p', 'Pequeno'], ['m', 'Médio'], ['g', 'Grande']].map(([v, n]) => `<label class="segmentado-opcao"><input type="radio" name="tamanho" value="${v}"${(m.dados?.tamanho || 'm') === v ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>
      </fieldset>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${m.id ? 'Salvar' : 'Colocar no quadro'}</button>
        ${m.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="meta-excluir" data-id="${esc(m.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function detalheMeta(m, estado) {
  const dados = dadosDasMetas(estado);
  const p = progressoDaMeta(m, dados);
  const r = ritmoDaMeta(m, p);
  const a = area(m.area);
  const feita = m.status === 'realizada';
  return `
    <div class="meta-detalhe">
      ${m.dados?.imagem ? `<img class="meta-detalhe-foto" data-thumb="${esc(m.dados.imagem)}" alt="">` : ''}
      <p class="campo-ajuda">${a ? `${a.emoji} ${esc(a.nome)}` : ''}${m.prazo ? ` · até ${esc(fmtData.format(new Date(`${m.prazo}T12:00:00`)).replace('.', ''))}` : ''}</p>
      ${feita ? `<p class="sonho-selo grande">✦ Realizado em ${esc(fmtData.format(new Date(m.dados.realizada_em)).replace('.', ''))}</p>` : ''}
      ${p ? `${barraProgresso(p.fracao, 'Progresso')}<p class="campo-ajuda">${esc(p.texto || textoAtual(m, p))}</p>` : ''}
      ${r ? `<p class="meta-ritmo ritmo-${r.estado}">${esc(r.texto)}</p>` : ''}
      ${m.dados?.ligacao?.tipo === 'marcos' ? `<ul class="meta-marcos">${(m.dados.marcos || []).map((x, i) => `
        <li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="meta-marco" data-id="${esc(m.id)}" data-indice="${i}"${x.feito ? ' checked' : ''}><span>${esc(x.texto)}</span></label></li>`).join('')}</ul>` : ''}
      ${m.dados?.ligacao?.tipo === 'manual' ? `<form class="formulario meta-atualizar" data-form="meta-atual" data-id="${esc(m.id)}" novalidate>
        <label class="campo"><span class="campo-rotulo">Onde estou agora</span><input name="atual" type="number" step="any" value="${esc(m.atual || 0)}"></label>
        <button class="botao botao-secundario botao-pequeno" type="submit">Atualizar</button></form>` : ''}
      <div class="acoes">
        ${feita ? `<button class="botao botao-secundario" type="button" data-acao="meta-reabrir" data-id="${esc(m.id)}">Voltar para o quadro</button>`
          : `<button class="botao botao-primario" type="button" data-acao="meta-realizar" data-id="${esc(m.id)}">✦ Realizei!</button>`}
        <button class="botao botao-secundario" type="button" data-acao="meta-editar" data-id="${esc(m.id)}">Editar</button>
      </div>
    </div>`;
}

export function formLazer(l = {}) {
  return `
    <form class="formulario" data-form="lazer" data-id="${esc(l.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">O quê</span><input name="titulo" type="text" maxlength="120" required value="${esc(l.titulo || '')}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Tipo</span><select name="tipo">${TIPOS_LAZER.map((t) => opcao(t.id, l.tipo || 'outro', `${t.emoji} ${t.nome}`)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Situação</span><select name="status">${STATUS_LAZER.map((s) => opcao(s.id, l.status || 'quero', s.nome)).join('')}</select></label>
      </div>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Custo estimado (R$)</span><input name="custo" type="number" min="0" step="1" value="${esc(l.dados?.custo || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Nota (1 a 5)</span><input name="nota" type="number" min="1" max="5" value="${esc(l.nota || '')}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Notas (onde, com quem, link)</span><textarea name="notas" rows="2" maxlength="1000">${esc(l.dados?.notas || '')}</textarea></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${l.id ? 'Salvar' : 'Adicionar'}</button>
        ${l.id && l.dados?.custo ? `<button class="botao botao-secundario" type="button" data-acao="lazer-recompensa" data-id="${esc(l.id)}">Virar recompensa</button>` : ''}
        ${l.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="lazer-excluir" data-id="${esc(l.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Cards do Hoje
// ---------------------------------------------------------------------------

// Card do Hoje só com a frase do dia (troca todo dia).
export function cardFraseHoje() {
  const f = fraseDoDia();
  return `
    <section class="card frase-hoje" aria-label="Frase do dia">
      <p class="proximo-rotulo">Frase do dia</p>
      <blockquote class="frase-curta"><p>“${esc(f.texto)}”</p><footer>${esc(f.autor)}${f.obra ? `, <cite>${esc(f.obra)}</cite>` : ''}</footer></blockquote>
    </section>`;
}

// Card opcional (começa fora do Hoje): um sonho com foto por dia.
export function cardSonhoHoje(estado) {
  const m = sonhoDoDia(estado.metas);
  if (!m) return '';
  const p = progressoDaMeta(m, dadosDasMetas(estado));
  return `
    <section class="card sonho-hoje" aria-labelledby="sonho-hoje-titulo">
      <a class="sonho-hoje-foto" href="#metas"><img data-thumb="${esc(m.dados.imagem)}" alt=""></a>
      <div class="card-topo"><h2 class="card-titulo" id="sonho-hoje-titulo">${esc(m.titulo)}</h2><a class="card-link" href="#metas">Sonhos</a></div>
      ${p ? barraProgresso(p.fracao, `Progresso de ${m.titulo}`) : ''}
    </section>`;
}

export function cardFimDeSemanaHoje(estado) {
  const dia = new Date().getDay();
  if (![4, 5, 6, 0].includes(dia)) return ''; // de quinta a domingo
  const ideias = ideiasDoFimDeSemana(estado.lazer);
  if (!ideias.length) return '';
  return `
    <section class="card" aria-labelledby="fds-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="fds-titulo">Ideias para o fim de semana</h2><a class="card-link" href="#metas/lazer">Lazer</a></div>
      <ul class="lazer">${ideias.map((l) => `<li class="lazer-item"><span class="lazer-emoji" aria-hidden="true">${tipoLazer(l.tipo).emoji}</span>
        <span class="lazer-corpo"><strong>${esc(l.titulo)}</strong>${l.dados?.custo ? `<small class="campo-ajuda">${dinheiro(l.dados.custo)}</small>` : ''}</span></li>`).join('')}</ul>
    </section>`;
}
