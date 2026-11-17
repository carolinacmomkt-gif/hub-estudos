// Cronograma de 15 dias da R7 (Carol, 17/11/2026): #r7/cronograma:<cliente>[:<início>]. Só desenha; as
// ações ficam em eventos-cronograma.js e a lógica em dados-cronograma.js.

import { esc } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { especialidade } from './especialidades.js';
import {
  TIPOS_PECA, FORMATOS_POST, chaveDoCronograma, cronogramasDoCliente, normalizarCronograma, periodoPadrao, periodoEmTexto,
  tituloDaPeca, oQueFalta, resumoDoQueFalta, frasesDoQueFalta, ddmm, CHECKLIST_FINAL,
} from './dados-cronograma.js';

const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

// Contexto do "o que falta" a partir da ficha do cliente.
export function contextoDoCliente(c, f) {
  return { assinatura: f.identificacao.assinatura || '', voz: c.dados?.voz || {}, ficha: f };
}

// O cronograma aberto: o da rota, senão o mais recente do cliente.
export function cronogramaAberto(estado, chave, inicio) {
  const lista = cronogramasDoCliente(estado.config || [], chave);
  return (inicio ? lista.find((x) => x.inicio === inicio) : lista[0]) || null;
}

export function telaCronograma(estado, c, f, inicio) {
  const cron = cronogramaAberto(estado, c.chave, inicio);
  const voltar = `<a class="botao botao-secundario" href="#r7/cliente:${esc(c.chave)}">← Ficha</a>`;
  if (!cron) return `${cabecalho(`Cronograma · ${c.nome}`, 'Suba o conteúdo da quinzena que você montou no Claude, ou escolha o período e o app monta a grade pela rotina da ficha.', voltar)}${cardSubir(c, null, estado)}${cardNovo(c)}`;
  const ctx = contextoDoCliente(c, f);
  const r = resumoDoQueFalta(cron, ctx);
  const ocupado = estado.cronOcupado || '';
  const outros = cronogramasDoCliente(estado.config || [], c.chave).filter((x) => x.inicio !== cron.inicio);
  return `
    ${cabecalho(`Cronograma · ${c.nome}`, `${periodoEmTexto(cron.inicio, cron.fim)} · ${cron.pecas.length} peças · ${frasesDoQueFalta(r)}`, voltar)}
    <div class="cron-grade">
      <div class="cron-principal">
        ${cardSubir(c, cron, estado)}
        ${cardEscrever(c, cron, r, ocupado)}
        <section class="cron-pecas" aria-label="Peças do cronograma">
          ${r.itens.map((x) => cardPeca(c, x)).join('')}
        </section>
        <details class="card cron-mais">
          <summary class="card-titulo">+ Peça</summary>
          <form class="formulario cron-mais-form" data-form="cron-peca-nova" data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}" novalidate>
            <label class="campo"><span class="campo-rotulo">Dia</span><input name="data" type="date" min="${esc(cron.inicio)}" max="${esc(cron.fim)}" value="${esc(cron.inicio)}" required></label>
            <label class="campo"><span class="campo-rotulo">Tipo</span><select name="tipo">${TIPOS_PECA.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
            <div class="acoes"><button class="botao botao-secundario" type="submit">Pôr no cronograma</button></div>
          </form>
        </details>
      </div>
      <aside class="cron-lado">
        ${cardEntregar(c, cron, r, ocupado)}
        ${outros.length ? `<section class="card"><h2 class="card-titulo">Outros períodos</h2><ul class="lista-simples cron-outros">${outros.slice(0, 8).map((o) => `
          <li><a href="#r7/cronograma:${esc(c.chave)}:${esc(o.inicio)}">${esc(periodoEmTexto(o.inicio, o.fim))}</a><small>${esc(frasesDoQueFalta(resumoDoQueFalta(o, ctx)))}</small></li>`).join('')}</ul></section>` : ''}
        ${cardNovo(c, true)}
      </aside>
    </div>`;
}

// Subir o documento da quinzena (PDF, Word, PowerPoint ou texto) no formato que a Bússola lê.
function cardSubir(c, cron, estado) {
  const k = `data-cliente="${esc(c.chave)}"${cron ? ` data-inicio="${esc(cron.inicio)}"` : ''}`;
  const semLeitura = estado.cronDocSemLeitura;
  return `
    <section class="card cron-subir" aria-labelledby="cron-subir-titulo">
      <h2 class="card-titulo" id="cron-subir-titulo">Subir o conteúdo da quinzena</h2>
      <p class="campo-ajuda">O documento que você montou no Claude (PDF, Word, PowerPoint ou texto). A Bússola monta ${cron ? 'ou atualiza ' : ''}o cronograma no visual da R7: peças novas entram, as que já existem recebem o texto novo e as artes ficam.</p>
      <div class="acoes">
        <label class="botao botao-primario cron-arquivo">Escolher o documento
          <input type="file" accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain" data-acao-mudar="cron-documento" ${k}></label>
        <button class="botao botao-secundario" type="button" data-acao="cron-formato">Copiar o formato</button>
      </div>
      <p class="campo-ajuda">"Copiar o formato" leva as regras para você colar no projeto do cliente no Claude. Com o documento nesse formato, a leitura é na hora e sem IA.</p>
      ${semLeitura && semLeitura.cliente === c.chave ? `<div class="aviso-inline" role="status"><p>Não achei os blocos "23.11 · CARROSSEL" em "${esc(semLeitura.nome)}". A IA pode organizar o documento no formato (um toque, uma vez).</p>
        <div class="acoes"><button class="botao botao-primario botao-pequeno" type="button" data-acao="cron-doc-ia" ${k}${estado.cronOcupado ? ' disabled' : ''}>✨ Organizar com a IA</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-doc-cancelar">Deixar para lá</button></div></div>` : ''}
    </section>`;
}

function cardNovo(c, recolhido = false) {
  const p = periodoPadrao(hojeIso());
  const corpo = `
    <form class="formulario" data-form="cron-novo" data-cliente="${esc(c.chave)}" novalidate>
      <div class="cron-periodo">
        <label class="campo"><span class="campo-rotulo">Começa</span><input name="inicio" type="date" value="${p.inicio}" required></label>
        <label class="campo"><span class="campo-rotulo">Termina</span><input name="fim" type="date" value="${p.fim}" required></label>
      </div>
      <p class="campo-ajuda">O padrão é da próxima segunda à sexta da semana seguinte. No fim do ano dá para estender.</p>
      <div class="acoes"><button class="botao botao-primario" type="submit">Montar a grade</button></div>
    </form>`;
  return recolhido
    ? `<details class="card"><summary class="card-titulo">Novo período</summary>${corpo}</details>`
    : `<section class="card"><h2 class="card-titulo">Novo cronograma</h2>${corpo}</section>`;
}

function cardEscrever(c, cron, r, ocupado) {
  const k = `data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}"`;
  return `
    <section class="card cron-escrever" aria-labelledby="cron-escrever-titulo">
      <h2 class="card-titulo" id="cron-escrever-titulo">Escrever</h2>
      <ol class="cron-passos">
        <li><span><b>Peça ao Claude.</b> O pedido leva a ficha, a voz, as regras e só o que falta, no formato que o app lê de volta.</span>
          <button class="botao botao-secundario" type="button" data-acao="cron-pedido" ${k}>Copiar o pedido</button></li>
        <li><span><b>Cole a resposta.</b> Cada bloco cai no dia e no tipo certos; o que você já escreveu fica.</span>
          <form class="formulario cron-colar" data-form="cron-colar" ${k} novalidate>
            <textarea name="resposta" rows="4" placeholder="### 23.11 · POSTAGEM&#10;Tema: …&#10;Legenda: …"></textarea>
            <div class="acoes"><button class="botao botao-primario" type="submit">Encaixar no cronograma</button></div>
          </form></li>
        ${r.legendas ? `<li><span><b>Ou deixe a IA escrever as legendas.</b> Só as que faltam, duas por vez, na voz do cliente e com a assinatura.</span>
          <button class="botao botao-secundario" type="button" data-acao="cron-ia" ${k}${ocupado ? ' disabled' : ''}>✨ Escrever as ${r.legendas} ${r.legendas === 1 ? 'legenda que falta' : 'legendas que faltam'}</button></li>` : ''}
      </ol>
      ${ocupado ? `<p class="campo-ajuda" role="status">${esc(ocupado)}</p>` : ''}
    </section>`;
}

const marca = (cron, id) => cron.marcas?.[id] ? new Date(cron.marcas[id]).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

function cardEntregar(c, cron, r, ocupado) {
  const k = `data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}"`;
  const etapas = [['esboco', 'Esboço apresentado à R7', 'terça e quarta'], ['finalizado', 'Finalizado com os ajustes', 'quinta'], ['enviado', 'Enviado ao cliente', 'sexta, a partir das 12h']];
  return `
    <section class="card cron-entregar" aria-labelledby="cron-entregar-titulo">
      <h2 class="card-titulo" id="cron-entregar-titulo">Entregar</h2>
      <p class="cron-contagem"><strong class="num">${r.prontas}</strong> de ${r.total} peças prontas</p>
      <div class="r7-barra" role="img" aria-label="${r.prontas} de ${r.total}"><span style="width:${r.total ? Math.round((r.prontas / r.total) * 100) : 0}%"></span></div>
      <ul class="lista-simples cron-etapas">${etapas.map(([id, nome, quando]) => `
        <li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-marca" data-marca="${id}" ${k}${cron.marcas?.[id] ? ' checked' : ''}><span>${esc(nome)}<small>${cron.marcas?.[id] ? esc(marca(cron, id)) : esc(quando)}</small></span></label></li>`).join('')}</ul>
      <details class="cron-checklist"${Object.values(cron.checklist || {}).filter(Boolean).length < CHECKLIST_FINAL.length ? '' : ''}>
        <summary>Checklist final · ${Object.values(cron.checklist || {}).filter(Boolean).length} de ${CHECKLIST_FINAL.length}</summary>
        <ul class="lista-simples">${CHECKLIST_FINAL.map((t, i) => `
          <li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-check" data-item="${i}" ${k}${cron.checklist?.[i] ? ' checked' : ''}><span>${esc(t)}</span></label></li>`).join('')}</ul>
      </details>
      <div class="acoes cron-saidas">
        <button class="botao botao-primario" type="button" data-acao="cron-baixar" data-tipo="pdf" ${k}${ocupado ? ' disabled' : ''}>Baixar PDF</button>
        <button class="botao botao-secundario" type="button" data-acao="cron-baixar" data-tipo="pptx" ${k}${ocupado ? ' disabled' : ''}>Baixar PPTX</button>
        <button class="botao botao-secundario" type="button" data-acao="cron-whatsapp" ${k}>Copiar para o WhatsApp</button>
        <button class="botao botao-secundario" type="button" data-acao="cron-drive" ${k}>Copiar os nomes do Drive</button>
      </div>
      <p class="campo-ajuda">O PPTX abre no Google Slides. Os nomes do Drive seguem o manual: uma pasta por peça, na ordem de postagem.</p>
    </section>`;
}

const campoTexto = (p, campo, rotulo, linhas = 3, ph = '') => `
  <label class="campo"><span class="campo-rotulo">${esc(rotulo)}</span>
    <textarea rows="${linhas}" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="${campo}"${ph ? ` placeholder="${esc(ph)}"` : ''}>${esc(p[campo] || '')}</textarea></label>`;
const campoLinha = (p, campo, rotulo, ph = '') => `
  <label class="campo"><span class="campo-rotulo">${esc(rotulo)}</span>
    <input type="text" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="${campo}" value="${esc(p[campo] || '')}"${ph ? ` placeholder="${esc(ph)}"` : ''}></label>`;

function cardPeca(c, { p, falta, atencao, pronta }) {
  const k = `data-cliente="${esc(c.chave)}" data-peca="${esc(p.id)}"`;
  const estado = pronta ? 'pronta' : falta.length ? 'falta' : 'atencao';
  let campos = '';
  if (p.tipo === 'post' || p.tipo === 'reels') {
    campos = `
      ${campoLinha(p, 'tema', 'Tema')}
      ${p.tipo === 'reels' ? campoLinha(p, 'capa', 'Texto da capa', 'O texto que vai na capa do reel') : ''}
      ${campoTexto(p, 'legenda', 'Legenda', 6)}
      ${p.tipo === 'post' && p.formato === 'carrossel' ? campoTexto(p, 'slides', 'Lâminas (a copy de cada uma; vai para o Trello)', 5, 'Slide 01 | Capa (foto): texto') : ''}
      ${p.tipo === 'reels' ? campoLinha(p, 'video', 'Link do vídeo', 'https://…') : ''}`;
  } else {
    campos = `
      ${campoTexto(p, 'telas', p.tipo === 'bomdia' ? 'Telas' : 'Telas (de 3 a 5, uma ideia por tela)', 4, 'Tela 1 (gancho): título | texto de apoio')}
      ${campoLinha(p, 'figurinha', 'O que entra por cima (separe com ;)', 'repost do post do dia; enquete Sim / Não; link de agendamento')}`;
  }
  return `
    <article class="card cron-peca cron-${estado}" id="peca-${esc(p.id)}">
      <div class="cron-peca-topo">
        <div>
          <h3 class="cron-peca-titulo">${esc(tituloDaPeca(p))}</h3>
          <div class="cron-peca-tipo">
            ${p.tipo === 'post' ? `<select aria-label="Formato" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="formato">${FORMATOS_POST.map((f) => `<option value="${f.id}"${f.id === p.formato ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select>` : ''}
          </div>
        </div>
        <button class="botao-icone" type="button" data-acao="cron-tirar" ${k} aria-label="Tirar ${esc(tituloDaPeca(p))}">×</button>
      </div>
      <p class="cron-falta">${pronta ? '<span class="cron-ok">✓ Pronta</span>' : ''}${falta.map((x) => `<span class="cron-chip">Falta ${esc(x)}</span>`).join('')}${p.pode ? '' : atencao.map((x) => `<span class="cron-chip cron-chip-atencao">${esc(x)}</span>`).join('')}</p>
      ${campos}
      ${tiraDeArtes(c, p)}
      <div class="acoes cron-peca-acoes">
        ${p.tipo === 'post' && p.formato === 'carrossel' && p.slides ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-trello" ${k}>Copiar para o Trello</button>` : ''}
        ${p.tipo === 'story' && p.telas.trim() ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-artes" ${k}>Copiar o pedido das artes</button>` : ''}
        ${atencao.length && !falta.length ? `<label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="pode"${p.pode ? ' checked' : ''}><span>Pode seguir assim</span></label>` : ''}
      </div>
    </article>`;
}

// As artes da peça (miniaturas na ordem) e o botão de anexar: lâminas, telas dos stories, capa do reel.
function tiraDeArtes(c, p) {
  const artes = p.artes || [];
  const rotulo = p.tipo === 'story' || p.tipo === 'bomdia' ? 'Artes dos stories (uma por tela, na ordem)' : p.tipo === 'reels' ? 'Capa do reel' : p.formato === 'carrossel' ? 'Lâminas (na ordem)' : 'Arte';
  const k = `data-cliente="${esc(c.chave)}" data-peca="${esc(p.id)}"`;
  return `
    <div class="cron-artes">
      <span class="campo-rotulo">${esc(rotulo)}${artes.some((a) => a.origem === 'trello') ? ' · do Trello' : ''}</span>
      ${artes.length ? `<ol class="cron-artes-lista">${artes.map((a, i) => `<li><img data-arte="${esc(a.caminho)}" alt="Arte ${i + 1}" loading="lazy" width="72" height="${p.tipo === 'story' || p.tipo === 'bomdia' || p.tipo === 'reels' ? 128 : 90}"><small>${i + 1}</small></li>`).join('')}</ol>` : ''}
      <div class="acoes">
        <label class="botao botao-secundario botao-pequeno cron-arquivo">${artes.length ? 'Trocar as artes' : 'Anexar as artes'}
          <input type="file" multiple accept="image/*,.pdf,application/pdf" data-acao-mudar="cron-artes" ${k}></label>
        ${artes.length ? `<button class="botao-icone" type="button" data-acao="cron-artes-tirar" ${k} aria-label="Tirar as artes">×</button>` : ''}
      </div>
    </div>`;
}

// Linha do cliente na lista da R7: o cronograma em andamento e o que falta.
export function linhaDoCronograma(estado, c, f) {
  const cron = cronogramaAberto(estado, c.chave);
  if (!cron) return 'Sem cronograma';
  const r = resumoDoQueFalta(cron, contextoDoCliente(c, f));
  const enviado = cron.marcas?.enviado ? ' · enviado' : '';
  return `${ddmm(cron.inicio).replace('.', '/')} a ${ddmm(cron.fim).replace('.', '/')} · ${frasesDoQueFalta(r)}${enviado}`;
}

export { chaveDoCronograma, normalizarCronograma, especialidade };
