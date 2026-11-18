// Cronograma da quinzena da R7 (17 e 18/11/2026): #r7/cronograma:<cliente>[:<início>]. Só desenha; as ações
// ficam em eventos-cronograma.js e a lógica em dados-cronograma.js.
// Desenho (Carol, 18/11/2026: "agradável, nada bagunçado"): uma linha do tempo por dia, cada peça fechada
// mostra só tipo, tema, artes e um status; abre para editar. As ações ficam juntas em cima e a entrega ao lado.

import { esc } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { especialidade } from './especialidades.js';
import {
  TIPOS_PECA, FORMATOS_POST, chaveDoCronograma, cronogramasDoCliente, normalizarCronograma, periodoPadrao, periodoEmTexto,
  oQueFalta, resumoDoQueFalta, frasesDoQueFalta, ddmm, nomeDoDia, formatoDaPeca, lerLaminas, lerTelas, CHECKLIST_FINAL,
} from './dados-cronograma.js';

const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

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
  const voltar = `<a class="botao botao-secundario" href="#r7/cliente:${esc(c.chave)}">← ${esc(c.nome)}</a>`;
  if (!cron) {
    return `
      ${cabecalho('Cronograma', c.nome, voltar)}
      <div class="cron-vazio">
        ${cardSubir(c, null, estado, true)}
        ${cardNovo(c)}
      </div>`;
  }
  const ctx = contextoDoCliente(c, f);
  const r = resumoDoQueFalta(cron, ctx);
  const outros = cronogramasDoCliente(estado.config || [], c.chave).filter((x) => x.inicio !== cron.inicio);
  return `
    ${cabecalho('Cronograma', `${c.nome} · ${periodoEmTexto(cron.inicio, cron.fim)}`, voltar)}
    <div class="cron-grade">
      <div class="cron-principal">
        ${resumoNoTopo(c, cron, r)}
        ${cardSubir(c, cron, estado, false)}
        ${linhaDoTempo(c, cron, r, estado)}
        <details class="cron-mais-peca">
          <summary>+ Pôr uma peça</summary>
          <form class="formulario cron-mais-form" data-form="cron-peca-nova" data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}" novalidate>
            <label class="campo"><span class="campo-rotulo">Dia</span><input name="data" type="date" min="${esc(cron.inicio)}" max="${esc(cron.fim)}" value="${esc(cron.inicio)}" required></label>
            <label class="campo"><span class="campo-rotulo">Tipo</span><select name="tipo">${TIPOS_PECA.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
            <div class="acoes"><button class="botao botao-secundario" type="submit">Pôr no cronograma</button></div>
          </form>
        </details>
      </div>
      <aside class="cron-lado" id="cron-previa">
        <section class="card cron-previa" aria-labelledby="cron-previa-titulo">
          <div class="cron-previa-topo">
            <h2 class="card-titulo" id="cron-previa-titulo">Cronograma montado</h2>
            <div class="cron-baixar">
              <button class="botao botao-primario botao-pequeno" type="button" data-acao="cron-baixar" data-tipo="pdf" data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}"${estado.cronOcupado ? ' disabled' : ''}>Baixar PDF</button>
              <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-baixar" data-tipo="pptx" data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}"${estado.cronOcupado ? ' disabled' : ''}>PPTX</button>
            </div>
          </div>
          <p class="campo-ajuda">Do jeito que vai para o cliente. Muda sozinho enquanto você edita.</p>
          <div class="cron-previa-slides" data-previa="${esc(c.chave)}|${esc(cron.inicio)}"><p class="campo-ajuda">Montando a prévia…</p></div>
        </section>
        <details class="card cron-periodos">
          <summary class="card-titulo">Outros períodos</summary>
          ${outros.length ? `<ul class="cron-outros">${outros.slice(0, 8).map((o) => `
            <li><a href="#r7/cronograma:${esc(c.chave)}:${esc(o.inicio)}">${esc(periodoEmTexto(o.inicio, o.fim))}</a><small>${esc(frasesDoQueFalta(resumoDoQueFalta(o, ctx)))}</small></li>`).join('')}</ul>` : '<p class="campo-ajuda">Nenhum outro ainda.</p>'}
          ${formNovo(c)}
        </details>
      </aside>
    </div>`;
}

// O topo: três números, a barra, as etapas da entrega e o que copiar.
function resumoNoTopo(c, cron, r) {
  const pct = r.total ? Math.round((r.prontas / r.total) * 100) : 0;
  const feed = cron.pecas.filter((p) => p.tipo === 'post' || p.tipo === 'reels').length;
  const stories = cron.pecas.length - feed;
  const k = `data-cliente="${esc(c.chave)}" data-inicio="${esc(cron.inicio)}"`;
  const etapas = [['esboco', 'Esboço à R7', 'ter e qua'], ['finalizado', 'Finalizado', 'quinta'], ['enviado', 'Enviado ao cliente', 'sexta, 12h']];
  const feitos = Object.values(cron.checklist || {}).filter(Boolean).length;
  return `
    <section class="card cron-topo cron-entregar" aria-label="Resumo do cronograma">
      <div class="cron-topo-numeros">
        <div><strong class="num">${feed}</strong><span>${feed === 1 ? 'post no feed' : 'posts no feed'}</span></div>
        <div><strong class="num">${stories}</strong><span>${stories === 1 ? 'sequência de stories' : 'sequências de stories'}</span></div>
        <div><strong class="num">${r.prontas}<small>/${r.total}</small></strong><span>prontas</span></div>
      </div>
      <div class="cron-progresso" role="img" aria-label="${r.prontas} de ${r.total} peças prontas"><span style="width:${pct}%"></span></div>
      <p class="cron-topo-frase">${r.legendas || r.outros || r.atencao ? esc(frasesDoQueFalta(r)) : 'Tudo pronto para entregar.'}</p>
      <ul class="cron-etapas cron-etapas-linha">${etapas.map(([id, nome, quando]) => `
        <li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-marca" data-marca="${id}" ${k}${cron.marcas?.[id] ? ' checked' : ''}><span>${esc(nome)}<small>${cron.marcas?.[id] ? esc(marca(cron, id)) : esc(quando)}</small></span></label></li>`).join('')}</ul>
      <div class="cron-topo-acoes">
        <button class="cron-link" type="button" data-acao="cron-whatsapp" ${k}>Copiar o texto do WhatsApp</button>
        <button class="cron-link" type="button" data-acao="cron-drive" ${k}>Copiar os nomes do Drive</button>
        <a class="cron-link cron-ir-previa" href="#cron-previa">Ver o cronograma montado</a>
      </div>
      <details class="cron-checklist">
        <summary>Checklist final · ${feitos} de ${CHECKLIST_FINAL.length}</summary>
        <ul class="cron-etapas">${CHECKLIST_FINAL.map((t, i) => `
          <li><label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-check" data-item="${i}" ${k}${cron.checklist?.[i] ? ' checked' : ''}><span>${esc(t)}</span></label></li>`).join('')}</ul>
      </details>
    </section>`;
}

// Subir o documento: em destaque quando ainda não há cronograma; depois, uma faixa discreta com as outras formas.
function cardSubir(c, cron, estado, grande) {
  const k = `data-cliente="${esc(c.chave)}"${cron ? ` data-inicio="${esc(cron.inicio)}"` : ''}`;
  const ocupado = estado.cronOcupado || '';
  const semLeitura = estado.cronDocSemLeitura?.cliente === c.chave ? estado.cronDocSemLeitura : null;
  const r = cron ? resumoDoQueFalta(cron, {}) : null;
  const botao = `
    <label class="botao botao-primario cron-arquivo${ocupado ? ' cron-desligado' : ''}">${grande ? 'Escolher o arquivo' : 'Subir uma versão nova'}
      <input type="file" accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain" data-acao-mudar="cron-documento" ${k}${ocupado ? ' disabled' : ''}></label>`;
  return `
    <section class="card cron-subir${grande ? ' cron-subir-grande' : ''}" aria-labelledby="cron-subir-titulo">
      ${grande ? `
        <div class="cron-subir-icone" aria-hidden="true">↑</div>
        <h2 class="cron-subir-titulo" id="cron-subir-titulo">Suba o cronograma da quinzena</h2>
        <p class="cron-subir-texto">O PDF do cronograma pronto (com as artes) ou o documento que você montou no Claude. A Bússola lê, monta tudo no visual da R7 e mostra o que falta.</p>
        <div class="acoes cron-subir-acoes">${botao}</div>` : `
        <div class="cron-faixa">
          <h2 class="card-titulo" id="cron-subir-titulo">Atualizar</h2>
          <div class="acoes">${botao}</div>
        </div>`}
      ${ocupado ? `<p class="cron-status" role="status"><span class="cron-girando" aria-hidden="true"></span>${esc(ocupado)}</p>` : ''}
      ${semLeitura ? `
        <div class="cron-aviso" role="status">
          <p><strong>Não consegui ler "${esc(semLeitura.nome)}" sozinha.</strong> A IA pode organizar o documento no formato da Bússola, sem mudar nenhuma palavra. Leva alguns minutos.</p>
          <div class="acoes">
            <button class="botao botao-primario botao-pequeno" type="button" data-acao="cron-doc-ia" ${k}${ocupado ? ' disabled' : ''}>Organizar com a IA</button>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-doc-cancelar">Deixar para lá</button>
          </div>
        </div>` : ''}
      <details class="cron-outras-formas">
        <summary>Outras formas de montar</summary>
        <div class="cron-outras-lista">
          <div class="cron-outra">
            <p><strong>Formato do documento.</strong> Cole no projeto do cliente no Claude para ele já entregar do jeito que a Bússola lê.</p>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-formato">Copiar o formato</button>
          </div>
          ${cron ? `
          <div class="cron-outra cron-escrever">
            <p><strong>Pedido para o Claude.</strong> Leva a ficha, a voz, as regras e só o que falta.</p>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-pedido" ${k}>Copiar o pedido</button>
          </div>
          <form class="cron-outra formulario cron-colar" data-form="cron-colar" ${k} novalidate>
            <p><strong>Colar a resposta.</strong> Cada bloco cai no dia e no tipo certos.</p>
            <textarea name="resposta" rows="4" placeholder="### 23.11 · CARROSSEL&#10;Tema: …&#10;Legenda: …" aria-label="Resposta do Claude"></textarea>
            <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="submit">Encaixar no cronograma</button></div>
          </form>
          ${r?.legendas ? `
          <div class="cron-outra">
            <p><strong>Legendas que faltam.</strong> A IA escreve só as que faltam, na voz do cliente e com a assinatura.</p>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-ia" ${k}${ocupado ? ' disabled' : ''}>Escrever as ${r.legendas} ${r.legendas === 1 ? 'legenda que falta' : 'legendas que faltam'}</button>
          </div>` : ''}` : ''}
        </div>
      </details>
    </section>`;
}

function formNovo(c) {
  const p = periodoPadrao(hojeIso());
  return `
    <form class="formulario cron-novo-form" data-form="cron-novo" data-cliente="${esc(c.chave)}" novalidate>
      <div class="cron-periodo">
        <label class="campo"><span class="campo-rotulo">Começa</span><input name="inicio" type="date" value="${p.inicio}" required></label>
        <label class="campo"><span class="campo-rotulo">Termina</span><input name="fim" type="date" value="${p.fim}" required></label>
      </div>
      <div class="acoes"><button class="botao botao-secundario" type="submit">Montar a grade pela rotina</button></div>
    </form>`;
}

function cardNovo(c) {
  return `
    <details class="card cron-novo">
      <summary class="card-titulo">Ou montar a grade em branco, pela rotina da ficha</summary>
      ${formNovo(c)}
    </details>`;
}

// A linha do tempo: um bloco por dia, com as peças do dia.
function linhaDoTempo(c, cron, r, estado) {
  const abertas = new Set(estado.cronAbertas || []);
  const porDia = new Map();
  for (const x of r.itens) {
    if (!porDia.has(x.p.data)) porDia.set(x.p.data, []);
    porDia.get(x.p.data).push(x);
  }
  return `
    <section class="cron-dias" aria-label="Peças do cronograma">
      ${[...porDia.entries()].map(([data, itens]) => `
        <div class="cron-dia">
          <div class="cron-dia-data" aria-hidden="true"><strong>${data.slice(8, 10)}</strong><span>${MESES_CURTOS[Number(data.slice(5, 7)) - 1]} · ${nomeDoDia(data).slice(0, 3).toLowerCase()}</span></div>
          <div class="cron-dia-pecas">${itens.map((x) => cardPeca(c, x, abertas.has(x.p.id))).join('')}</div>
        </div>`).join('')}
    </section>`;
}

const marca = (cron, id) => cron.marcas?.[id] ? new Date(cron.marcas[id]).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

const campoTexto = (p, campo, rotulo, linhas = 3, ph = '') => `
  <label class="campo"><span class="campo-rotulo">${esc(rotulo)}</span>
    <textarea rows="${linhas}" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="${campo}"${ph ? ` placeholder="${esc(ph)}"` : ''}>${esc(p[campo] || '')}</textarea></label>`;
const campoLinha = (p, campo, rotulo, ph = '') => `
  <label class="campo"><span class="campo-rotulo">${esc(rotulo)}</span>
    <input type="text" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="${campo}" value="${esc(p[campo] || '')}"${ph ? ` placeholder="${esc(ph)}"` : ''}></label>`;

const ehStory = (p) => p.tipo === 'story' || p.tipo === 'bomdia';

// O status curto da peça fechada.
function statusDaPeca({ p, falta, atencao, pronta }) {
  if (pronta) return '<span class="cron-status-peca cron-ok">Pronta</span>';
  if (falta.length) return `<span class="cron-status-peca cron-falta">Falta ${esc(falta.join(', '))}</span>`;
  return `<span class="cron-status-peca cron-conferir">${p.pode ? 'Pronta' : plural(atencao.length, 'ponto para conferir', 'pontos para conferir')}</span>`;
}

function cardPeca(c, x, aberta) {
  const { p, falta, atencao } = x;
  const k = `data-cliente="${esc(c.chave)}" data-peca="${esc(p.id)}"`;
  const artes = p.artes || [];
  const contagem = p.tipo === 'post' && p.formato === 'carrossel' ? plural(lerLaminas(p.slides).length || artes.length, 'lâmina', 'lâminas')
    : ehStory(p) ? plural(Math.max(lerTelas(p.telas).length, artes.length), 'tela', 'telas') : '';
  const titulo = p.tema || (ehStory(p) ? 'Stories' : 'Sem tema ainda');
  let campos = '';
  if (p.tipo === 'post' || p.tipo === 'reels') {
    campos = `
      ${campoLinha(p, 'tema', 'Tema')}
      ${p.tipo === 'post' && p.formato === 'carrossel' ? campoTexto(p, 'slides', 'Lâminas', 6, 'Slide 01 | Capa (foto): texto') : ''}
      ${p.tipo === 'post' && p.formato !== 'carrossel' ? campoTexto(p, 'slides', 'Texto da arte', 2) : ''}
      ${p.tipo === 'reels' ? campoLinha(p, 'capa', 'Texto da capa') : ''}
      ${p.tipo === 'reels' ? campoLinha(p, 'video', 'Link do vídeo', 'https://…') : ''}
      ${campoTexto(p, 'legenda', 'Legenda', 7)}`;
  } else {
    campos = `
      ${campoLinha(p, 'tema', 'Tema')}
      ${campoTexto(p, 'telas', 'Telas', 4, 'Tela 1 (gancho): título | texto de apoio')}
      ${campoLinha(p, 'figurinha', 'O que entra por cima (separe com ;)', 'repost do post do dia; enquete Sim / Não; link de agendamento')}`;
  }
  return `
    <details class="cron-peca cron-${x.pronta ? 'pronta' : falta.length ? 'falta' : 'atencao'}" id="peca-${esc(p.id)}" data-peca-id="${esc(p.id)}"${aberta ? ' open' : ''}>
      <summary class="cron-peca-resumo">
        <span class="cron-tipo cron-tipo-${esc(p.tipo === 'post' ? p.formato || 'post' : p.tipo)}">${esc(formatoDaPeca(p))}</span>
        <span class="cron-peca-tema">${esc(titulo)}</span>
        ${statusDaPeca(x)}
        <span class="cron-peca-titulo visualmente-oculto">${esc(`${p.tipo === 'reels' ? 'REELS' : ehStory(p) ? (p.tipo === 'bomdia' ? 'STORIES DE BOM DIA' : 'STORY') : 'POSTAGEM'} - ${ddmm(p.data)} - ${nomeDoDia(p.data)}`)}</span>
        ${artes.length ? `<span class="cron-miniaturas${ehStory(p) || p.tipo === 'reels' ? ' cron-em-pe' : ''}">${artes.slice(0, 8).map((a, i) => `<img data-arte="${esc(a.caminho)}" alt="" loading="lazy" width="${ehStory(p) || p.tipo === 'reels' ? 36 : 48}" height="${ehStory(p) || p.tipo === 'reels' ? 64 : 48}"${i >= 6 ? ' class="cron-sobra"' : ''}>`).join('')}${artes.length > 8 ? `<small>+${artes.length - 8}</small>` : ''}</span>` : `<span class="cron-sem-arte">${contagem ? `${esc(contagem)} · ` : ''}sem arte ainda</span>`}
      </summary>
      <div class="cron-peca-corpo">
        ${atencao.length && !p.pode ? `<div class="cron-conferir-lista"><p>Para conferir</p><ul>${atencao.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
          <label class="campo-marcar"><input type="checkbox" data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="pode"><span>Pode seguir assim</span></label></div>` : ''}
        ${p.tipo === 'post' ? `<label class="campo cron-formato"><span class="campo-rotulo">Formato</span><select data-acao-mudar="cron-campo" data-peca="${esc(p.id)}" data-campo="formato">${FORMATOS_POST.map((f) => `<option value="${f.id}"${f.id === p.formato ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>` : ''}
        <div class="cron-campos">${campos}</div>
        ${tiraDeArtes(c, p)}
        <div class="cron-peca-acoes">
          ${p.tipo === 'post' && p.formato === 'carrossel' && p.slides ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-trello" ${k}>Copiar para o Trello</button>` : ''}
          ${p.tipo === 'story' && p.telas.trim() ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="cron-artes" ${k}>Copiar o pedido das artes</button>` : ''}
          <button class="cron-link cron-tirar" type="button" data-acao="cron-tirar" ${k}>Tirar do cronograma</button>
        </div>
      </div>
    </details>`;
}

// As artes da peça, na ordem, e o anexar: lâminas, telas dos stories, capa do reel, arte do estático.
function tiraDeArtes(c, p) {
  const artes = p.artes || [];
  const emPe = ehStory(p) || p.tipo === 'reels';
  const rotulo = ehStory(p) ? 'Artes (uma por tela, na ordem)' : p.tipo === 'reels' ? 'Capa do reel' : p.formato === 'carrossel' ? 'Artes das lâminas' : 'Arte';
  const k = `data-cliente="${esc(c.chave)}" data-peca="${esc(p.id)}"`;
  return `
    <div class="cron-artes">
      <div class="cron-artes-topo">
        <span class="campo-rotulo">${esc(rotulo)}${artes.some((a) => a.origem === 'trello') ? ' · vieram do Trello' : ''}</span>
        <div class="acoes">
          <label class="botao botao-secundario botao-pequeno cron-arquivo">${artes.length ? 'Trocar' : 'Anexar'}
            <input type="file" multiple accept="image/*,.pdf,application/pdf" data-acao-mudar="cron-artes" ${k}></label>
          ${artes.length ? `<button class="cron-link" type="button" data-acao="cron-artes-tirar" ${k}>Tirar</button>` : ''}
        </div>
      </div>
      ${artes.length ? `<ol class="cron-artes-lista${emPe ? ' cron-em-pe' : ''}">${artes.map((a, i) => `<li><img data-arte="${esc(a.caminho)}" alt="Arte ${i + 1}" loading="lazy" width="${emPe ? 96 : 120}" height="${emPe ? 170 : 120}"><small>${i + 1}</small></li>`).join('')}</ol>` : '<p class="campo-ajuda">Imagens ou PDF, na ordem do número no nome (S1_1, S1_2…). Os carrosséis chegam sozinhos do Trello quando o designer anexa.</p>'}
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

export { chaveDoCronograma, normalizarCronograma, especialidade, oQueFalta };
