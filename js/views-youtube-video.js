// Página de um vídeo do Hub do YouTube (#youtube/<id>): ideia, roteiro (com teleprompter),
// gravação, edição, thumbnail, publicação, cortes para Shorts, checklist e resultados.
// Cada parte tem a ajuda da IA onde faz sentido (só roda quando a Carol pede).

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import {
  ETAPAS, FORMATOS, TIPOS_BLOCO, videosAtivos, configDoCanal, checklistDoCanal, progressoDoVideo, notaDaIdeia,
  palavrasDoRoteiro, duracaoEstimada, duracao, capitulos, contarPalavras, tempoDoBloco,
} from './dados-youtube.js';
import { MAX_THUMBS } from './thumbs-youtube.js';
import { opcoes, quandoPublica, seloPilar, avisoDeMigracao, NOME_ETAPA, NOME_FORMATO } from './views-youtube.js';

export const ABAS_VIDEO = [
  { id: 'ideia', nome: 'Ideia' },
  { id: 'roteiro', nome: 'Roteiro' },
  { id: 'gravacao', nome: 'Gravação' },
  { id: 'edicao', nome: 'Edição' },
  { id: 'thumb', nome: 'Thumbnail' },
  { id: 'publicacao', nome: 'Publicação' },
  { id: 'cortes', nome: 'Cortes' },
  { id: 'checklist', nome: 'Checklist' },
  { id: 'resultados', nome: 'Resultados' },
];
const PRIORIDADES = [{ id: 1, nome: 'Alta' }, { id: 2, nome: 'Média' }, { id: 3, nome: 'Baixa' }];
const ESCALA = [1, 2, 3, 4, 5].map((n) => ({ id: n, nome: String(n) }));
export const LIMITE_TAGS = 500; // o YouTube aceita até 500 caracteres de tags
const LIMITE_TITULO = 100;

const campo = (rotulo, html, ajuda = '') => `
  <label class="campo"><span class="campo-rotulo">${rotulo}</span>${html}${ajuda ? `<span class="campo-ajuda">${ajuda}</span>` : ''}</label>`;

// Campo com um botão ao lado do rótulo (o botão fica fora do <label>).
const campoComAcao = (rotulo, id, html, acao, ajuda = '') => `
  <div class="campo">
    <div class="campo-com-acao"><label class="campo-rotulo" for="${id}">${rotulo}</label>${acao}</div>
    ${html}${ajuda ? `<span class="campo-ajuda">${ajuda}</span>` : ''}
  </div>`;

const botaoCopiar = (alvo) => `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-copiar" data-alvo="${alvo}">Copiar</button>`;
const botaoIa = (acao, rotulo) => `<button class="botao botao-secundario botao-pequeno botao-ia" type="button" data-acao="yt-ia" data-ia="${acao}">✦ ${rotulo}</button>`;

function dataHoraLocal(iso) {
  if (!iso) return ['', ''];
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`];
}

const linhaSegura = (url) => (/^https?:\/\//i.test(url) ? url : null);

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

function abaIdeia(v, cfg) {
  const d = v.detalhes || {};
  const [dPub, hPub] = dataHoraLocal(v.data_publicacao);
  const refs = String(d.referencias || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return `
    <div class="yt-ia-linha">${botaoIa('titulos', 'Sugerir títulos')}${botaoIa('ganchos', 'Sugerir ganchos')}</div>
    ${campo('Título (de trabalho)', `<input name="titulo" type="text" maxlength="${LIMITE_TITULO}" value="${esc(v.titulo)}" required data-contar="titulo">`, `<span data-contagem="titulo">${(v.titulo || '').length}/${LIMITE_TITULO}</span> · na busca aparecem uns 60 caracteres`)}
    ${campo('Outros títulos para testar <small>(um por linha)</small>', `<textarea name="titulos_alternativos" rows="3" maxlength="1000">${esc((v.titulos_alternativos || []).join('\n'))}</textarea>`, 'O YouTube Studio deixa testar até 3 títulos ou thumbnails em "Testar e comparar".')}
    <div class="cal-form-linha">
      ${campo('Formato', `<select name="formato">${opcoes(FORMATOS, v.formato)}</select>`)}
      ${campo('Etapa', `<select name="etapa">${opcoes(ETAPAS, v.etapa)}</select>`)}
    </div>
    <div class="cal-form-linha">
      ${campo('Pilar', `<select name="pilar">${opcoes([{ id: '', nome: 'Nenhum' }, ...cfg.pilares], v.pilar || '')}</select>`)}
      ${campo('Série ou playlist <small>(opcional)</small>', `<input name="serie" type="text" maxlength="60" value="${esc(v.serie || '')}">`)}
    </div>
    <div class="cal-form-linha yt-tres">
      ${campo('Potencial <small>(1 a 5)</small>', `<select name="d_potencial">${opcoes(ESCALA, d.potencial || 3)}</select>`)}
      ${campo('Esforço <small>(1 a 5)</small>', `<select name="d_esforco">${opcoes(ESCALA, d.esforco || 3)}</select>`)}
      ${campo('Prioridade', `<select name="prioridade">${opcoes(PRIORIDADES, v.prioridade)}</select>`)}
    </div>
    <p class="campo-ajuda">Nota da ideia: <strong data-yt-nota>${notaDaIdeia(v)}</strong>/100 (potencial alto e esforço baixo sobem a nota).</p>
    <div class="cal-form-linha">
      ${campo('Dia de gravar', `<input name="data_gravacao" type="date" value="${esc(v.data_gravacao || '')}">`)}
      ${campo('Publicar em', `<span class="yt-data-hora"><input name="data_publicacao" type="date" value="${esc(dPub)}"><input name="hora_publicacao" type="time" value="${esc(hPub || '12:00')}" aria-label="Hora de publicar"></span>`, 'As duas datas entram no Calendário e nos avisos.')}
    </div>
    ${campo('Gancho', `<textarea name="gancho" rows="2" maxlength="500" placeholder="A frase dos primeiros segundos">${esc(v.gancho || '')}</textarea>`)}
    ${campo('Para quem é', `<input name="publico" type="text" maxlength="160" value="${esc(v.publico || '')}" placeholder="Quem vai assistir e o que essa pessoa quer resolver">`)}
    ${campo('Por que agora', `<input name="d_porque" type="text" maxlength="200" value="${esc(d.porque || '')}" placeholder="Época de provas, tendência, pergunta que chegou nos comentários…">`)}
    ${campo('Referências <small>(links de vídeos e textos, um por linha)</small>', `<textarea name="d_referencias" rows="3" maxlength="3000">${esc(d.referencias || '')}</textarea>`)}
    ${refs.length ? `<ul class="yt-refs">${refs.map((r) => (linhaSegura(r) ? `<li><a href="${esc(r)}" target="_blank" rel="noopener">${esc(r)}</a></li>` : `<li>${esc(r)}</li>`)).join('')}</ul>` : ''}
    ${campo('Notas', `<textarea name="notas" rows="4" maxlength="5000">${esc(v.notas || '')}</textarea>`)}`;
}

function abaRoteiro(v) {
  const blocos = v.roteiro?.blocos || [];
  const palavras = palavrasDoRoteiro(v);
  return `
    <div class="yt-ia-linha">
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="yt-teleprompter">▶ Teleprompter</button>
      ${botaoIa('roteiro', 'Rascunho do roteiro com IA')}
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-modelo">Estrutura de ${esc((NOME_FORMATO[v.formato] || 'vídeo').toLowerCase())}</button>
    </div>
    <p class="yt-contagem" data-yt-contagem>${palavras} ${palavras === 1 ? 'palavra' : 'palavras'} · cerca de ${duracao(duracaoEstimada(v))} de vídeo</p>
    <ol class="yt-blocos">${blocos.map((b, i) => `
      <li class="yt-bloco tipo-bloco-${esc(b.tipo)}">
        <div class="yt-bloco-topo">
          <select data-bloco-campo="tipo" data-indice="${i}" aria-label="Tipo do bloco ${i + 1}">${opcoes(TIPOS_BLOCO, b.tipo)}</select>
          <input type="text" data-bloco-campo="titulo" data-indice="${i}" value="${esc(b.titulo || '')}" maxlength="80" aria-label="Título do bloco ${i + 1}" placeholder="Título do bloco">
          <span class="yt-bloco-acoes">
            <span class="yt-bloco-tempo" data-bloco-tempo="${i}" title="Tempo de fala estimado">${tempoDoBloco(b)}</span>
            <button class="botao-icone botao-icone-p" type="button" data-acao="yt-bloco-mover" data-indice="${i}" data-passo="-1" aria-label="Subir bloco"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="botao-icone botao-icone-p" type="button" data-acao="yt-bloco-mover" data-indice="${i}" data-passo="1" aria-label="Descer bloco"${i === blocos.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-bloco-remover" data-indice="${i}" aria-label="Remover bloco">×</button>
          </span>
        </div>
        <textarea data-bloco-campo="texto" data-indice="${i}" rows="${Math.min(14, Math.max(3, Math.ceil(contarPalavras(b.texto) / 12)))}" placeholder="O que você vai falar" aria-label="Fala do bloco ${i + 1}">${esc(b.texto || '')}</textarea>
        <input type="text" data-bloco-campo="visual" data-indice="${i}" value="${esc(b.visual || '')}" maxlength="300" placeholder="Na tela: b-roll, print, texto, corte…" aria-label="O que aparece na tela no bloco ${i + 1}">
        ${b.dica ? `<span class="campo-ajuda">${esc(b.dica)}</span>` : ''}
      </li>`).join('')}</ol>
    <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="yt-bloco-novo">+ Bloco</button></div>`;
}

function listaMarcavel(nome, itens, rotuloNovo, placeholder) {
  return `
    <ul class="yt-marcaveis" data-lista="${nome}">${itens.map((item, i) => `
      <li>
        <input type="checkbox" data-item-campo="feito" data-lista="${nome}" data-indice="${i}"${item.feito ? ' checked' : ''} aria-label="Feito: ${esc(item.texto)}">
        <input type="text" data-item-campo="texto" data-lista="${nome}" data-indice="${i}" value="${esc(item.texto)}" maxlength="200" aria-label="Item ${i + 1}">
        <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-item-remover" data-lista="${nome}" data-indice="${i}" aria-label="Remover">×</button>
      </li>`).join('')}</ul>
    <div class="acoes">
      <input class="yt-novo-item" type="text" maxlength="200" placeholder="${esc(placeholder)}" data-novo-item="${nome}" aria-label="${esc(rotuloNovo)}">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-item-novo" data-lista="${nome}">${esc(rotuloNovo)}</button>
    </div>`;
}

function abaGravacao(v) {
  const d = v.detalhes || {};
  const cenas = d.cenas || [];
  const feitas = cenas.filter((c) => c.feito).length;
  return `
    ${campo('Dia de gravar', `<input name="data_gravacao" type="date" value="${esc(v.data_gravacao || '')}">`)}
    <div class="cal-form-linha">
      ${campo('Local', `<input name="d_local" type="text" maxlength="120" value="${esc(d.local || '')}" placeholder="Quarto, biblioteca, rua…">`)}
      ${campo('Roupa e cenário', `<input name="d_cenario" type="text" maxlength="200" value="${esc(d.cenario || '')}">`)}
    </div>
    ${campo('Equipamento', `<textarea name="d_equipamento" rows="2" maxlength="1000" placeholder="Câmera ou celular, microfone, luz, tripé, bateria carregada">${esc(d.equipamento || '')}</textarea>`)}
    <div class="campo-com-acao"><h2 class="card-titulo">Cenas e takes <small class="texto-suave">${feitas}/${cenas.length}</small></h2>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-cenas-roteiro">Montar a partir do roteiro</button></div>
    ${listaMarcavel('cenas', cenas, '+ Cena', 'Ex.: Abertura falando para a câmera')}
    ${campo('Notas da gravação', `<textarea name="d_notas_gravacao" rows="3" maxlength="3000" placeholder="O que repetir, o que ficou bom, ideias que surgiram">${esc(d.notas_gravacao || '')}</textarea>`)}`;
}

function abaEdicao(v) {
  const d = v.detalhes || {};
  return `
    <div class="cal-form-linha">
      ${campo('Quem edita', `<input name="d_editor" type="text" maxlength="80" value="${esc(d.editor || '')}" placeholder="Eu, ou o nome de quem edita">`)}
      ${campo('Prazo da edição', `<input name="d_prazo_edicao" type="date" value="${esc(d.prazo_edicao || '')}">`)}
    </div>
    ${campo('Pasta do projeto e dos arquivos', `<input name="d_projeto" type="url" maxlength="500" value="${esc(d.projeto || '')}" placeholder="Link do Drive, CapCut, Premiere…">`)}
    ${linhaSegura(d.projeto || '') ? `<p><a href="${esc(d.projeto)}" target="_blank" rel="noopener">Abrir a pasta do projeto</a></p>` : ''}
    ${campo('Música e efeitos', `<input name="d_musica" type="text" maxlength="300" value="${esc(d.musica || '')}" placeholder="Faixas da biblioteca de áudio do YouTube, efeitos">`)}
    ${campo('Marcações <small>(tempo e o que fazer, uma por linha)</small>', `<textarea name="d_marcacoes" rows="6" maxlength="5000" placeholder="0:12 cortar a respiração&#10;1:40 entrar print do app&#10;3:05 texto na tela: dica 2">${esc(d.marcacoes || '')}</textarea>`)}
    ${campo('Tela final e cards', `<textarea name="d_tela_final" rows="2" maxlength="1000" placeholder="Qual vídeo indicar no fim; onde entram os cards">${esc(d.tela_final || '')}</textarea>`)}`;
}

function abaThumb(v) {
  const thumbs = v.thumbs || [];
  return `
    <div class="yt-ia-linha">${botaoIa('thumbs', 'Sugerir conceitos de thumbnail')}</div>
    ${campo('Ideia da thumbnail', `<textarea name="ideia_thumb" rows="2" maxlength="500" placeholder="Imagem, expressão e o objeto principal">${esc(v.ideia_thumb || '')}</textarea>`)}
    ${campo('Texto na thumb <small>(até 4 palavras)</small>', `<input name="d_texto_thumb" type="text" maxlength="40" value="${esc(v.detalhes?.texto_thumb || '')}">`, 'O texto completa o título, sem repetir.')}
    <h2 class="card-titulo">Opções de imagem <small class="texto-suave">${thumbs.length}/${MAX_THUMBS}</small></h2>
    ${thumbs.length ? `<ul class="yt-thumbs">${thumbs.map((t, i) => `
      <li class="yt-thumb${t.escolhida ? ' escolhida' : ''}">
        <img data-thumb="${esc(t.caminho)}" alt="Opção ${i + 1} de thumbnail" width="320" height="180">
        <div class="acoes">
          <button class="botao ${t.escolhida ? 'botao-primario' : 'botao-secundario'} botao-pequeno" type="button" data-acao="yt-thumb-escolher" data-indice="${i}" aria-pressed="${Boolean(t.escolhida)}">${t.escolhida ? 'Escolhida' : 'Escolher esta'}</button>
          <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-thumb-remover" data-indice="${i}" aria-label="Remover opção ${i + 1}">×</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="texto-suave">Nenhuma imagem ainda. Mande até 3 opções para comparar lado a lado (tamanho ideal: 1280 × 720).</p>'}
    ${thumbs.length < MAX_THUMBS ? `<label class="botao botao-secundario">Enviar imagem<input class="visualmente-oculto" type="file" accept="image/*" data-acao-arquivo="yt-thumb"></label>` : ''}
    <p class="campo-ajuda" data-thumb-estado aria-live="polite"></p>`;
}

function abaPublicacao(v, cfg) {
  const tags = (v.tags || []).join(', ');
  const caps = capitulos(v);
  const d = v.detalhes || {};
  const opcoesTitulo = [v.titulo, ...(v.titulos_alternativos || [])].filter(Boolean);
  return `
    <div class="yt-ia-linha">
      ${botaoIa('publicacao', 'Escrever descrição e tags')}
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-descricao-modelo">Preencher com o modelo do canal</button>
    </div>
    ${campoComAcao('Título final', 'yt-titulo-final', `<input name="d_titulo_final" id="yt-titulo-final" type="text" maxlength="${LIMITE_TITULO}" list="yt-opcoes-titulo" value="${esc(d.titulo_final || v.titulo)}" data-contar="titulo_final">
      <datalist id="yt-opcoes-titulo">${opcoesTitulo.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>`, botaoCopiar('titulo-final'), `<span data-contagem="titulo_final">${(d.titulo_final || v.titulo || '').length}/${LIMITE_TITULO}</span> · escolha entre os títulos da aba Ideia ou escreva outro`)}
    ${campoComAcao('Descrição', 'yt-descricao', `<textarea name="descricao" id="yt-descricao" rows="10" maxlength="5000" placeholder="As 2 primeiras linhas aparecem antes do &quot;mais&quot;: comece pelo que a pessoa ganha.">${esc(v.descricao || '')}</textarea>`, botaoCopiar('descricao'), '<span data-contagem="descricao">' + (v.descricao || '').length + '/5000</span>')}
    ${campoComAcao('Tags <small>(separadas por vírgula)</small>', 'yt-tags', `<input name="tags" id="yt-tags" type="text" value="${esc(tags)}">`, botaoCopiar('tags'), `<span data-yt-tags>${tags.length}/${LIMITE_TAGS} caracteres</span>`)}
    ${campoComAcao('Hashtags', 'yt-hashtags', `<input name="d_hashtags" id="yt-hashtags" type="text" maxlength="200" value="${esc(d.hashtags ?? cfg.hashtags)}" placeholder="#estudos #faculdade">`, botaoCopiar('hashtags'), 'Até 3 aparecem em cima do título.')}
    ${campoComAcao('Capítulos', 'yt-capitulos', `<textarea id="yt-capitulos" rows="${Math.max(3, caps.split('\n').length)}" readonly>${esc(caps)}</textarea>`, caps ? botaoCopiar('capitulos') : '', caps ? 'Calculados pelo roteiro (150 palavras por minuto). Ajuste os tempos depois da edição.' : 'Aparecem quando o roteiro tiver pelo menos 3 blocos com uns 10 s de fala.')}
    <div class="cal-form-linha">
      ${campo('Playlist', `<input name="d_playlist" type="text" maxlength="100" value="${esc(d.playlist || v.serie || '')}">`)}
      ${campo('Link do vídeo publicado', `<input name="link" type="url" value="${esc(v.link || '')}" placeholder="https://youtu.be/…">`)}
    </div>
    ${campoComAcao('Comentário fixado', 'yt-comentario', `<textarea name="d_comentario" id="yt-comentario" rows="3" maxlength="1000" placeholder="Uma pergunta para puxar conversa ou o link principal">${esc(d.comentario || '')}</textarea>`, botaoCopiar('comentario'))}
    ${linhaSegura(v.link || '') ? `<p><a class="botao botao-secundario" href="${esc(v.link)}" target="_blank" rel="noopener">Abrir no YouTube</a></p>` : ''}`;
}

function abaCortes(v, estado) {
  const cortes = v.detalhes?.cortes || [];
  const filhos = videosAtivos(estado).filter((x) => x.video_origem_id === v.id);
  return `
    <p class="texto-suave">Trechos do vídeo que viram Shorts sozinhos. Cada corte pode virar um Short no quadro, ligado a este vídeo.</p>
    <div class="yt-ia-linha">${botaoIa('cortes', 'Sugerir cortes')}</div>
    ${cortes.length ? `<ul class="yt-cortes">${cortes.map((c, i) => {
      const short = filhos.find((f) => f.id === c.videoId);
      return `
      <li class="yt-corte">
        <input type="text" data-corte-campo="titulo" data-indice="${i}" value="${esc(c.titulo || '')}" maxlength="100" aria-label="Título do corte ${i + 1}" placeholder="Título do Short">
        <input type="text" data-corte-campo="trecho" data-indice="${i}" value="${esc(c.trecho || '')}" maxlength="200" aria-label="Trecho do corte ${i + 1}" placeholder="De onde sai (bloco ou tempo, ex.: 2:10–2:55)">
        <input type="text" data-corte-campo="gancho" data-indice="${i}" value="${esc(c.gancho || '')}" maxlength="200" aria-label="Gancho do corte ${i + 1}" placeholder="Primeira frase do Short">
        <div class="acoes">
          ${short ? `<a class="botao botao-secundario botao-pequeno" href="#youtube/${esc(short.id)}">Abrir o Short (${esc(NOME_ETAPA[short.etapa])})</a>`
            : `<button class="botao botao-primario botao-pequeno" type="button" data-acao="yt-corte-short" data-indice="${i}">Criar Short</button>`}
          <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-corte-remover" data-indice="${i}" aria-label="Remover corte">×</button>
        </div>
      </li>`;
    }).join('')}</ul>` : '<p class="texto-suave">Nenhum corte ainda.</p>'}
    <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="yt-corte-novo">+ Corte</button></div>
    ${v.video_origem_id ? (() => {
      const origem = videosAtivos(estado).find((x) => x.id === v.video_origem_id);
      return origem ? `<p class="texto-suave">Este Short saiu de <a href="#youtube/${esc(origem.id)}">${esc(origem.titulo)}</a>.</p>` : '';
    })() : ''}`;
}

function abaChecklist(v, cfg) {
  const itens = checklistDoCanal(cfg);
  const prog = progressoDoVideo(v, cfg);
  return `
    <p class="texto-suave">${prog.feitos} de ${prog.total} feitos · itens próprios entram em Canal → Itens a mais no checklist.</p>
    ${barraProgresso(prog.fracao, 'Checklist de produção')}
    ${ETAPAS.filter((e) => itens.some((c) => c.etapa === e.id)).map((e) => `
      <fieldset class="grupo-marcar">
        <legend class="campo-rotulo">${esc(e.nome)}</legend>
        ${itens.filter((c) => c.etapa === e.id).map((c) => `
          <label class="campo-marcar"><input type="checkbox" name="check" value="${esc(c.id)}"${v.checklist?.[c.id] ? ' checked' : ''}><span>${esc(c.nome)}</span></label>`).join('')}
      </fieldset>`).join('')}`;
}

function abaResultados(v) {
  const m = v.metricas || {};
  const num = (nome, rotulo) => campo(rotulo, `<input name="m_${nome}" type="number" min="0" step="any" inputmode="decimal" value="${esc(m[nome] ?? '')}">`);
  return `
    <p class="texto-suave">Anote os números do YouTube Studio. A aba Desempenho do painel compara todos os vídeos.</p>
    <div class="cal-form-linha">${num('views48h', 'Visualizações em 48 h')}${num('views7d', 'Visualizações em 7 dias')}</div>
    <div class="cal-form-linha">${num('views28d', 'Visualizações em 28 dias')}${num('inscritos', 'Inscritos ganhos')}</div>
    <div class="cal-form-linha">${num('ctr', 'CTR (%)')}${num('retencao', 'Retenção média (%)')}</div>
    <div class="cal-form-linha">${num('curtidas', 'Curtidas')}${num('comentarios', 'Comentários')}</div>
    ${campo('O que aprendi com este vídeo', `<textarea name="m_aprendizado" rows="4" maxlength="3000">${esc(m.aprendizado || '')}</textarea>`)}`;
}

// ---------------------------------------------------------------------------
// Painel da IA (sugestões com botões "Usar")
// ---------------------------------------------------------------------------

function painelIa(ia, v) {
  if (!ia || ia.videoId !== v.id) return '';
  const titulo = { titulos: 'Títulos', ganchos: 'Ganchos', roteiro: 'Rascunho do roteiro', publicacao: 'Descrição e tags', thumbs: 'Conceitos de thumbnail', cortes: 'Cortes para Shorts' }[ia.acao];
  let corpo;
  if (ia.carregando) corpo = '<p class="cal-lendo"><span class="carregando" aria-hidden="true"></span> A IA está pensando… (uns 10 a 30 segundos)</p>';
  else if (ia.erro) corpo = `<div class="ava-alerta" role="alert">${esc(ia.erro)}</div>`;
  else {
    const r = ia.resultado || {};
    const usar = (i, rotulo = 'Usar') => `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-ia-usar" data-indice="${i}">${rotulo}</button>`;
    if (ia.acao === 'titulos') corpo = `<ul class="yt-ia-lista">${(r.titulos || []).map((t, i) => `<li><span><strong>${esc(t.titulo)}</strong><small class="campo-ajuda"> ${esc(t.titulo.length)} car. · ${esc(t.porque)}</small></span>${usar(i, 'Usar')}${`<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-ia-usar" data-indice="${i}" data-modo="alternativo">Guardar para testar</button>`}</li>`).join('')}</ul>`;
    else if (ia.acao === 'ganchos') corpo = `<ul class="yt-ia-lista">${(r.ganchos || []).map((g, i) => `<li><span>${esc(g.gancho)}<small class="campo-ajuda"> · ${esc(g.tipo)}</small></span>${usar(i)}</li>`).join('')}</ul>`;
    else if (ia.acao === 'roteiro') corpo = `<ol class="yt-ia-lista">${(r.blocos || []).map((b) => `<li><span><strong>${esc(b.titulo)}</strong><br>${esc(String(b.texto).slice(0, 280))}${String(b.texto).length > 280 ? '…' : ''}</span></li>`).join('')}</ol>
      <div class="acoes"><button class="botao botao-primario botao-pequeno" type="button" data-acao="yt-ia-usar" data-modo="substituir">Usar como roteiro</button><button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-ia-usar" data-modo="juntar">Juntar no fim</button></div>`;
    else if (ia.acao === 'publicacao') corpo = `<p><strong>Resumo:</strong> ${esc(r.resumo || '')}</p><p><strong>Tags:</strong> ${esc((r.tags || []).join(', '))}</p><p><strong>Hashtags:</strong> ${esc((r.hashtags || []).join(' '))}</p>
      <div class="acoes"><button class="botao botao-primario botao-pequeno" type="button" data-acao="yt-ia-usar">Usar tudo</button></div>`;
    else if (ia.acao === 'thumbs') corpo = `<ul class="yt-ia-lista">${(r.ideias || []).map((t, i) => `<li><span>${esc(t.imagem)}<br><strong>Texto: ${esc(t.texto_na_thumb)}</strong><small class="campo-ajuda"> · ${esc(t.porque)}</small></span>${usar(i)}</li>`).join('')}</ul>`;
    else if (ia.acao === 'cortes') corpo = `<ul class="yt-ia-lista">${(r.cortes || []).map((c, i) => `<li><span><strong>${esc(c.titulo)}</strong><br>${esc(c.gancho)}<small class="campo-ajuda"> · ${esc(c.de_onde)}</small></span>${usar(i, 'Adicionar')}</li>`).join('')}</ul>`;
  }
  return `
    <section class="card yt-ia" aria-labelledby="yt-ia-titulo" aria-live="polite">
      <div class="card-topo">
        <h2 class="card-titulo" id="yt-ia-titulo">✦ Sugestões da IA: ${esc(titulo || '')}</h2>
        <button class="botao-icone botao-icone-p" type="button" data-acao="yt-ia-fechar" aria-label="Fechar sugestões">×</button>
      </div>
      ${corpo}
      <p class="campo-ajuda">Sugestões para editar do seu jeito. Nada muda até você tocar em "Usar".</p>
    </section>`;
}

// ---------------------------------------------------------------------------

export function renderPaginaVideo(estado) {
  const v = videosAtivos(estado).find((x) => x.id === estado.parametro);
  if (!v) {
    return `
      <a class="voltar" href="#youtube">‹ YouTube</a>
      ${cabecalho('Vídeo não encontrado')}
      <p class="texto-suave">Ele pode ter sido excluído.</p>`;
  }
  const cfg = configDoCanal(estado);
  const aba = ABAS_VIDEO.some((a) => a.id === estado.ytAba) ? estado.ytAba : 'ideia';
  const conteudo = {
    ideia: () => abaIdeia(v, cfg),
    roteiro: () => abaRoteiro(v),
    gravacao: () => abaGravacao(v),
    edicao: () => abaEdicao(v),
    thumb: () => abaThumb(v),
    publicacao: () => abaPublicacao(v, cfg),
    cortes: () => abaCortes(v, estado),
    checklist: () => abaChecklist(v, cfg),
    resultados: () => abaResultados(v),
  }[aba]();
  const prog = progressoDoVideo(v, cfg);
  const i = ETAPAS.findIndex((e) => e.id === v.etapa);
  return `
    <a class="voltar" href="#youtube">‹ YouTube</a>
    ${cabecalho(v.titulo, `<span class="selo">${esc(NOME_ETAPA[v.etapa])}</span> <span>${esc(NOME_FORMATO[v.formato] || '')}</span> ${seloPilar(cfg, v.pilar)} ${quandoPublica(v)}`)}
    ${avisoDeMigracao()}
    <div class="yt-etapas" aria-label="Etapa do vídeo">
      ${barraProgresso(prog.fracao, 'Checklist do vídeo')}
      <div class="acoes">
        ${i > 0 ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="-1">‹ ${esc(ETAPAS[i - 1].nome)}</button>` : ''}
        ${i < ETAPAS.length - 1 ? `<button class="botao botao-primario botao-pequeno" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="1">Passar para ${esc(ETAPAS[i + 1].nome)} ›</button>` : ''}
      </div>
    </div>
    <div class="segmentado yt-abas" role="tablist" aria-label="Partes do vídeo">${ABAS_VIDEO.map((a) => `
      <button type="button" role="tab" data-acao="yt-aba" data-aba="${a.id}" aria-selected="${a.id === aba}" aria-pressed="${a.id === aba}">${a.nome}</button>`).join('')}
    </div>
    ${painelIa(estado.ytIa, v)}
    <form class="formulario yt-form card" data-form="yt-video" data-id="${esc(v.id)}" data-aba="${aba}" novalidate>
      ${conteudo}
      <p class="campo-ajuda" data-yt-salvo aria-live="polite">As mudanças salvam sozinhas.</p>
    </form>
    <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="yt-excluir" data-id="${esc(v.id)}">Excluir vídeo</button></div>`;
}
