// Tela YouTube: painel do canal (funil por etapas, próximo vídeo, meta da semana)
// e a página de cada vídeo (#youtube/<id>) com ideia, roteiro, publicação, checklist e resultados.

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { esc, contagemRegressiva, urgencia } from './utilidades.js';
import {
  ETAPAS, FORMATOS, TIPOS_BLOCO, CHECKLIST, MODELOS_ROTEIRO, videosAtivos, videosDaEtapa, proximoAPublicar, metaDaSemana,
  progressoChecklist, palavrasDoRoteiro, duracaoEstimada, duracao, capitulos, contarPalavras,
} from './dados-youtube.js';

export const ABAS_VIDEO = [
  { id: 'ideia', nome: 'Ideia' },
  { id: 'roteiro', nome: 'Roteiro' },
  { id: 'publicacao', nome: 'Publicação' },
  { id: 'checklist', nome: 'Checklist' },
  { id: 'resultados', nome: 'Resultados' },
];
const NOME_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nome]));
const NOME_FORMATO = Object.fromEntries(FORMATOS.map((f) => [f.id, f.nome]));
const PRIORIDADES = [{ id: 1, nome: 'Alta' }, { id: 2, nome: 'Média' }, { id: 3, nome: 'Baixa' }];
const fmtData = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const LIMITE_TAGS = 500; // o YouTube aceita até 500 caracteres de tags

export function configYoutube(estado) {
  const v = (estado.config || []).find((c) => c.chave === 'youtube' && !c.excluido_em)?.valor || {};
  return { meta: Number(v.meta) > 0 ? Number(v.meta) : 1, visao: v.visao === 'lista' ? 'lista' : 'quadro' };
}

function opcoes(lista, atual) {
  return lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(atual) ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
}

function quandoPublica(v, agora) {
  if (!v.data_publicacao) return '';
  const t = new Date(v.data_publicacao).getTime();
  if (v.etapa === 'publicado') return esc(`Publicado ${fmtData.format(t).replace('.', '')}`);
  return `<span class="chip urg-${urgencia(t, agora)}">${esc(contagemRegressiva(t, agora))}</span>`;
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

function cartaoVideo(v, agora) {
  const prog = progressoChecklist(v);
  const i = ETAPAS.findIndex((e) => e.id === v.etapa);
  return `
    <li class="yt-cartao prioridade-${v.prioridade}">
      <a class="yt-cartao-link" href="#youtube/${esc(v.id)}">
        <span class="yt-cartao-titulo">${esc(v.titulo)}</span>
        <span class="yt-cartao-meta">${esc(NOME_FORMATO[v.formato] || '')}${v.serie ? ` · ${esc(v.serie)}` : ''}</span>
        ${v.data_publicacao ? `<span class="yt-cartao-meta">${quandoPublica(v, agora)}</span>` : ''}
        ${barraProgresso(prog.fracao, `Checklist de ${v.titulo}`)}
      </a>
      <div class="yt-cartao-acoes">
        <button class="botao-icone botao-icone-p" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="-1" aria-label="Voltar ${esc(v.titulo)} para ${esc(ETAPAS[Math.max(0, i - 1)].nome)}"${i <= 0 ? ' disabled' : ''}>‹</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="1" aria-label="Passar ${esc(v.titulo)} para ${esc(ETAPAS[Math.min(ETAPAS.length - 1, i + 1)].nome)}"${i >= ETAPAS.length - 1 ? ' disabled' : ''}>›</button>
      </div>
    </li>`;
}

function quadro(estado, agora) {
  return `
    <div class="yt-quadro" role="list" aria-label="Vídeos por etapa">${ETAPAS.map((e) => {
      const lista = videosDaEtapa(estado, e.id);
      return `
      <section class="yt-coluna" role="listitem" aria-labelledby="yt-col-${e.id}">
        <h2 class="yt-coluna-titulo" id="yt-col-${e.id}">${esc(e.nome)} <span class="selo">${lista.length}</span></h2>
        ${lista.length ? `<ul class="yt-cartoes">${lista.map((v) => cartaoVideo(v, agora)).join('')}</ul>` : '<p class="texto-suave yt-vazio">Nada aqui.</p>'}
        ${e.id === 'ideia' ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-novo">+ Ideia</button>' : ''}
      </section>`;
    }).join('')}</div>`;
}

function lista(estado, agora) {
  const videos = videosAtivos(estado).sort((a, b) => (a.data_publicacao || '9999').localeCompare(b.data_publicacao || '9999'));
  if (!videos.length) return '';
  return `
    <section class="card">
      <ul class="yt-lista">${videos.map((v) => `
        <li>
          <a class="yt-linha" href="#youtube/${esc(v.id)}">
            <span class="yt-cartao-titulo">${esc(v.titulo)}</span>
            <span class="selo">${esc(NOME_ETAPA[v.etapa])}</span>
            <span class="yt-cartao-meta">${esc(NOME_FORMATO[v.formato] || '')}</span>
            <span class="yt-cartao-meta">${v.data_publicacao ? quandoPublica(v, agora) : 'Sem data'}</span>
          </a>
        </li>`).join('')}</ul>
    </section>`;
}

function resumo(estado, agora) {
  const prox = proximoAPublicar(estado, agora);
  const cfg = configYoutube(estado);
  const meta = metaDaSemana(estado, cfg.meta, agora);
  const emProducao = videosAtivos(estado).filter((v) => !['ideia', 'publicado'].includes(v.etapa)).length;
  const ideias = videosAtivos(estado).filter((v) => v.etapa === 'ideia').length;
  return `
    <div class="painel yt-resumo">
      <section class="proximo bloco tam-2-3" aria-labelledby="yt-proximo">
        <div>
          <p class="proximo-rotulo">Próximo vídeo</p>
          <h2 class="proximo-titulo" id="yt-proximo">${prox ? esc(prox.titulo) : 'Nenhum vídeo com data marcada'}</h2>
          <p class="proximo-texto">${prox
            ? `${esc(NOME_ETAPA[prox.etapa])} · ${esc(contagemRegressiva(new Date(prox.data_publicacao).getTime(), agora))} para publicar`
            : `${emProducao} em produção e ${ideias} ${ideias === 1 ? 'ideia' : 'ideias'} esperando. Marque a data de publicação para o vídeo aparecer no Calendário.`}</p>
        </div>
        ${prox ? `<a class="botao" href="#youtube/${esc(prox.id)}">Abrir</a>` : '<button class="botao" type="button" data-acao="yt-novo">Nova ideia</button>'}
      </section>
      <section class="card bloco tam-1-3" aria-labelledby="yt-meta">
        <div class="card-topo"><h2 class="card-titulo" id="yt-meta">Meta da semana</h2></div>
        <p class="revisao-total"><strong>${meta.marcados}</strong><span class="texto-suave">de ${meta.meta} ${meta.meta === 1 ? 'vídeo marcado' : 'vídeos marcados'} para esta semana</span></p>
        ${barraProgresso(Math.min(1, meta.marcados / meta.meta), 'Meta de publicação da semana')}
        <label class="campo campo-curto"><span class="campo-rotulo">Vídeos por semana</span>
          <select data-acao-mudar="yt-meta">${opcoes([1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: n, nome: String(n) })), meta.meta)}</select></label>
      </section>
    </div>`;
}

function painel(estado) {
  const agora = Date.now();
  const cfg = configYoutube(estado);
  const vazio = !videosAtivos(estado).length;
  return `
    ${cabecalho('YouTube', 'Ideias, roteiros e datas de publicação do canal')}
    <div class="acoes cal-acoes">
      <button class="botao botao-primario" type="button" data-acao="yt-novo">Nova ideia de vídeo</button>
      <a class="botao botao-secundario" href="#calendario">Ver no Calendário</a>
      <div class="segmentado" role="group" aria-label="Visão">
        <button type="button" data-acao="yt-visao" data-visao="quadro" aria-pressed="${cfg.visao === 'quadro'}">Quadro</button>
        <button type="button" data-acao="yt-visao" data-visao="lista" aria-pressed="${cfg.visao === 'lista'}">Lista</button>
      </div>
    </div>
    ${resumo(estado, agora)}
    ${vazio ? `
      <section class="card vazio">
        <div class="vazio-icone">${icone('youtube')}</div>
        <h2>Comece pelas ideias</h2>
        <p class="texto-suave">Anote as ideias de vídeo. Cada uma anda pelas etapas, de roteiro a publicado, com checklist e data no Calendário.</p>
      </section>` : (cfg.visao === 'lista' ? lista(estado, agora) : quadro(estado, agora))}`;
}

// ---------------------------------------------------------------------------
// Página do vídeo
// ---------------------------------------------------------------------------

const campo = (rotulo, html, ajuda = '') => `
  <label class="campo"><span class="campo-rotulo">${rotulo}</span>${html}${ajuda ? `<span class="campo-ajuda">${ajuda}</span>` : ''}</label>`;

function dataHoraLocal(iso) {
  if (!iso) return ['', ''];
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`];
}

function abaIdeia(v) {
  const [dPub, hPub] = dataHoraLocal(v.data_publicacao);
  return `
    ${campo('Título (de trabalho)', `<input name="titulo" type="text" maxlength="100" value="${esc(v.titulo)}" required>`, `${(v.titulo || '').length}/100 · o YouTube mostra uns 60 caracteres na busca`)}
    ${campo('Outros títulos para testar <small>(um por linha)</small>', `<textarea name="titulos_alternativos" rows="3" maxlength="1000">${esc((v.titulos_alternativos || []).join('\n'))}</textarea>`)}
    <div class="cal-form-linha">
      ${campo('Formato', `<select name="formato">${opcoes(FORMATOS, v.formato)}</select>`)}
      ${campo('Etapa', `<select name="etapa">${opcoes(ETAPAS, v.etapa)}</select>`)}
    </div>
    <div class="cal-form-linha">
      ${campo('Série ou playlist <small>(opcional)</small>', `<input name="serie" type="text" maxlength="60" value="${esc(v.serie || '')}">`)}
      ${campo('Prioridade', `<select name="prioridade">${opcoes(PRIORIDADES, v.prioridade)}</select>`)}
    </div>
    <div class="cal-form-linha">
      ${campo('Dia de gravar', `<input name="data_gravacao" type="date" value="${esc(v.data_gravacao || '')}">`)}
      ${campo('Publicar em', `<span class="yt-data-hora"><input name="data_publicacao" type="date" value="${esc(dPub)}"><input name="hora_publicacao" type="time" value="${esc(hPub || '12:00')}" aria-label="Hora de publicar"></span>`, 'As duas datas entram no Calendário e nos avisos.')}
    </div>
    ${campo('Gancho', `<textarea name="gancho" rows="2" maxlength="500" placeholder="A frase dos primeiros segundos">${esc(v.gancho || '')}</textarea>`)}
    ${campo('Para quem é', `<input name="publico" type="text" maxlength="160" value="${esc(v.publico || '')}" placeholder="Quem vai assistir e o que essa pessoa quer resolver">`)}
    ${campo('Ideia da thumbnail', `<textarea name="ideia_thumb" rows="2" maxlength="500" placeholder="Imagem, expressão e até 3 ou 4 palavras de texto">${esc(v.ideia_thumb || '')}</textarea>`)}
    ${campo('Notas e referências', `<textarea name="notas" rows="4" maxlength="5000">${esc(v.notas || '')}</textarea>`)}`;
}

function abaRoteiro(v) {
  const blocos = v.roteiro?.blocos || [];
  const palavras = palavrasDoRoteiro(v);
  return `
    <p class="yt-contagem" data-yt-contagem>${palavras} ${palavras === 1 ? 'palavra' : 'palavras'} · cerca de ${duracao(duracaoEstimada(v))} de vídeo</p>
    <ol class="yt-blocos">${blocos.map((b, i) => `
      <li class="yt-bloco tipo-bloco-${esc(b.tipo)}">
        <div class="yt-bloco-topo">
          <select data-bloco-campo="tipo" data-indice="${i}" aria-label="Tipo do bloco ${i + 1}">${opcoes(TIPOS_BLOCO, b.tipo)}</select>
          <input type="text" data-bloco-campo="titulo" data-indice="${i}" value="${esc(b.titulo || '')}" maxlength="80" aria-label="Título do bloco ${i + 1}" placeholder="Título do bloco">
          <span class="yt-bloco-acoes">
            <button class="botao-icone botao-icone-p" type="button" data-acao="yt-bloco-mover" data-indice="${i}" data-passo="-1" aria-label="Subir bloco"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="yt-bloco-mover" data-indice="${i}" data-passo="1" aria-label="Descer bloco"${i === blocos.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-bloco-remover" data-indice="${i}" aria-label="Remover bloco">×</button>
          </span>
        </div>
        <textarea data-bloco-campo="texto" data-indice="${i}" rows="${Math.min(14, Math.max(3, Math.ceil(contarPalavras(b.texto) / 12)))}" placeholder="Escreva o que vai falar">${esc(b.texto || '')}</textarea>
        ${b.dica ? `<span class="campo-ajuda">${esc(b.dica)}</span>` : ''}
      </li>`).join('')}</ol>
    <div class="acoes">
      <button class="botao botao-secundario" type="button" data-acao="yt-bloco-novo">+ Bloco</button>
      <button class="botao botao-secundario" type="button" data-acao="yt-modelo">Usar a estrutura de ${esc((NOME_FORMATO[v.formato] || 'vídeo').toLowerCase())}</button>
    </div>`;
}

// Campo com um botão ao lado do rótulo (o botão fica fora do <label>).
const campoComAcao = (rotulo, id, html, acao, ajuda = '') => `
  <div class="campo">
    <div class="campo-com-acao"><label class="campo-rotulo" for="${id}">${rotulo}</label>${acao}</div>
    ${html}${ajuda ? `<span class="campo-ajuda">${ajuda}</span>` : ''}
  </div>`;

function botaoCopiar(alvo) {
  return `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-copiar" data-alvo="${alvo}">Copiar</button>`;
}

function abaPublicacao(v) {
  const tags = (v.tags || []).join(', ');
  const caps = capitulos(v);
  return `
    ${campoComAcao('Descrição', 'yt-descricao', `<textarea name="descricao" id="yt-descricao" rows="8" maxlength="5000" placeholder="As 2 primeiras linhas aparecem antes do &quot;mais&quot;: comece pelo que a pessoa ganha.">${esc(v.descricao || '')}</textarea>`, botaoCopiar('descricao'), 'Até 5.000 caracteres.')}
    ${campoComAcao('Tags <small>(separadas por vírgula)</small>', 'yt-tags', `<input name="tags" id="yt-tags" type="text" value="${esc(tags)}">`, botaoCopiar('tags'), `<span data-yt-tags>${tags.length}/${LIMITE_TAGS} caracteres</span>`)}
    ${campoComAcao('Capítulos', 'yt-capitulos', `<textarea id="yt-capitulos" rows="${Math.max(3, caps.split('\n').length)}" readonly>${esc(caps)}</textarea>`, caps ? botaoCopiar('capitulos') : '', caps ? 'Calculados pelo roteiro (150 palavras por minuto). Ajuste os tempos depois da edição.' : 'Aparecem quando o roteiro tiver pelo menos 3 blocos com texto.')}
    ${campo('Link do vídeo publicado', `<input name="link" type="url" value="${esc(v.link || '')}" placeholder="https://youtu.be/…">`)}`;
}

function abaChecklist(v) {
  const prog = progressoChecklist(v);
  return `
    <p class="texto-suave">${prog.feitos} de ${prog.total} feitos</p>
    ${barraProgresso(prog.fracao, 'Checklist de produção')}
    ${ETAPAS.filter((e) => CHECKLIST.some((c) => c.etapa === e.id)).map((e) => `
      <fieldset class="grupo-marcar">
        <legend class="campo-rotulo">${esc(e.nome)}</legend>
        ${CHECKLIST.filter((c) => c.etapa === e.id).map((c) => `
          <label class="campo-marcar"><input type="checkbox" name="check" value="${c.id}"${v.checklist?.[c.id] ? ' checked' : ''}><span>${esc(c.nome)}</span></label>`).join('')}
      </fieldset>`).join('')}`;
}

function abaResultados(v) {
  const m = v.metricas || {};
  const num = (nome, rotulo, sufixo = '') => campo(rotulo, `<input name="m_${nome}" type="number" min="0" step="any" inputmode="decimal" value="${esc(m[nome] ?? '')}">${sufixo}`);
  return `
    <p class="texto-suave">Anote os números do YouTube Studio para comparar os vídeos.</p>
    <div class="cal-form-linha">${num('views48h', 'Visualizações em 48 h')}${num('views7d', 'Visualizações em 7 dias')}</div>
    <div class="cal-form-linha">${num('ctr', 'CTR (%)')}${num('retencao', 'Retenção média (%)')}</div>
    <div class="cal-form-linha">${num('inscritos', 'Inscritos ganhos')}${num('views28d', 'Visualizações em 28 dias')}</div>
    ${campo('O que aprendi com este vídeo', `<textarea name="m_aprendizado" rows="4" maxlength="3000">${esc(m.aprendizado || '')}</textarea>`)}`;
}

function paginaVideo(estado) {
  const v = videosAtivos(estado).find((x) => x.id === estado.parametro);
  if (!v) {
    return `
      <a class="voltar" href="#youtube">‹ YouTube</a>
      ${cabecalho('Vídeo não encontrado')}
      <p class="texto-suave">Ele pode ter sido excluído.</p>`;
  }
  const aba = ABAS_VIDEO.some((a) => a.id === estado.ytAba) ? estado.ytAba : 'ideia';
  const conteudo = { ideia: abaIdeia, roteiro: abaRoteiro, publicacao: abaPublicacao, checklist: abaChecklist, resultados: abaResultados }[aba](v);
  const agora = Date.now();
  return `
    <a class="voltar" href="#youtube">‹ YouTube</a>
    ${cabecalho(v.titulo, `<span class="selo">${esc(NOME_ETAPA[v.etapa])}</span> <span>${esc(NOME_FORMATO[v.formato] || '')}</span> ${quandoPublica(v, agora)}`)}
    <div class="segmentado yt-abas" role="tablist" aria-label="Partes do vídeo">${ABAS_VIDEO.map((a) => `
      <button type="button" role="tab" data-acao="yt-aba" data-aba="${a.id}" aria-selected="${a.id === aba}" aria-pressed="${a.id === aba}">${a.nome}</button>`).join('')}
    </div>
    <form class="formulario yt-form card" data-form="yt-video" data-id="${esc(v.id)}" data-aba="${aba}" novalidate>
      ${conteudo}
      <p class="campo-ajuda" data-yt-salvo aria-live="polite">As mudanças salvam sozinhas.</p>
    </form>
    <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="yt-excluir" data-id="${esc(v.id)}">Excluir vídeo</button></div>`;
}

export function renderYoutube(estado) {
  return estado.parametro ? paginaVideo(estado) : painel(estado);
}

// Formulário rápido de ideia nova (na folha).
export function renderFormIdeia() {
  return `
    <form class="formulario" data-form="yt-novo" novalidate>
      <label class="campo"><span class="campo-rotulo">Ideia de vídeo</span>
        <input name="titulo" type="text" maxlength="100" required placeholder="Ex.: Como eu organizo a semana de provas"></label>
      <label class="campo"><span class="campo-rotulo">Formato</span><select name="formato">${opcoes(FORMATOS, 'longo')}</select></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Guardar ideia</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

// Card do Início: próximo vídeo e o que está em produção.
export function cardYoutubeInicio(estado, agora = Date.now()) {
  const ativos = videosAtivos(estado);
  const prox = proximoAPublicar(estado, agora);
  const emProducao = ativos.filter((v) => !['ideia', 'publicado'].includes(v.etapa));
  return `
    <section class="card" aria-labelledby="yt-inicio">
      <div class="card-topo">
        <h2 class="card-titulo" id="yt-inicio">YouTube</h2>
        <a class="card-link" href="#youtube">Abrir</a>
      </div>
      ${prox ? `<p class="plano-prova"><a href="#youtube/${esc(prox.id)}">${esc(prox.titulo)}</a></p><p class="texto-suave">${esc(NOME_ETAPA[prox.etapa])} · ${quandoPublica(prox, agora)}</p>` : '<p class="texto-suave">Nenhum vídeo com data de publicação.</p>'}
      <p class="texto-suave">${emProducao.length} em produção · ${ativos.filter((v) => v.etapa === 'ideia').length} ideias</p>
    </section>`;
}

export { MODELOS_ROTEIRO, LIMITE_TAGS };
