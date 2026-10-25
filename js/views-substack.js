// Tela Substack: painel com meta do mês, quadro de pautas por etapa (arrastar entre
// colunas) e o editor de cada texto (#substack/<id>), com referências da Biblioteca.

import { cabecalho, barraProgresso } from './componentes.js';
import { icone } from './icones.js';
import { esc, contagemRegressiva, urgencia } from './utilidades.js';
import { artigosAtivos, nomeStatus } from './dados-biblioteca.js';
import { opcoes } from './views-youtube.js';
import {
  ETAPAS_SUBSTACK, CHECKLIST_SUBSTACK, pautasAtivas, pautaPeloId, pautasDaEtapa, configSubstack, publicadosNoMesSubstack,
  proximaAgendada, estatisticasDoTexto, progressoChecklistSubstack, markdownParaHtml, nomeEtapaSubstack,
} from './dados-substack.js';

const fmtCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const ABAS = [
  { id: 'escrever', nome: 'Escrever' },
  { id: 'previa', nome: 'Prévia' },
  { id: 'pauta', nome: 'Pauta e referências' },
  { id: 'publicar', nome: 'Publicar' },
];

function quando(p, agora) {
  if (p.etapa === 'publicado') return p.publicado_em ? esc(`Publicado em ${fmtDia.format(new Date(p.publicado_em)).replace('.', '')}`) : 'Publicado';
  if (!p.agendado_para) return '';
  const t = new Date(p.agendado_para).getTime();
  return `<span class="chip urg-${urgencia(t, agora)}">${esc(contagemRegressiva(t, agora))}</span>`;
}

function cartao(p, agora) {
  const i = ETAPAS_SUBSTACK.findIndex((e) => e.id === p.etapa);
  const { palavras } = estatisticasDoTexto(p.texto);
  return `
    <li class="yt-cartao" data-pauta="${esc(p.id)}">
      <div class="yt-cartao-topo">
        <button class="yt-alca" type="button" data-ss-arrastar="${esc(p.id)}" aria-label="Arrastar ${esc(p.titulo)} para outra etapa" title="Segure e arraste para outra etapa">⠿</button>
        <a class="yt-cartao-link" href="#substack/${esc(p.id)}"><span class="yt-cartao-titulo">${esc(p.titulo)}</span></a>
      </div>
      <span class="yt-cartao-meta">${palavras ? `${palavras.toLocaleString('pt-BR')} palavras` : 'Sem texto ainda'}${(p.referencias || []).length ? ` · ${p.referencias.length} ref.` : ''}</span>
      ${quando(p, agora) ? `<span class="yt-cartao-meta">${quando(p, agora)}</span>` : ''}
      ${p.etapa === 'revisao' ? barraProgresso(progressoChecklistSubstack(p).fracao, `Checklist de ${p.titulo}`) : ''}
      <div class="yt-cartao-acoes">
        <button class="botao-icone botao-icone-p" type="button" data-acao="ss-etapa" data-id="${esc(p.id)}" data-passo="-1" aria-label="Voltar para ${esc(ETAPAS_SUBSTACK[Math.max(0, i - 1)].nome)}"${i <= 0 ? ' disabled' : ''}>‹</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="ss-etapa" data-id="${esc(p.id)}" data-passo="1" aria-label="Passar para ${esc(ETAPAS_SUBSTACK[Math.min(ETAPAS_SUBSTACK.length - 1, i + 1)].nome)}"${i >= ETAPAS_SUBSTACK.length - 1 ? ' disabled' : ''}>›</button>
      </div>
    </li>`;
}

function painel(estado) {
  const agora = Date.now();
  const cfg = configSubstack(estado);
  const doMes = publicadosNoMesSubstack(estado, agora).length;
  const prox = proximaAgendada(estado, agora);
  const ref = estado.substackReferencia && artigosAtivos(estado).find((a) => a.id === estado.substackReferencia);
  const vazio = !pautasAtivas(estado).length;
  return `
    ${cabecalho('Substack', 'Das ideias ao texto publicado')}
    ${ref ? `<div class="ava-alerta ss-ref-aviso" role="status">Escolha a pauta para ligar <strong>${esc(ref.titulo)}</strong> (ou crie uma nova).
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-ref-cancelar">Cancelar</button></div>` : ''}
    <div class="acoes cal-acoes"><button class="botao botao-primario" type="button" data-acao="ss-nova">Nova pauta</button></div>
    <div class="q-resumo">
      <section class="card">
        <p class="proximo-rotulo">Meta do mês</p>
        <p class="revisao-total"><strong>${doMes}</strong><span class="texto-suave">de ${cfg.porMes} ${cfg.porMes === 1 ? 'texto publicado' : 'textos publicados'}</span></p>
        ${barraProgresso(doMes / cfg.porMes, 'Meta de publicação do mês')}
        <label class="campo campo-curto campo-inline"><span class="campo-rotulo">Textos por mês</span>
          <input type="number" min="1" max="30" inputmode="numeric" data-ss-meta value="${cfg.porMes}"></label>
      </section>
      <section class="card">
        <p class="proximo-rotulo">Próxima publicação</p>
        ${prox ? `<p class="numerado-titulo"><a href="#substack/${esc(prox.id)}">${esc(prox.titulo)}</a></p>
          <p>${esc(fmtCurta.format(new Date(prox.agendado_para)))} · ${quando(prox, agora)}</p>
          <p class="campo-ajuda">${esc(nomeEtapaSubstack(prox.etapa))}</p>`
        : '<p class="texto-suave">Nada agendado. Escolha uma data na pauta para ela aparecer no Calendário, com aviso.</p>'}
      </section>
    </div>
    ${vazio ? `
      <section class="card vazio">
        <div class="vazio-icone">${icone('substack')}</div>
        <h2>Seu espaço de escrita</h2>
        <p class="texto-suave">Anote as ideias de texto. Cada uma anda de ideia a publicado, com editor, referências da Biblioteca, checklist e data no Calendário.</p>
        <button class="botao botao-primario" type="button" data-acao="ss-nova">Nova pauta</button>
      </section>` : `
    <p class="campo-ajuda">Segure <strong>⠿</strong> e arraste a pauta para outra etapa (ou use ‹ ›).</p>
    <div class="yt-quadro ss-quadro" aria-label="Pautas por etapa">${ETAPAS_SUBSTACK.map((e) => {
      const lista = pautasDaEtapa(estado, e.id);
      return `
      <section class="yt-coluna ss-coluna" data-etapa="${e.id}" aria-labelledby="ss-col-${e.id}">
        <h2 class="yt-coluna-titulo" id="ss-col-${e.id}">${esc(e.nome)} <span class="selo">${lista.length}</span></h2>
        ${lista.length ? `<ul class="yt-cartoes">${lista.map((p) => cartao(p, agora)).join('')}</ul>` : '<p class="texto-suave yt-vazio">Solte uma pauta aqui.</p>'}
        ${e.id === 'ideia' ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-nova">+ Ideia</button>' : ''}
      </section>`;
    }).join('')}</div>`}`;
}

function abaEscrever(p) {
  const est = estatisticasDoTexto(p.texto);
  const ferramentas = [
    ['negrito', '<strong>N</strong>', 'Negrito'],
    ['italico', '<em>I</em>', 'Itálico'],
    ['titulo', 'T', 'Intertítulo'],
    ['citacao', '❝', 'Citação'],
    ['lista', '•', 'Lista'],
    ['link', '🔗', 'Link'],
    ['divisor', '—', 'Divisor'],
  ];
  return `
    <div class="ss-editor">
      <div class="ss-texto">
        <label class="campo"><span class="campo-rotulo">Título</span>
          <input type="text" maxlength="200" data-ss-campo="titulo" value="${esc(p.titulo)}"></label>
        <label class="campo"><span class="campo-rotulo">Subtítulo</span>
          <input type="text" maxlength="300" data-ss-campo="subtitulo" value="${esc(p.subtitulo || '')}" placeholder="A frase que aparece embaixo do título e no e-mail"></label>
        <div class="ss-barra" role="toolbar" aria-label="Formatação">
          ${ferramentas.map(([id, rotulo, nome]) => `<button class="botao-icone" type="button" data-acao="ss-formatar" data-valor="${id}" aria-label="${nome}" title="${nome}">${rotulo}</button>`).join('')}
          <span class="campo-ajuda ss-contagem" id="ss-contagem">${est.palavras.toLocaleString('pt-BR')} palavras · ${est.minutos} min de leitura</span>
        </div>
        <textarea class="ss-area" id="ss-area" data-ss-campo="texto" rows="18" placeholder="Escreva aqui. Use **negrito**, *itálico*, ## intertítulo, > citação e - lista.">${esc(p.texto || '')}</textarea>
      </div>
      <aside class="ss-margem">
        <label class="campo"><span class="campo-rotulo">Notas da margem</span>
          <textarea rows="10" data-ss-campo="notas" maxlength="20000" placeholder="Ideias soltas, pontos a desenvolver, frases para usar.">${esc(p.notas || '')}</textarea></label>
      </aside>
    </div>`;
}

function abaPrevia(p) {
  return `
    <article class="card ss-previa">
      <h1>${esc(p.titulo)}</h1>
      ${p.subtitulo ? `<p class="ss-previa-sub">${esc(p.subtitulo)}</p>` : ''}
      ${markdownParaHtml(p.texto) || '<p class="texto-suave">Sem texto ainda.</p>'}
    </article>`;
}

function abaPauta(estado, p) {
  const ligadas = (p.referencias || []).map((id) => artigosAtivos(estado).find((a) => a.id === id)).filter(Boolean);
  const livres = artigosAtivos(estado).filter((a) => !(p.referencias || []).includes(a.id)).map((a) => ({ id: a.id, nome: a.titulo }));
  return `
    <section class="card">
      <h2 class="card-titulo">Referências da Biblioteca</h2>
      ${ligadas.length ? `<ul class="lista-simples">${ligadas.map((a) => `
        <li><a href="#biblioteca/${esc(a.id)}">${esc(a.titulo)} <small class="campo-ajuda">· ${esc(nomeStatus(a.status))}${a.destaques?.length ? ` · ${a.destaques.length} destaques` : ''}</small></a>
          <span><button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-ref-citar" data-id="${esc(a.id)}">Pôr no texto</button>
          <button class="botao-icone botao-icone-p" type="button" data-acao="ss-ref-tirar" data-id="${esc(a.id)}" aria-label="Tirar ${esc(a.titulo)} das referências">×</button></span></li>`).join('')}</ul>`
      : '<p class="texto-suave">Nenhuma referência ligada.</p>'}
      ${livres.length ? `<div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Ligar uma leitura</span><select id="ss-ref-escolha">${opcoes(livres, '')}</select></label>
        <button class="botao botao-secundario" type="button" data-acao="ss-ref-ligar">Ligar</button></div>`
      : '<p class="campo-ajuda">Salve leituras na <a href="#biblioteca">Biblioteca</a> para ligar aqui.</p>'}
      <p class="campo-ajuda">"Pôr no texto" leva o link e os destaques para as notas da margem.</p>
    </section>
    <section class="card">
      <label class="campo"><span class="campo-rotulo">Tags <small>(separe por vírgula)</small></span>
        <input type="text" maxlength="300" data-ss-campo="tags" value="${esc((p.tags || []).join(', '))}"></label>
      <label class="campo"><span class="campo-rotulo">Ângulo da pauta</span>
        <textarea rows="3" maxlength="2000" data-ss-detalhe="angulo" placeholder="Qual é a ideia central? Por que alguém vai querer ler?">${esc(p.detalhes?.angulo || '')}</textarea></label>
      <label class="campo"><span class="campo-rotulo">Para quem</span>
        <input type="text" maxlength="300" data-ss-detalhe="publico" value="${esc(p.detalhes?.publico || '')}"></label>
    </section>`;
}

function valorDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function abaPublicar(p) {
  return `
    <section class="card">
      <h2 class="card-titulo">Checklist</h2>
      <ul class="lista-marcar">${CHECKLIST_SUBSTACK.map((c) => `
        <li><label class="campo-marcar"><input type="checkbox" data-ss-check="${c.id}"${p.checklist?.[c.id] ? ' checked' : ''}><span>${esc(c.texto)}</span></label></li>`).join('')}</ul>
    </section>
    <section class="card">
      <label class="campo"><span class="campo-rotulo">Data para publicar</span>
        <input type="datetime-local" data-ss-campo="agendado_para" value="${esc(valorDataHora(p.agendado_para))}"></label>
      <p class="campo-ajuda">A data entra no Calendário (com os avisos de prazo).</p>
      <label class="campo"><span class="campo-rotulo">Link do texto publicado</span>
        <input type="url" maxlength="2000" data-ss-campo="link" value="${esc(p.link || '')}" placeholder="https://….substack.com/p/…"></label>
      <h3 class="ava-subtitulo">Levar para o Substack</h3>
      <div class="acoes">
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="ss-copiar" data-valor="html">Copiar formatado</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-copiar" data-valor="md">Copiar em Markdown</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-copiar" data-valor="texto">Copiar texto puro</button>
      </div>
      <p class="campo-ajuda">"Copiar formatado" mantém negrito, itálico, intertítulos, citações e links ao colar no editor do Substack.</p>
      ${p.etapa !== 'publicado' ? '<button class="botao botao-primario" type="button" data-acao="ss-publicado">Marcar como publicado</button>' : ''}
    </section>`;
}

function editor(estado, p) {
  const aba = ABAS.some((a) => a.id === estado.ssAba) ? estado.ssAba : 'escrever';
  const corpo = { escrever: () => abaEscrever(p), previa: () => abaPrevia(p), pauta: () => abaPauta(estado, p), publicar: () => abaPublicar(p) }[aba]();
  const ref = estado.substackReferencia && artigosAtivos(estado).find((a) => a.id === estado.substackReferencia);
  return `
    ${cabecalho(p.titulo, esc(nomeEtapaSubstack(p.etapa)))}
    ${ref && !(p.referencias || []).includes(ref.id) ? `<div class="ava-alerta ss-ref-aviso" role="status">Ligar <strong>${esc(ref.titulo)}</strong> a esta pauta?
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="ss-ref-ligar" data-id="${esc(ref.id)}">Ligar</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ss-ref-cancelar">Agora não</button></div>` : ''}
    <div class="acoes cal-acoes leitor-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#substack">← Substack</a>
      <label class="campo campo-curto campo-inline"><span class="campo-rotulo">Etapa</span>
        <select data-acao-mudar="ss-etapa">${opcoes(ETAPAS_SUBSTACK, p.etapa)}</select></label>
      <span class="caneta-salvo" id="ss-salvo" aria-live="polite"></span>
      <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="ss-excluir">Excluir</button>
    </div>
    <div class="segmentado" role="tablist" aria-label="Partes do texto">${ABAS.map((a) => `
      <button type="button" role="tab" data-acao="ss-aba" data-valor="${a.id}" aria-selected="${aba === a.id}" aria-pressed="${aba === a.id}">${a.nome}</button>`).join('')}
    </div>
    ${corpo}`;
}

export function renderSubstack(estado) {
  if (estado.parametro) {
    const p = pautaPeloId(estado, estado.parametro);
    if (!p) {
      return `${cabecalho('Substack')}<section class="card"><p class="texto-suave">Esta pauta não foi encontrada.</p>
        <a class="botao botao-secundario" href="#substack">Voltar</a></section>`;
    }
    return editor(estado, p);
  }
  return painel(estado);
}

export function renderFormPauta() {
  return `
    <form class="formulario" data-form="ss-nova" novalidate>
      <label class="campo"><span class="campo-rotulo">Ideia de texto</span>
        <input name="titulo" type="text" maxlength="200" required placeholder="Ex.: O que aprendi organizando meus estudos"></label>
      <label class="campo"><span class="campo-rotulo">Ângulo <small>(opcional)</small></span>
        <textarea name="angulo" rows="2" maxlength="2000" placeholder="A ideia central em uma frase."></textarea></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Guardar pauta</button>
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

// Card do Início: meta do mês e próxima publicação.
export function cardSubstackInicio(estado, agora = Date.now()) {
  if (!pautasAtivas(estado).length) return '';
  const cfg = configSubstack(estado);
  const doMes = publicadosNoMesSubstack(estado, agora).length;
  const prox = proximaAgendada(estado, agora);
  const emRascunho = pautasDaEtapa(estado, 'rascunho').length + pautasDaEtapa(estado, 'revisao').length;
  return `
    <section class="card" aria-labelledby="substack-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="substack-titulo">Substack</h2>
        <a class="card-link" href="#substack">Abrir</a>
      </div>
      <p class="revisao-total"><strong>${doMes}/${cfg.porMes}</strong><span class="texto-suave">publicados este mês</span></p>
      ${barraProgresso(doMes / cfg.porMes, 'Meta do Substack')}
      ${prox ? `<p><a href="#substack/${esc(prox.id)}">${esc(prox.titulo)}</a> · ${quando(prox, agora)}</p>` : ''}
      <p class="campo-ajuda">${emRascunho} em rascunho ou revisão.</p>
    </section>`;
}
