// Acompanhamento da R7 pelo robô do Google (Carol, 17/11/2026): o card "Esta semana" no topo da R7, a
// tela da demanda de vídeos (#r7/videos) e a configuração do robô (em Ajustes da R7). Só desenha.

import { esc, haQuantoTempo } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { videosDoCliente, trelloDoCliente, frasesDoTrello, dadosDoRobo, pedidosDeVideo, textoDaDemanda, clientesDosBriefings, ehDoCliente, comBriefingsAnexados, briefingsAnexados } from './dados-robo.js';
import { PREFIXO_CRONOGRAMA, normalizarCronograma, resumoDoQueFalta, frasesDoQueFalta, periodoEmTexto } from './dados-cronograma.js';

const hojeIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const quando = (iso) => {
  if (!iso) return '';
  const t = haQuantoTempo(Date.parse(iso));
  return /este minuto|agora/.test(t) ? 'agora há pouco' : t;
};

// As linhas da demanda de vídeos (uma por cliente da R7 que tem briefing).
export const videosDaDemanda = (config) => comBriefingsAnexados(dadosDoRobo(config, 'videos'), briefingsAnexados(config));

export function linhasDaDemanda(estado, clientes, fichaDe) {
  const robo = videosDaDemanda(estado.config);
  const pedidos = pedidosDeVideo(estado.config);
  const escolha = estado.r7VideosEscolha || {};
  return clientes.map((c) => {
    const f = fichaDe(c);
    const v = videosDoCliente(c.nome, robo, pedidos, { porSemana: f.rotina.videos?.porSemana || 2, hoje: hojeIso() });
    const mes = v.briefing?.mes || '';
    const pedir = escolha[c.chave] ? (v.briefing?.videos || []).filter((x) => escolha[c.chave].includes(x.n)) : v.pedir;
    return { chave: c.chave, nome: c.nome, mes, ...v, pedir };
  });
}

export function trelloDe(estado, c, f) {
  return trelloDoCliente(dadosDoRobo(estado.config, 'trello'), { nome: c.nome, lista: f.equipe.lista }, hojeIso());
}
export const linhaDoTrello = (estado, c, f) => frasesDoTrello(trelloDe(estado, c, f));

// Card "Esta semana" no topo da lista da R7.
export function cardSemanaR7(estado, clientes, fichaDe) {
  const videos = videosDaDemanda(estado.config);
  const trello = dadosDoRobo(estado.config, 'trello');
  const hoje = hojeIso();
  const ate = new Date(Date.parse(`${hoje}T12:00:00Z`) + 10 * 864e5).toISOString().slice(0, 10);
  const crons = (estado.config || []).filter((l) => !l.excluido_em && String(l.chave).startsWith(PREFIXO_CRONOGRAMA))
    .map((l) => normalizarCronograma(l.valor)).filter((c) => c.inicio > hoje && c.inicio <= ate);
  const porChave = new Map(clientes.map((c) => [c.chave, c]));
  const linhasCron = crons.map((cron) => {
    const c = porChave.get(cron.cliente);
    if (!c) return null;
    const f = fichaDe(c);
    const r = resumoDoQueFalta(cron, { assinatura: f.identificacao.assinatura, voz: c.dados?.voz || {}, ficha: f });
    return { c, cron, r };
  }).filter(Boolean);
  const demanda = videos ? linhasDaDemanda(estado, clientes, fichaDe) : [];
  const pedir = demanda.filter((l) => l.pedir.length).length;
  const captar = demanda.filter((l) => l.captacao === 'acabou' || l.captacao === 'sem-briefing').length;
  const vencidas = trello ? clientes.reduce((n, c) => n + trelloDe(estado, c, fichaDe(c)).conta.vencida, 0) : 0;
  const ajustes = trello ? clientes.reduce((n, c) => n + trelloDe(estado, c, fichaDe(c)).conta.ajuste, 0) : 0;
  const doBriefing = videos ? clientesDosBriefings(videos, { hoje }) : [];
  const quadros = trello?.quadros?.length || 0;
  const artes = (trello?.quadros || []).reduce((n, q) => n + (q.cartoes || []).reduce((m, c) => m + (c.anexos?.length || 0), 0), 0);
  const robo = videos || trello ? `<li><span class="r7-semana-rotulo">Robô</span><span>${[videos && `${doBriefing.length} ${doBriefing.length === 1 ? 'cliente' : 'clientes'} nos briefings`, trello && `${quadros} ${quadros === 1 ? 'quadro' : 'quadros'} no Trello`, artes && `${artes} ${artes === 1 ? 'arte' : 'artes'} dos designers`].filter(Boolean).join(' · ')}</span></li>` : '';
  return `
    <section class="card r7-semana" aria-labelledby="r7-semana-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="r7-semana-titulo">Esta semana</h2>
        <span class="campo-ajuda">${videos?.recebido_em || trello ? `Robô: Drive lido ${videos?.recebido_em ? esc(quando(videos.recebido_em)) : '(ainda não)'} · Trello lido ${trello ? esc(quando(trello.recebido_em)) : '(ainda não)'}` : 'Robô do Google desligado'}</span></div>
      <ul class="r7-semana-lista">
        ${robo}
        <li><span class="r7-semana-rotulo">Cronogramas</span><span>${linhasCron.length ? linhasCron.map(({ c, cron, r }) => `<a href="#r7/cronograma:${esc(c.chave)}:${esc(cron.inicio)}">${esc(c.nome)}</a> <small>${esc(frasesDoQueFalta(r))}${cron.marcas?.finalizado ? ' · finalizado' : ''}</small>`).join('<br>') : 'Nenhum cronograma começando nos próximos 10 dias.'}</span></li>
        <li><span class="r7-semana-rotulo">Vídeos</span><span>${videos ? `<a href="#r7/videos">${pedir ? `${pedir} ${pedir === 1 ? 'cliente com vídeo' : 'clientes com vídeos'} para pedir` : 'Nada para pedir agora'}</a>${captar ? ` <small>· ${captar} ${captar === 1 ? 'precisa' : 'precisam'} de nova captação</small>` : ''}` : 'Ligue o robô em "Ajustes da R7" e a demanda de segunda sai pronta.'}</span></li>
        <li><span class="r7-semana-rotulo">Design</span><span>${trello ? (vencidas || ajustes ? `${vencidas ? `${vencidas} ${vencidas === 1 ? 'peça vencida' : 'peças vencidas'}` : ''}${vencidas && ajustes ? ' · ' : ''}${ajustes ? `${ajustes} em ajuste` : ''}` : 'Tudo no prazo com os designers.') : 'O Trello da R7 entra quando o robô estiver ligado.'}</span></li>
      </ul>
    </section>`;
}

// Tela da demanda de vídeos de segunda.
export function telaVideos(estado, clientes, fichaDe) {
  const robo = videosDaDemanda(estado.config);
  const voltar = '<a class="botao botao-secundario" href="#r7">← R7</a>';
  const linhas = linhasDaDemanda(estado, clientes, fichaDe);
  const texto = textoDaDemanda(linhas);
  const escolha = estado.r7VideosEscolha || {};
  return `
    ${cabecalho('Demanda de vídeos', `${robo?.recebido_em ? `Briefings lidos ${esc(quando(robo.recebido_em))}. ` : 'O robô ainda não mandou os briefings; anexe o de cada cliente. '}Os 2 próximos que ainda não foram editados, na ordem do briefing.`, voltar)}
    <div class="r7-videos-grade">
      <section class="r7-videos-lista" aria-label="Clientes">
        ${linhas.map((l) => `
          <article class="card r7-video-cliente">
            <div class="card-topo"><h3 class="card-titulo">${esc(l.nome)}</h3>
              ${l.captacao === 'sem-briefing' ? '<span class="selo">sem briefing</span>' : l.captacao === 'acabou' ? '<span class="selo">pedir captação</span>' : l.captacao === 'acabando' ? '<span class="selo">acabando</span>' : ''}</div>
            ${l.briefing ? `
              <p class="campo-ajuda">Briefing de ${esc(nomeMes(l.mes))} · ${plural(l.briefing.videos.filter((v) => v.estado === 'usado').length, 'usado', 'usados')} · ${plural(l.estoque, 'editado', 'editados')} no estoque · ${l.restam === 1 ? 'resta 1' : `restam ${l.restam}`}${l.semanas ? ` (${l.semanas} ${l.semanas === 1 ? 'semana' : 'semanas'})` : ''}</p>
              <ul class="r7-video-numeros">${l.briefing.videos.map((v) => `
                <li><label class="r7-video-num r7-video-${v.estado}${v.atrasado ? ' r7-video-atrasado' : ''}" title="${esc(`${v.titulo || ''} · ${ROTULO[v.estado]}`)}">
                  ${v.estado === 'falta' ? `<input type="checkbox" data-acao-mudar="r7v-escolher" data-cliente="${esc(l.chave)}" value="${v.n}"${(escolha[l.chave] ? escolha[l.chave].includes(v.n) : l.pedir.some((p) => p.n === v.n)) ? ' checked' : ''}>` : ''}
                  <b>${v.n}</b><small>${esc(v.tipo)}</small></label></li>`).join('')}</ul>
              ${l.atrasados?.length ? `<p class="campo-ajuda r7-video-alerta">Pedido há mais de 7 dias e ainda não chegou: ${l.atrasados.map((v) => `vídeo ${v.n}`).join(', ')}.</p>` : ''}
              ${l.briefing.anexado ? `<p class="campo-ajuda">Briefing anexado por você${l.briefing.original ? `: ${esc(l.briefing.original)}` : ''}.</p>` : ''}` : '<p class="texto-suave">Sem briefing com vídeos para pedir. Se o cliente mandou um briefing novo e o robô não achou, anexe aqui.</p>'}
            <div class="acoes r7-video-acoes">
              ${l.pedir.length ? `<button class="botao botao-primario botao-pequeno" type="button" data-acao="r7v-solicitado" data-cliente="${esc(l.chave)}">Vídeo solicitado</button>` : ''}
              <label class="botao botao-secundario botao-pequeno cron-arquivo">Anexar briefing
                <input type="file" accept=".docx,.pdf,.txt,.md,application/pdf,text/plain" data-acao-mudar="r7v-briefing" data-cliente="${esc(l.chave)}"></label>
              <select class="r7-video-mes" aria-label="Mês do briefing" data-r7v-mes="${esc(l.chave)}">${mesesParaBriefing().map(([v, t], i) => `<option value="${v}"${i === 0 ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
            </div>
          </article>`).join('') || '<section class="card"><p class="texto-suave">Nenhum cliente da R7 cadastrado ainda.</p></section>'}
      </section>
      <aside class="card r7-videos-pedido">
        <h2 class="card-titulo">O pedido</h2>
        <textarea class="r7-videos-texto" rows="12" readonly aria-label="Texto do pedido">${esc(texto || 'Nada para pedir agora.')}</textarea>
        <div class="acoes">
          <button class="botao botao-secundario" type="button" data-acao="r7v-copiar"${texto ? '' : ' disabled'}>Copiar</button>
          <a class="botao botao-secundario" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener"${texto ? '' : ' aria-disabled="true"'}>Abrir no WhatsApp</a>
          <button class="botao botao-primario" type="button" data-acao="r7v-enviado"${texto ? '' : ' disabled'}>Pedido enviado</button>
        </div>
        <p class="campo-ajuda">"Pedido enviado" marca os vídeos de todos como pedidos hoje; "Vídeo solicitado", só os do cliente. Na hora, a demanda já passa para os próximos. Se o editado não aparecer na pasta em 7 dias, o app avisa.</p>
      </aside>
    </div>`;
}

// O mês do briefing anexado: este mês, o seguinte e o anterior.
function mesesParaBriefing() {
  const d = new Date();
  return [0, 1, -1].map((k) => {
    const x = new Date(d.getFullYear(), d.getMonth() + k, 1);
    const v = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    return [v, `Briefing de ${nomeMes(v)}`];
  });
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const ROTULO = { usado: 'já postado', editado: 'editado, no estoque', pedido: 'pedido', falta: 'falta editar' };
const nomeMes = (am) => ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][Number(String(am).slice(5, 7)) - 1] || '';

// Configuração do robô (dentro de "Ajustes da R7").
export function cardRobo(estado, { supabaseUrl, chaveTrello }) {
  const ligado = (estado.config || []).some((c) => c.chave === 'robo_r7' && !c.excluido_em && c.valor?.hash);
  const codigo = estado.roboCodigo || '';
  const autorizar = chaveTrello ? `https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=${encodeURIComponent('Bússola (robô da R7)')}&key=${encodeURIComponent(chaveTrello)}` : '';
  return `
    <div class="r7-robo">
      <h3 class="ava-subtitulo">Robô do Google</h3>
      <p class="campo-ajuda">Um robô que roda de graça na sua conta Google: toda segunda às 6h lê os briefings e os vídeos editados no Drive, e de 2 em 2 horas lê o Trello da R7. Só leitura, sem gastar crédito da Netlify.</p>
      ${codigo ? `<div class="ava-sucesso"><strong>Código do robô (aparece só agora):</strong><code class="r7-robo-codigo">${esc(codigo)}</code>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="r7-copiar" data-valor="${esc(codigo)}">Copiar o código</button></div>` : ''}
      <ol class="r7-robo-passos">
        <li>${ligado && !codigo ? 'Robô ligado. ' : ''}<button class="botao ${ligado ? 'botao-secundario' : 'botao-primario'} botao-pequeno" type="button" data-acao="robo-gerar">${ligado ? 'Gerar outro código' : 'Gerar o código do robô'}</button></li>
        <li>Abra <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a>, apague o que vier e cole o script. <button class="botao botao-secundario botao-pequeno" type="button" data-acao="robo-script">Copiar o script</button></li>
        <li>Em Configurações do projeto → Propriedades do script, crie:
          <ul class="r7-robo-props">
            <li><code>BUSSOLA_SUPABASE_URL</code> = <code>${esc(supabaseUrl || '(entre no app para ver)')}</code> <button class="botao-icone" type="button" data-acao="robo-copiar-prop" data-prop="url" aria-label="Copiar o endereço">⧉</button></li>
            <li><code>BUSSOLA_CHAVE_PUBLICA</code> = a chave pública <button class="botao-icone" type="button" data-acao="robo-copiar-prop" data-prop="chave" aria-label="Copiar a chave pública">⧉</button></li>
            <li><code>BUSSOLA_CODIGO</code> = o código do passo 1</li>
            <li><code>PASTA_BRIEFINGS</code> = o id da pasta dos briefings (o que vem depois de /folders/ no endereço)</li>
            <li><code>TRELLO_CHAVE</code> = <code>${esc(chaveTrello || '(a chave do Trello da Bússola)')}</code></li>
            <li><code>TRELLO_TOKEN</code> = entre no Trello com a <b>conta da R7</b> e ${autorizar ? `<a href="${esc(autorizar)}" target="_blank" rel="noopener">autorize só leitura</a>` : 'autorize só leitura'}; copie o token que aparecer</li>
          </ul></li>
        <li>No editor, escolha a função <code>instalar</code> e toque em Executar (o Google pede para autorizar a sua conta). Depois rode <code>testar</code>.</li>
      </ol>
    </div>`;
}
