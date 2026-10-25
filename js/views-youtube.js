// Tela YouTube: painel do canal com quadro por etapas (arrastar entre colunas), calendário
// de publicação, banco de ideias com nota, desempenho e ajustes do canal.
// A página de cada vídeo (#youtube/<id>) fica em views-youtube-video.js.

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { esc, contagemRegressiva, urgencia, numeroNota } from './utilidades.js';
import { situacaoSincronizacao } from './persistencia.js';
import { chaveDia, dataDaChave, gradeDoMes, mesmoMes } from './dados-calendario.js';
import {
  ETAPAS, FORMATOS, videosAtivos, videosDaEtapa, proximoAPublicar, metaDaSemana, configDoCanal, progressoDoVideo,
  notaDaIdeia, ideiasOrdenadas, precisaDeAtencao, desempenho, publicadosNoMes,
} from './dados-youtube.js';
import { renderPaginaVideo } from './views-youtube-video.js';

export const VISOES_CANAL = [
  { id: 'quadro', nome: 'Quadro' },
  { id: 'calendario', nome: 'Calendário' },
  { id: 'ideias', nome: 'Ideias' },
  { id: 'desempenho', nome: 'Desempenho' },
  { id: 'canal', nome: 'Canal' },
];
export const NOME_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nome]));
export const NOME_FORMATO = Object.fromEntries(FORMATOS.map((f) => [f.id, f.nome]));
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function opcoes(lista, atual) {
  return lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(atual ?? '') ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
}

export function quandoPublica(v, agora = Date.now()) {
  if (!v.data_publicacao) return '';
  const t = new Date(v.data_publicacao).getTime();
  if (v.etapa === 'publicado') return esc(`Publicado em ${fmtCurta.format(t).replace('.', '')}`);
  return `<span class="chip urg-${urgencia(t, agora)}">${esc(contagemRegressiva(t, agora))}</span>`;
}

export function seloPilar(cfg, pilarId) {
  const p = cfg.pilares.find((x) => x.id === pilarId);
  return p ? `<span class="pilar pilar-${Number(p.cor) || 1}">${esc(p.nome)}</span>` : '';
}

// Aviso quando o Supabase ainda não tem as tabelas e colunas do YouTube (migrações 005 e 006).
export function avisoDeMigracao() {
  const s = situacaoSincronizacao();
  if (s.estado !== 'aviso' && s.estado !== 'erro') return '';
  if (!/videos|youtube|eventos/i.test(s.erro || '')) return '';
  return `
    <div class="ava-alerta yt-aviso" role="alert">
      <strong>Os vídeos estão salvos só neste aparelho.</strong>
      O Supabase ainda não tem a parte do YouTube: rode no SQL Editor as migrações
      <code>005-youtube.sql</code> e <code>006-youtube-completo.sql</code> (nessa ordem). Depois disso, tudo sincroniza sozinho.
      <span class="detalhe-tecnico">${esc(s.erro || '')}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Visões do painel
// ---------------------------------------------------------------------------

function cartaoVideo(v, cfg, agora) {
  const prog = progressoDoVideo(v, cfg);
  const i = ETAPAS.findIndex((e) => e.id === v.etapa);
  return `
    <li class="yt-cartao prioridade-${v.prioridade}" data-video="${esc(v.id)}">
      <div class="yt-cartao-topo">
        <button class="yt-alca" type="button" data-yt-arrastar="${esc(v.id)}" aria-label="Arrastar ${esc(v.titulo)} para outra etapa" title="Segure e arraste para outra etapa">⠿</button>
        <a class="yt-cartao-link" href="#youtube/${esc(v.id)}"><span class="yt-cartao-titulo">${esc(v.titulo)}</span></a>
      </div>
      <span class="yt-cartao-meta">${esc(NOME_FORMATO[v.formato] || '')} ${seloPilar(cfg, v.pilar)}</span>
      ${v.data_publicacao ? `<span class="yt-cartao-meta">${quandoPublica(v, agora)}</span>` : ''}
      ${barraProgresso(prog.fracao, `Checklist de ${v.titulo}`)}
      <div class="yt-cartao-acoes">
        <button class="botao-icone botao-icone-p" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="-1" aria-label="Voltar para ${esc(ETAPAS[Math.max(0, i - 1)].nome)}"${i <= 0 ? ' disabled' : ''}>‹</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="1" aria-label="Passar para ${esc(ETAPAS[Math.min(ETAPAS.length - 1, i + 1)].nome)}"${i >= ETAPAS.length - 1 ? ' disabled' : ''}>›</button>
      </div>
    </li>`;
}

function visaoQuadro(estado, cfg, agora) {
  return `
    <p class="campo-ajuda">Segure <strong>⠿</strong> e arraste o vídeo para outra etapa (ou use ‹ ›).</p>
    <div class="yt-quadro" aria-label="Vídeos por etapa">${ETAPAS.map((e) => {
      const lista = videosDaEtapa(estado, e.id);
      return `
      <section class="yt-coluna" data-etapa="${e.id}" aria-labelledby="yt-col-${e.id}">
        <h2 class="yt-coluna-titulo" id="yt-col-${e.id}">${esc(e.nome)} <span class="selo">${lista.length}</span></h2>
        ${lista.length ? `<ul class="yt-cartoes">${lista.map((v) => cartaoVideo(v, cfg, agora)).join('')}</ul>` : '<p class="texto-suave yt-vazio">Solte um vídeo aqui.</p>'}
        ${e.id === 'ideia' ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-novo">+ Ideia</button>' : ''}
      </section>`;
    }).join('')}</div>`;
}

function visaoCalendario(estado, agora) {
  const foco = estado.ytMes || chaveDia(new Date(agora));
  const semanas = gradeDoMes(foco);
  const hoje = chaveDia(new Date(agora));
  const porDia = new Map();
  const adicionar = (dia, item) => {
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(item);
  };
  for (const v of videosAtivos(estado)) {
    if (v.data_publicacao) adicionar(chaveDia(v.data_publicacao), { v, tipo: 'publicar' });
    if (v.data_gravacao) adicionar(v.data_gravacao, { v, tipo: 'gravar' });
  }
  const celulas = semanas.flat().map((dia) => {
    const itens = porDia.get(dia) || [];
    return `
      <div class="yt-dia${mesmoMes(dia, foco) ? '' : ' fora'}${dia === hoje ? ' hoje' : ''}">
        <button class="yt-dia-num" type="button" data-acao="yt-novo" data-dia="${dia}" aria-label="Nova ideia para publicar em ${esc(fmtCurta.format(dataDaChave(dia)))}">${dataDaChave(dia).getDate()}</button>
        ${itens.map(({ v, tipo }) => `<a class="yt-dia-item ${tipo}" href="#youtube/${esc(v.id)}" title="${tipo === 'publicar' ? 'Publicar' : 'Gravar'}: ${esc(v.titulo)}">${tipo === 'publicar' ? '▶' : '●'} ${esc(v.titulo)}</a>`).join('')}
      </div>`;
  }).join('');
  return `
    <div class="yt-cal-barra">
      <button class="botao-icone" type="button" data-acao="yt-mes" data-passo="-1" aria-label="Mês anterior">‹</button>
      <h2 class="cal-periodo">${esc(maiuscula(fmtMes.format(dataDaChave(foco))))}</h2>
      <button class="botao-icone" type="button" data-acao="yt-mes" data-passo="1" aria-label="Próximo mês">›</button>
      <span class="campo-ajuda"><strong>▶</strong> publicar · <strong>●</strong> gravar · toque no número do dia para uma ideia nova naquela data</span>
    </div>
    <section class="card yt-cal">
      <div class="yt-cal-grade">${INICIAIS.map((l) => `<span class="cal-dia-semana" aria-hidden="true">${l}</span>`).join('')}${celulas}</div>
    </section>`;
}

function visaoIdeias(estado, cfg) {
  const filtro = estado.ytPilar || '';
  const ideias = ideiasOrdenadas(estado, filtro);
  return `
    <div class="yt-cal-barra">
      <label class="campo campo-curto"><span class="campo-rotulo">Pilar</span>
        <select data-acao-mudar="yt-filtro-pilar">${opcoes([{ id: '', nome: 'Todos' }, ...cfg.pilares], filtro)}</select></label>
      <span class="campo-ajuda">Ordem: potencial alto e esforço baixo primeiro. Ajuste os dois na página da ideia.</span>
    </div>
    ${ideias.length ? `<ul class="yt-ideias">${ideias.map((v) => `
      <li class="yt-ideia">
        <span class="yt-nota" title="Nota da ideia">${notaDaIdeia(v)}</span>
        <a class="yt-ideia-texto" href="#youtube/${esc(v.id)}">
          <span class="yt-cartao-titulo">${esc(v.titulo)}</span>
          <span class="yt-cartao-meta">${esc(NOME_FORMATO[v.formato] || '')} ${seloPilar(cfg, v.pilar)} · potencial ${Number(v.detalhes?.potencial) || 3}/5 · esforço ${Number(v.detalhes?.esforco) || 3}/5</span>
          ${v.gancho ? `<span class="yt-cartao-meta">“${esc(v.gancho)}”</span>` : ''}
        </a>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-etapa" data-id="${esc(v.id)}" data-passo="1">Começar</button>
      </li>`).join('')}</ul>` : `<section class="card"><p class="texto-suave">Nenhuma ideia guardada${filtro ? ' neste pilar' : ''}. Toque em "Nova ideia de vídeo".</p></section>`}`;
}

function visaoDesempenho(estado) {
  const d = desempenho(estado);
  const n = (x, suf = '') => (x === null || x === undefined || x === '' ? '—' : `${numeroNota(Number(x))}${suf}`);
  if (!d.publicados.length) return '<section class="card"><p class="texto-suave">Quando um vídeo estiver em "Publicado", anote os números em Resultados e eles aparecem aqui.</p></section>';
  return `
    <div class="painel">
      <section class="card bloco tam-1-3"><p class="yt-numero"><strong>${n(d.medias.ctr, '%')}</strong><span class="texto-suave">CTR médio</span></p></section>
      <section class="card bloco tam-1-3"><p class="yt-numero"><strong>${n(d.medias.retencao, '%')}</strong><span class="texto-suave">Retenção média</span></p></section>
      <section class="card bloco tam-1-3"><p class="yt-numero"><strong>${n(d.medias.views7d)}</strong><span class="texto-suave">Visualizações em 7 dias (média)</span></p></section>
    </div>
    ${d.melhor ? `<p class="texto-suave yt-melhor">Melhor vídeo em 7 dias: <a href="#youtube/${esc(d.melhor.id)}">${esc(d.melhor.titulo)}</a>. Vale repetir o formato e o tipo de gancho.</p>` : ''}
    <section class="card">
      <div class="yt-tabela" role="table" aria-label="Desempenho dos vídeos publicados">
        <div class="yt-tabela-linha cabeca" role="row"><span role="columnheader">Vídeo</span><span role="columnheader">48 h</span><span role="columnheader">7 dias</span><span role="columnheader">CTR</span><span role="columnheader">Retenção</span></div>
        ${d.publicados.map((v) => {
          const m = v.metricas || {};
          return `<a class="yt-tabela-linha" role="row" href="#youtube/${esc(v.id)}"><span role="cell">${esc(v.titulo)}</span><span role="cell">${n(m.views48h)}</span><span role="cell">${n(m.views7d)}</span><span role="cell">${n(m.ctr, '%')}</span><span role="cell">${n(m.retencao, '%')}</span></a>`;
        }).join('')}
      </div>
    </section>`;
}

function visaoCanal(cfg) {
  return `
    <form class="formulario card" data-form="yt-canal" novalidate>
      <h2 class="card-titulo">Pilares de conteúdo</h2>
      <p class="texto-suave">Os temas fixos do canal. Cada vídeo pode ter um pilar, e o banco de ideias filtra por eles.</p>
      <ul class="yt-pilares">${cfg.pilares.map((p, i) => `
        <li class="yt-pilar-linha">
          <span class="pilar pilar-${Number(p.cor) || 1}" aria-hidden="true">●</span>
          <input type="text" maxlength="40" value="${esc(p.nome)}" data-pilar-campo="nome" data-indice="${i}" aria-label="Nome do pilar ${i + 1}">
          <select data-pilar-campo="cor" data-indice="${i}" aria-label="Cor do pilar ${i + 1}">${opcoes([1, 2, 3, 4, 5, 6].map((c) => ({ id: c, nome: `Cor ${c}` })), p.cor)}</select>
          <button class="botao-icone botao-icone-p bloco-remover" type="button" data-acao="yt-pilar-remover" data-indice="${i}" aria-label="Remover pilar ${esc(p.nome)}">×</button>
        </li>`).join('')}</ul>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="yt-pilar-novo">+ Pilar</button>

      <h2 class="card-titulo">Meta de publicação</h2>
      <label class="campo campo-curto"><span class="campo-rotulo">Vídeos por semana</span>
        <select name="meta">${opcoes([1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: n, nome: String(n) })), cfg.meta)}</select></label>

      <h2 class="card-titulo">Modelo de descrição</h2>
      <label class="campo"><span class="campo-rotulo">Texto que entra em todo vídeo</span>
        <textarea name="modeloDescricao" rows="9" maxlength="5000">${esc(cfg.modeloDescricao)}</textarea>
        <span class="campo-ajuda">Use {{resumo}} (o gancho do vídeo), {{titulo}} e {{capitulos}}. Ponha aqui seus links fixos e redes.</span></label>
      <label class="campo"><span class="campo-rotulo">Hashtags de sempre</span>
        <input name="hashtags" type="text" maxlength="200" value="${esc(cfg.hashtags)}" placeholder="#estudos #faculdade"></label>

      <h2 class="card-titulo">Itens a mais no checklist</h2>
      <label class="campo"><span class="campo-rotulo">Um por linha</span>
        <textarea name="checklistExtra" rows="4" maxlength="2000" placeholder="Postar no Instagram&#10;Responder comentários das primeiras 2 horas">${esc(cfg.checklistExtra.join('\n'))}</textarea></label>
      <p class="campo-ajuda" data-yt-salvo aria-live="polite">As mudanças salvam sozinhas.</p>
    </form>`;
}

function resumo(estado, cfg, agora) {
  const prox = proximoAPublicar(estado, agora);
  const meta = metaDaSemana(estado, cfg.meta, agora);
  const ativos = videosAtivos(estado);
  const emProducao = ativos.filter((v) => !['ideia', 'publicado'].includes(v.etapa)).length;
  const ideias = ativos.filter((v) => v.etapa === 'ideia').length;
  const atencao = precisaDeAtencao(estado, agora);
  return `
    <div class="painel yt-resumo">
      <section class="proximo bloco tam-2-3" aria-labelledby="yt-proximo">
        <div>
          <p class="proximo-rotulo">Próximo vídeo</p>
          <h2 class="proximo-titulo" id="yt-proximo">${prox ? esc(prox.titulo) : 'Nenhum vídeo com data marcada'}</h2>
          <p class="proximo-texto">${prox
            ? `${esc(NOME_ETAPA[prox.etapa])} · ${esc(contagemRegressiva(new Date(prox.data_publicacao).getTime(), agora))} para publicar`
            : 'Marque a data de publicação de um vídeo para ele aparecer aqui e no Calendário.'}</p>
        </div>
        ${prox ? `<a class="botao" href="#youtube/${esc(prox.id)}">Abrir</a>` : '<button class="botao" type="button" data-acao="yt-novo">Nova ideia</button>'}
      </section>
      <section class="card bloco tam-1-3" aria-labelledby="yt-meta">
        <div class="card-topo"><h2 class="card-titulo" id="yt-meta">Meta da semana</h2></div>
        <p class="revisao-total"><strong>${meta.marcados}</strong><span class="texto-suave">de ${meta.meta} ${meta.meta === 1 ? 'vídeo marcado' : 'vídeos marcados'} para esta semana</span></p>
        ${barraProgresso(Math.min(1, meta.marcados / meta.meta), 'Meta de publicação da semana')}
        <p class="texto-suave">${publicadosNoMes(estado, agora)} publicados este mês · ${emProducao} em produção · ${ideias} ${ideias === 1 ? 'ideia' : 'ideias'}</p>
      </section>
      ${atencao.length ? `
      <section class="card bloco tam-inteiro yt-atencao" aria-labelledby="yt-atencao">
        <div class="card-topo"><h2 class="card-titulo" id="yt-atencao">Precisa de atenção</h2></div>
        <ul class="prazos">${atencao.map(({ video, motivo }) => `
          <li class="prazo urg-${/passou|antes/.test(motivo) ? 'atrasado' : 'urgente'}">
            <span class="prazo-marca" aria-hidden="true"></span>
            <div><p class="prazo-titulo"><a href="#youtube/${esc(video.id)}">${esc(video.titulo)}</a></p><p class="prazo-meta">${esc(motivo)} · ${esc(NOME_ETAPA[video.etapa])}</p></div>
          </li>`).join('')}</ul>
      </section>` : ''}
    </div>`;
}

function painel(estado) {
  const agora = Date.now();
  const cfg = configDoCanal(estado);
  const visao = estado.ytVisao || cfg.visao;
  const vazio = !videosAtivos(estado).length;
  const corpo = {
    quadro: () => visaoQuadro(estado, cfg, agora),
    calendario: () => visaoCalendario(estado, agora),
    ideias: () => visaoIdeias(estado, cfg),
    desempenho: () => visaoDesempenho(estado),
    canal: () => visaoCanal(cfg),
  }[visao] || (() => visaoQuadro(estado, cfg, agora));
  return `
    ${cabecalho('YouTube', 'Ideias, roteiros, gravação, publicação e resultados do canal')}
    ${avisoDeMigracao()}
    <div class="acoes cal-acoes">
      <button class="botao botao-primario" type="button" data-acao="yt-novo">Nova ideia de vídeo</button>
    </div>
    ${resumo(estado, cfg, agora)}
    <div class="segmentado yt-visoes" role="tablist" aria-label="Partes do painel">${VISOES_CANAL.map((v) => `
      <button type="button" role="tab" data-acao="yt-visao" data-visao="${v.id}" aria-selected="${visao === v.id}" aria-pressed="${visao === v.id}">${v.nome}</button>`).join('')}
    </div>
    ${vazio && visao !== 'canal' && visao !== 'calendario' ? `
      <section class="card vazio">
        <div class="vazio-icone">${icone('youtube')}</div>
        <h2>Comece pelas ideias</h2>
        <p class="texto-suave">Anote as ideias de vídeo. Cada uma anda pelas etapas, de roteiro a publicado, com checklist, datas no Calendário e ajuda da IA.</p>
        <button class="botao botao-primario" type="button" data-acao="yt-novo">Nova ideia de vídeo</button>
      </section>` : corpo()}`;
}

export function renderYoutube(estado) {
  return estado.parametro ? renderPaginaVideo(estado) : painel(estado);
}

// Formulário rápido de ideia nova (na folha).
export function renderFormIdeia(estado, { dia = '' } = {}) {
  const cfg = configDoCanal(estado);
  return `
    <form class="formulario" data-form="yt-novo" data-dia="${esc(dia)}" novalidate>
      <label class="campo"><span class="campo-rotulo">Ideia de vídeo</span>
        <input name="titulo" type="text" maxlength="100" required placeholder="Ex.: Como eu organizo a semana de provas"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Formato</span><select name="formato">${opcoes(FORMATOS, 'longo')}</select></label>
        <label class="campo"><span class="campo-rotulo">Pilar</span><select name="pilar">${opcoes([{ id: '', nome: 'Nenhum' }, ...cfg.pilares], '')}</select></label>
      </div>
      ${dia ? `<p class="campo-ajuda">Vai com data de publicação em ${esc(fmtCurta.format(dataDaChave(dia)))}.</p>` : ''}
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
  const atencao = precisaDeAtencao(estado, agora);
  return `
    <section class="card" aria-labelledby="yt-inicio">
      <div class="card-topo">
        <h2 class="card-titulo" id="yt-inicio">YouTube</h2>
        <a class="card-link" href="#youtube">Abrir</a>
      </div>
      ${prox ? `<p class="plano-prova"><a href="#youtube/${esc(prox.id)}">${esc(prox.titulo)}</a></p><p class="texto-suave">${esc(NOME_ETAPA[prox.etapa])} · ${quandoPublica(prox, agora)}</p>` : '<p class="texto-suave">Nenhum vídeo com data de publicação.</p>'}
      ${atencao.length ? `<p class="texto-suave"><span class="chip urg-atrasado">${atencao.length} ${atencao.length === 1 ? 'pede' : 'pedem'} atenção</span></p>` : ''}
      <p class="texto-suave">${emProducao.length} em produção · ${ativos.filter((v) => v.etapa === 'ideia').length} ideias</p>
    </section>`;
}
