// Caixa de demandas: card no Hoje (aprovar, ajustar, descartar), a folha do que chegou
// compartilhado (WhatsApp e outros) e o card de conexão do Trello e do Notion em Configurações.

import { esc, haQuantoTempo } from './utilidades.js';
import { ORIGENS_DEMANDA, demandasAbertas, demandasMudadas } from './dados-demandas.js';
import { AREAS_TAREFA, PRIORIDADES } from './dados-tarefas.js';

const NO_CARD = 5;
const DIA_MS = 864e5;
const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const conexaoDe = (estado, servico) => (estado.conexoes || []).find((c) => c.servico === servico && !c.excluido_em);
const ligada = (c) => c && ['conectado', 'reconectar', 'erro'].includes(c.status);

export function hojeLocal(agora = Date.now()) {
  const d = new Date(agora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function textoPrazo(prazo, hoje) {
  if (!prazo) return '';
  const dias = Math.round((new Date(`${prazo}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / DIA_MS);
  if (dias < -1) return `venceu há ${-dias} dias`;
  if (dias === -1) return 'venceu ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'amanhã';
  const d = new Date(`${prazo}T12:00:00`);
  return dias < 7 ? `${diaSemana.format(d).replace('.', '')}, ${diaMes.format(d)}` : diaMes.format(d);
}

const tempo = (min) => (!min ? '' : min < 60 ? `~${min} min` : `~${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`);

function selo(d) {
  return `<span class="dem-origem dem-origem--${esc(d.origem)}">${esc(ORIGENS_DEMANDA[d.origem] || 'Demanda')}</span>`;
}

function itemDemanda(d, hoje) {
  const prio = Number(d.prioridade) || 0;
  const prazo = textoPrazo(d.prazo, hoje);
  const meta = [
    prazo && `<span class="${prazo.startsWith('venceu') || prazo === 'vence hoje' ? 'dem-urgente' : ''}">${esc(prazo)}${d.hora ? ` às ${esc(d.hora)}` : ''}</span>`,
    d.minutos && esc(tempo(d.minutos)),
    prio && esc(PRIORIDADES.find((p) => p.valor === prio)?.nome || ''),
    d.quem && `de ${esc(d.quem)}`,
  ].filter(Boolean).join(' · ');
  return `
    <li class="dem-item prio-${prio}">
      <div class="dem-texto">
        <span class="dem-linha-origem">${selo(d)}${d.onde ? `<small>${esc(d.onde)}</small>` : ''}</span>
        <strong>${esc(d.titulo)}</strong>
        ${meta ? `<small class="dem-meta">${meta}</small>` : ''}
        ${d.dados?.motivo ? `<small class="campo-ajuda">${esc(d.dados.motivo)}</small>` : ''}
      </div>
      <div class="dem-acoes">
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="dem-aceitar" data-id="${esc(d.id)}">Aceitar</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="dem-ajustar" data-id="${esc(d.id)}">Ajustar</button>
        <button class="botao-icone botao-icone-p" type="button" data-acao="dem-descartar" data-id="${esc(d.id)}" aria-label="Descartar: ${esc(d.titulo)}" title="Descartar">×</button>
      </div>
    </li>`;
}

function itemMudanca(d) {
  const partes = [];
  if (d.mudou?.prazo) partes.push(`prazo ${d.mudou.prazo.de ? diaMes.format(new Date(`${d.mudou.prazo.de}T12:00:00`)) : 'sem data'} → ${d.mudou.prazo.para ? diaMes.format(new Date(`${d.mudou.prazo.para}T12:00:00`)) : 'sem data'}`);
  if (d.mudou?.titulo) partes.push(`agora se chama "${esc(d.mudou.titulo.para)}"`);
  return `
    <li class="dem-item dem-mudou">
      <div class="dem-texto">
        <span class="dem-linha-origem">${selo(d)}<small>mudou depois de virar tarefa</small></span>
        <strong>${esc(d.titulo)}</strong>
        <small class="dem-meta">${partes.join(' · ')}</small>
      </div>
      <div class="dem-acoes">
        <button class="botao botao-primario botao-pequeno" type="button" data-acao="dem-mudanca-aplicar" data-id="${esc(d.id)}">Atualizar a tarefa</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="dem-mudanca-manter" data-id="${esc(d.id)}">Manter</button>
      </div>
    </li>`;
}

export function cardDemandas(estado, agora = Date.now()) {
  const hoje = hojeLocal(agora);
  const abertas = demandasAbertas(estado.demandas);
  const mudadas = demandasMudadas(estado.demandas);
  const conectadas = ['trello', 'notion'].map((s) => conexaoDe(estado, s)).filter(ligada);
  const pedeReconectar = conectadas.find((c) => c.status === 'reconectar');
  const todas = estado.demandasTodas;
  const visiveis = todas ? abertas : abertas.slice(0, NO_CARD);
  const lendo = estado.lendoDemandas;
  const ultima = conectadas.map((c) => c.ultima_sincronizacao).filter(Boolean).sort().pop();

  let corpo;
  if (!abertas.length && !mudadas.length) {
    corpo = conectadas.length
      ? `<p class="texto-suave">Nada novo esperando você. ${ultima ? `Última leitura ${esc(haQuantoTempo(new Date(ultima).getTime(), agora))}.` : ''}</p>`
      : `<p class="texto-suave">Conecte o Trello e o Notion para as demandas chegarem aqui sozinhas. Mensagem do WhatsApp: copie e toque em <strong>Colar mensagem</strong> (no tablet dá para usar o <strong>Compartilhar</strong> → Bússola).</p>
        <div class="acoes"><a class="botao botao-secundario botao-pequeno" href="#configuracoes/demandas">Conectar</a></div>`;
  } else {
    corpo = `
      ${mudadas.length ? `<ul class="dem-lista">${mudadas.map(itemMudanca).join('')}</ul>` : ''}
      ${visiveis.length ? `<ul class="dem-lista">${visiveis.map((d) => itemDemanda(d, hoje)).join('')}</ul>` : ''}
      ${abertas.length > NO_CARD ? `<button class="card-link" type="button" data-acao="dem-todas">${todas ? 'Mostrar menos' : `Ver todas (${abertas.length})`}</button>` : ''}`;
  }
  return `
    <section class="card demandas" aria-labelledby="demandas-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="demandas-titulo">Demandas${abertas.length ? ` <span class="selo">${abertas.length}</span>` : ''}</h2>
        <div class="dem-topo-acoes">
          <button class="card-link" type="button" data-acao="dem-colar">Colar mensagem</button>
          ${conectadas.length ? `<button class="card-link" type="button" data-acao="dem-ler"${lendo ? ' disabled aria-busy="true"' : ''}>${lendo ? 'Lendo…' : 'Ler agora'}</button>` : ''}
        </div>
      </div>
      ${pedeReconectar ? `<p class="ava-alerta" role="alert">${esc(pedeReconectar.detalhe?.mensagem || 'Um acesso parou de funcionar.')} <a href="#configuracoes/demandas">Conectar de novo</a></p>` : ''}
      ${corpo}
    </section>`;
}

// Ajustar antes de aceitar: o que fazer, prazo, tempo, prioridade e área.
export function formDemanda(d) {
  const minutos = [15, 30, 45, 60, 90, 120, 180, 240];
  const atual = Number(d.minutos) || 30;
  if (!minutos.includes(atual)) minutos.push(atual);
  minutos.sort((a, b) => a - b);
  return `
    <form class="formulario" data-form="dem-ajustar" data-id="${esc(d.id)}" novalidate>
      <p class="dem-linha-origem">${selo(d)}${d.onde ? `<small>${esc(d.onde)}</small>` : ''}</p>
      <label class="campo"><span class="campo-rotulo">O que fazer</span><input name="titulo" type="text" maxlength="200" required value="${esc(d.titulo)}"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Prazo</span><input name="prazo" type="date" value="${esc(d.prazo || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Hora</span><input name="hora" type="time" value="${esc(d.hora || '')}"></label>
      </div>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Tempo</span>
          <select name="minutos">${minutos.map((m) => `<option value="${m}"${m === atual ? ' selected' : ''}>${esc(tempo(m).replace('~', ''))}</option>`).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Prioridade</span>
          <select name="prioridade">${PRIORIDADES.map((p) => `<option value="${p.valor}"${p.valor === (Number(d.prioridade) || 0) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Área</span>
        <select name="area">${AREAS_TAREFA.map((a) => `<option value="${a.id}"${a.id === (d.dados?.area || 'consultoria') ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>
      ${d.detalhe ? `<details class="detalhes"><summary>Ver o texto original</summary><p class="dem-original">${esc(d.detalhe)}</p></details>` : ''}
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Aceitar e virar tarefa</button>
        ${d.origem_url ? `<a class="botao botao-secundario" href="${esc(d.origem_url)}" target="_blank" rel="noopener">Abrir no ${esc(ORIGENS_DEMANDA[d.origem])}</a>` : ''}
      </div>
    </form>`;
}

// O que chegou pelo "Compartilhar" de outro app.
export function folhaCompartilhado({ texto = '', url = '', titulo = '' }) {
  const previa = [titulo, texto, url].filter(Boolean).join('\n').trim();
  return `
    <blockquote class="dem-previa">${esc(previa.length > 400 ? `${previa.slice(0, 400)}…` : previa)}</blockquote>
    <p class="campo-ajuda">O que você quer fazer com isso?</p>
    <div class="dem-escolhas">
      <button class="botao ${url && !texto ? 'botao-secundario' : 'botao-primario'}" type="button" data-acao="dem-comp-demanda">Virar demanda</button>
      ${url ? `<button class="botao ${texto ? 'botao-secundario' : 'botao-primario'}" type="button" data-acao="dem-comp-leitura">Guardar como leitura</button>` : ''}
      <button class="botao botao-secundario" type="button" data-acao="dem-comp-caixa">Guardar na caixa de entrada</button>
    </div>`;
}

// Mensagem colada (no iPhone o app não aparece no "Compartilhar"; copiar e colar resolve).
export function formColar() {
  return `
    <form class="formulario" data-form="dem-colar" novalidate>
      <label class="campo"><span class="campo-rotulo">Mensagem</span>
        <textarea name="texto" rows="6" maxlength="4000" required placeholder="Cole aqui a mensagem do WhatsApp, do e-mail ou de onde for."></textarea></label>
      <p class="campo-ajuda">A IA tira dali o que fazer, o prazo e quem pediu. Você confere antes de virar tarefa.</p>
      <button class="botao botao-primario" type="submit">Virar demanda</button>
    </form>`;
}

// ---------------------------------------------------------------------------
// Configurações → Trello e Notion
// ---------------------------------------------------------------------------

function situacao(c) {
  const desde = c.conectado_em ? ` desde ${new Date(c.conectado_em).toLocaleDateString('pt-BR')}` : '';
  const leitura = c.ultima_sincronizacao ? `Última leitura ${esc(haQuantoTempo(new Date(c.ultima_sincronizacao).getTime()))}${Number.isFinite(c.detalhe?.lidas) ? ` · ${c.detalhe.lidas} ${c.detalhe.lidas === 1 ? 'item aberto' : 'itens abertos'}` : ''}` : 'Ainda não lido';
  return `
    <div class="ava-sucesso">
      <strong>✓ Conectado${c.detalhe?.nome ? ` (${esc(c.detalhe.nome)})` : ''}${desde}</strong>
      <span>${leitura}</span>
    </div>`;
}

// Página de autorização do Trello (só leitura). Com retorno, volta para a Bússola com "#token=...";
// sem retorno, o Trello mostra o token na tela para copiar (jeito que funciona em qualquer aparelho).
export function linkDoTrello(chave, retorno) {
  if (!chave) return null;
  const p = new URLSearchParams({ expiration: 'never', scope: 'read', response_type: 'token', name: 'Bússola', key: chave });
  if (retorno) p.set('return_url', retorno);
  return `https://trello.com/1/authorize?${p}`;
}

function blocoTrello(c, chave) {
  if (ligada(c)) {
    return `
      ${c.status === 'reconectar' ? `<p class="ava-alerta" role="alert">${esc(c.detalhe?.mensagem || 'O Trello recusou o acesso.')}</p>` : situacao(c)}
      <p class="campo-ajuda">Entram os cartões em que você é membro, que não estão concluídos nem em listas como "Feito".</p>
      <div class="acoes">
        ${c.status === 'reconectar' ? '<button class="botao botao-primario" type="button" data-acao="dem-trello-conectar">Conectar de novo</button>' : ''}
        <button class="botao botao-secundario" type="button" data-acao="dem-desconectar" data-servico="trello">Desconectar</button>
      </div>`;
  }
  return `
    <p class="texto-suave">Os cartões do Trello em que você é membro viram demandas. A Bússola só lê: nunca muda nada no Trello.</p>
    ${chave ? '<div class="acoes"><button class="botao botao-primario" type="button" data-acao="dem-trello-conectar">Conectar o Trello</button></div>'
    : '<p class="ava-alerta">Falta a variável TRELLO_API_KEY na Netlify (veja o passo a passo no ROTEIRO).</p>'}
    <details class="detalhes"><summary>Conectar copiando o token (se voltar do Trello não funcionar)</summary>
      ${chave ? `<p class="campo-ajuda"><a href="${esc(linkDoTrello(chave))}" target="_blank" rel="noopener">Abra esta página do Trello</a>, toque em <strong>Permitir</strong>, copie o token que aparece e cole aqui.</p>` : ''}
      <form class="formulario" data-form="dem-token" data-servico="trello" novalidate>
        <label class="campo"><span class="campo-rotulo">Token do Trello</span><input name="token" type="password" autocomplete="off" required></label>
        <button class="botao botao-secundario" type="submit">Conectar</button>
      </form>
    </details>`;
}

function blocoNotion(c) {
  if (ligada(c)) {
    const escolhidas = new Set((c.detalhe?.bases || []).map((b) => b.id));
    const disponiveis = c.detalhe?.disponiveis || [];
    return `
      ${c.status === 'reconectar' ? `<p class="ava-alerta" role="alert">${esc(c.detalhe?.mensagem || 'O Notion recusou o acesso.')}</p>` : situacao(c)}
      <form class="formulario" data-form="dem-bases" novalidate>
        <fieldset class="campo dem-bases"><legend class="campo-rotulo">Bases que viram demandas (até 8)</legend>
          ${disponiveis.length ? disponiveis.map((b) => `<label class="campo-marcar"><input type="checkbox" name="base" value="${esc(b.id)}"${escolhidas.has(b.id) ? ' checked' : ''}> ${esc(b.nome)}</label>`).join('')
    : '<p class="campo-ajuda">Nenhuma base liberada. No Notion, abra a base, toque em ••• → Conexões e escolha a da Bússola. Depois toque em "Atualizar a lista".</p>'}
        </fieldset>
        <p class="campo-ajuda">Entram as páginas editadas nos últimos 30 dias que não estão com status de concluídas.</p>
        <div class="acoes">
          ${disponiveis.length ? '<button class="botao botao-primario" type="submit">Salvar as bases</button>' : ''}
          <button class="botao botao-secundario" type="button" data-acao="dem-bases-atualizar">Atualizar a lista</button>
          <button class="botao botao-secundario" type="button" data-acao="dem-desconectar" data-servico="notion">Desconectar</button>
        </div>
      </form>
      ${c.status === 'reconectar' ? formNotion('Conectar de novo') : ''}`;
  }
  return `
    <p class="texto-suave">Páginas das bases que você escolher (tarefas, calendário de conteúdo, pedidos de cliente) viram demandas. A Bússola só lê.</p>
    <ol class="passos-ios">
      <li>No computador, abra <strong>notion.so/profile/integrations</strong> e crie uma conexão <strong>interna</strong> chamada "Bússola".</li>
      <li>Em <strong>Recursos</strong>, deixe só <strong>Ler conteúdo</strong> e <strong>Ler usuários</strong> (sem e-mail).</li>
      <li>Copie o <strong>Segredo interno</strong> e cole abaixo.</li>
      <li>Em cada base que a Bússola pode ler: <strong>•••</strong> → <strong>Conexões</strong> → Bússola.</li>
    </ol>
    ${formNotion('Conectar o Notion')}`;
}

function formNotion(rotulo) {
  return `
    <form class="formulario" data-form="dem-token" data-servico="notion" novalidate>
      <label class="campo"><span class="campo-rotulo">Segredo interno do Notion</span><input name="token" type="password" autocomplete="off" placeholder="ntn_…" required></label>
      <button class="botao botao-primario" type="submit">${esc(rotulo)}</button>
    </form>`;
}

export function cardConfigDemandas(estado, chaveTrello) {
  const trello = conexaoDe(estado, 'trello');
  const notion = conexaoDe(estado, 'notion');
  const algum = ligada(trello) || ligada(notion);
  return `
    <section class="card" aria-labelledby="config-demandas" id="demandas-config">
      <h2 class="card-titulo" id="config-demandas">Demandas: Trello e Notion</h2>
      <p class="campo-ajuda">A cada 2 horas (e no "Ler agora") a Bússola procura o que é novo e deixa no card Demandas do Hoje. Nada vira tarefa sem o seu OK.</p>
      <h3 class="ava-subtitulo">Trello</h3>
      ${blocoTrello(trello, chaveTrello)}
      <h3 class="ava-subtitulo">Notion</h3>
      ${blocoNotion(notion)}
      <h3 class="ava-subtitulo">WhatsApp</h3>
      <p class="campo-ajuda">O WhatsApp não deixa nenhum app ler as conversas. No tablet: segure a mensagem, toque em <strong>Compartilhar</strong> e escolha <strong>Bússola</strong>. No iPhone (que não mostra apps instalados pelo navegador no Compartilhar): segure a mensagem, toque em <strong>Copiar</strong> e, no card Demandas, em <strong>Colar mensagem</strong>. A IA transforma o texto em demanda.</p>
      ${algum ? `<div class="acoes"><button class="botao botao-secundario" type="button" data-acao="dem-ler"${estado.lendoDemandas ? ' disabled' : ''}>${estado.lendoDemandas ? 'Lendo…' : 'Ler agora'}</button></div>` : ''}
      <div class="ava-resultado" id="resultado-demandas" aria-live="polite"></div>
    </section>`;
}
