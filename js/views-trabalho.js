// Grupo Trabalho: Conteúdo (#conteudo e #conteudo/<id>), Aprovar (#aprovar), Clientes (#clientes e
// #clientes/<chave>) e Criar (#criar). Visual do Bússola; regras em dados-trabalho.js.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { esc } from './utilidades.js';
import { dataLocal } from './views-dia.js';
import {
  pecasAtivas, clientesAtivos, clientePelaChave, CASAS, casaDoCliente, corDoCliente, GRUPOS, grupoDoStatus, nomeDoGrupo, quando, diaMes,
  somarDias, segundaDe, nomeDoDia, radar, riscos, ETAPAS, quadroDeAprovar, atrasoNoDesign, diasDesde, mensagemParaCliente, lembreteParaCliente,
  cobrancaParaDesigner, visaoDosClientes, SAUDES, ritmo, oQueMudou, textoDaMudanca, FORMATOS, OBJETIVOS, revisar, clienteDeSaude, etapaDaPeca,
  NOME_COM_QUEM, comQuem,
} from './dados-trabalho.js';

const conexaoDe = (estado, servico) => (estado.conexoes || []).find((c) => c.servico === servico && !c.excluido_em);
export const notionLigado = (estado) => conexaoDe(estado, 'notion_trabalho')?.status === 'conectado';
const nomeCasa = (id) => CASAS.find((c) => c.id === id)?.nome || '';

const corDe = (estado, chave) => {
  const c = clientePelaChave(estado, chave);
  return Number(c?.dados?.cor) || corDoCliente(chave);
};
const ponto = (estado, p) => `<span class="tb-cli"><i class="tb-cor tb-cor-${corDe(estado, p.cliente)}" aria-hidden="true"></i>${esc(p.cliente_nome || p.cliente || '')}</span>`;
const seloGrupo = (p) => {
  const g = grupoDoStatus(p.status);
  return `<span class="selo tb-g-${g}">${esc(p.status || nomeDoGrupo(g))}</span>`;
};
const codigo = (p) => (p.formato ? `<span class="tb-cod">${esc(p.formato)}</span>` : '');

function filtroDeCasa(estado) {
  return estado.trabCasa || '';
}

function filtrar(estado, pecas) {
  const casa = filtroDeCasa(estado);
  const cliente = estado.trabCliente || '';
  const clientes = clientesAtivos(estado);
  return pecas.filter((p) => {
    if (cliente && p.cliente !== cliente) return false;
    if (!casa) return true;
    const c = clientes.find((x) => x.chave === p.cliente);
    return casaDoCliente(c || { nome: p.cliente_nome || '', casa: null }, [p]) === casa;
  });
}

function chipsCasa(estado, { comClientes = false } = {}) {
  const casa = filtroDeCasa(estado);
  const clientes = clientesAtivos(estado).filter((c) => !casa || casaDoCliente(c, pecasAtivas(estado).filter((p) => p.cliente === c.chave)) === casa);
  return `<div class="tb-chips" role="group" aria-label="Filtrar">
    <button class="chip-filtro" type="button" data-acao="tb-casa" data-valor="" aria-pressed="${!casa && !estado.trabCliente}">Todos</button>
    ${CASAS.map((c) => `<button class="chip-filtro" type="button" data-acao="tb-casa" data-valor="${c.id}" aria-pressed="${casa === c.id && !estado.trabCliente}">${esc(c.nome)}</button>`).join('')}
    ${comClientes ? clientes.slice(0, 14).map((c) => `<button class="chip-filtro" type="button" data-acao="tb-cliente" data-valor="${esc(c.chave)}" aria-pressed="${estado.trabCliente === c.chave}"><i class="tb-cor tb-cor-${corDe(estado, c.chave)}" aria-hidden="true"></i>${esc(c.nome)}</button>`).join('') : ''}
  </div>`;
}

function semConexao(estado, tela) {
  return `
    ${cabecalho(tela, 'Trabalho')}
    <section class="card vazio">
      <div class="vazio-icone">${icone('trabalho')}</div>
      <h2>Conecte o Notion do trabalho</h2>
      <p class="texto-suave">O grupo Trabalho copia os calendários do Notion e os quadros do Trello da agência. Em Configurações → Trabalho, cole o segredo da conexão do Notion (a mesma do Pauta, com ler, atualizar, inserir e comentários) e toque em Sincronizar.</p>
      <div class="acoes"><a class="botao botao-primario" href="#configuracoes/trabalho">Abrir Configurações</a></div>
    </section>`;
}

function barraSync(estado) {
  const c = conexaoDe(estado, 'notion_trabalho');
  const quando = c?.ultima_sincronizacao ? new Date(c.ultima_sincronizacao).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const rodando = estado.trabSync;
  return `<span class="tb-sync">${rodando ? `<span class="selo">Sincronizando ${esc(rodando)}…</span>` : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-sincronizar">Sincronizar</button>`}${quando && !rodando ? `<small class="campo-ajuda">${esc(quando)}</small>` : ''}</span>`;
}

// ---------------------------------------------------------------------------
// Conteúdo
// ---------------------------------------------------------------------------

export function renderConteudo(estado) {
  if (!notionLigado(estado) && !pecasAtivas(estado).length) return semConexao(estado, 'Conteúdo');
  if (estado.parametro) return fichaDaPeca(estado, estado.parametro);
  const hoje = dataLocal();
  const todas = pecasAtivas(estado).filter((p) => !p.dados?.producao);
  const pecas = filtrar(estado, todas);
  const visao = estado.trabVisao || 'semana';
  const inicio = estado.trabSemana || segundaDe(hoje);
  const fim = somarDias(inicio, 6);
  const daSemana = pecas.filter((p) => p.data && p.data >= inicio && p.data <= fim);
  const atencao = riscos(pecas, hoje).length + radar(pecas, hoje).length;
  const sub = `${visao === 'semana' ? `Semana de ${diaMes(inicio)} a ${diaMes(fim)} · ` : ''}${daSemana.length} ${daSemana.length === 1 ? 'peça' : 'peças'}${atencao ? ` · ${atencao} ${atencao === 1 ? 'pede' : 'pedem'} atenção` : ''}`;
  return `
    ${cabecalho('Conteúdo', esc(sub))}
    <div class="acoes cal-acoes tb-acoes">
      <div class="segmentado" role="tablist" aria-label="Visão">${[['semana', 'Semana'], ['lista', 'Lista']].map(([id, nome]) => `
        <button type="button" role="tab" data-acao="tb-visao" data-valor="${id}" aria-selected="${visao === id}" aria-pressed="${visao === id}">${nome}</button>`).join('')}</div>
      ${visao === 'semana' ? `<span class="tb-setas"><button class="botao-icone" type="button" data-acao="tb-semana" data-passo="-7" aria-label="Semana anterior">‹</button><button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-semana" data-passo="0">Hoje</button><button class="botao-icone" type="button" data-acao="tb-semana" data-passo="7" aria-label="Próxima semana">›</button></span>` : ''}
      ${barraSync(estado)}
      <a class="botao botao-primario botao-pequeno" href="#criar">+ Peça nova</a>
    </div>
    ${chipsCasa(estado, { comClientes: true })}
    ${cardMudou(estado, pecas)}
    ${visao === 'semana' ? semana(estado, pecas, inicio, hoje) : lista(estado, pecas, hoje)}
    ${cardRadar(estado, pecas, hoje)}`;
}

function cartaoPeca(estado, p, hoje) {
  const r = riscos([p], hoje)[0];
  return `<a class="tb-peca${r ? ' risco' : ''}" href="#conteudo/${esc(p.id)}">
    ${ponto(estado, p)}
    <b>${esc(p.titulo)}</b>
    <span class="tb-peca-pe">${codigo(p)}${r ? `<span class="selo tb-g-risco">${esc(r.texto.toLowerCase())}</span>` : seloGrupo(p)}</span>
  </a>`;
}

function semana(estado, pecas, inicio, hoje) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  return `<div class="tb-semana">${dias.map((d) => {
    const doDia = pecas.filter((p) => p.data === d);
    return `<section class="tb-dia${d === hoje ? ' hoje' : ''}" aria-label="${esc(nomeDoDia(d))} ${Number(d.slice(8))}">
      <h2 class="tb-dia-nome">${esc(nomeDoDia(d))} <b>${Number(d.slice(8))}</b></h2>
      ${doDia.map((p) => cartaoPeca(estado, p, hoje)).join('')}
    </section>`;
  }).join('')}</div>`;
}

function lista(estado, pecas, hoje) {
  const futuras = pecas.filter((p) => !p.data || p.data >= somarDias(hoje, -7)).sort((a, b) => String(a.data || '9999').localeCompare(String(b.data || '9999')));
  if (!futuras.length) return '<section class="card"><p class="texto-suave">Nenhuma peça por aqui.</p></section>';
  const grupos = GRUPOS.map((g) => ({ ...g, itens: futuras.filter((p) => grupoDoStatus(p.status) === g.id) })).filter((g) => g.itens.length);
  return grupos.map((g) => `
    <section class="card tb-lista">
      <div class="card-topo"><h2 class="card-titulo">${esc(g.nome)} <span class="selo">${g.itens.length}</span></h2></div>
      <ul class="lista-simples">${g.itens.slice(0, 40).map((p) => `
        <li class="tb-linha"><a href="#conteudo/${esc(p.id)}"><span class="tb-quando">${esc(quando(p.data, hoje))}</span><span class="tb-linha-texto"><b>${esc(p.titulo)}</b>${ponto(estado, p)}</span>${codigo(p)}</a></li>`).join('')}</ul>
    </section>`).join('');
}

function cardRadar(estado, pecas, hoje) {
  const r = riscos(pecas, hoje).slice(0, 3).map((x) => ({ icone: '⏳', classe: 'risco', titulo: `${x.peca.titulo}`, texto: `${x.peca.cliente_nome} · ${x.texto}`, rota: `#conteudo/${x.peca.id}` }));
  const a = radar(pecas, hoje).slice(0, 4).map((x) => ({ icone: x.tipo === 'buraco' ? '!' : '≈', classe: x.tipo, titulo: x.titulo, texto: x.texto, rota: x.ids ? `#conteudo/${x.ids[1]}` : `#clientes/${x.cliente}` }));
  const itens = [...r, ...a];
  if (!itens.length) return '';
  return `<div class="tb-radar" aria-label="Radar">${itens.map((i) => `
    <a class="card tb-alerta tb-alerta-${i.classe}" href="${esc(i.rota)}"><span class="tb-alerta-icone" aria-hidden="true">${i.icone}</span><span><b>${esc(i.titulo)}</b><small>${esc(i.texto)}</small></span></a>`).join('')}</div>`;
}

function cardMudou(estado, pecas) {
  const mudou = oQueMudou(pecas).slice(0, 6);
  if (!mudou.length) return '';
  return `<section class="card tb-mudou" aria-labelledby="tb-mudou-titulo">
    <div class="card-topo"><h2 class="card-titulo" id="tb-mudou-titulo">O que mudou sem você <span class="selo">${mudou.length}</span></h2>
      <button class="card-link" type="button" data-acao="tb-mudou-visto" data-id="">Dar baixa em tudo</button></div>
    <ul class="lista-simples">${mudou.map((p) => `
      <li class="tb-linha"><a href="#conteudo/${esc(p.id)}"><span class="tb-linha-texto"><b>${esc(p.titulo)}</b><small>${esc(p.cliente_nome || '')} · ${esc(textoDaMudanca(p.dados.mudanca))}</small></span></a>
        <button class="botao-icone botao-icone-p" type="button" data-acao="tb-mudou-visto" data-id="${esc(p.id)}" aria-label="Dar baixa" title="Dar baixa">✓</button></li>`).join('')}</ul>
  </section>`;
}

function fichaDaPeca(estado, id) {
  const p = pecasAtivas(estado).find((x) => x.id === id);
  if (!p) return `${cabecalho('Conteúdo')}<section class="card"><p class="texto-suave">Esta peça não está mais aqui.</p><a class="botao botao-secundario" href="#conteudo">Voltar</a></section>`;
  const hoje = dataLocal();
  const opcoes = p.origem === 'trello' ? Object.keys(p.dados?.listas || {}) : (p.dados?.opcoes || []);
  const etapa = etapaDaPeca(p);
  const cli = clientePelaChave(estado, p.cliente);
  const alertas = p.texto ? revisar(p.texto, { saude: clienteDeSaude(p.cliente_nome, cli?.dados?.nicho) }) : [];
  return `
    ${cabecalho(p.titulo, `${esc(p.cliente_nome || '')} · ${esc(p.fonte || '')}`)}
    <div class="acoes cal-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#conteudo">← Conteúdo</a>
      <a class="botao botao-secundario botao-pequeno" href="${esc(p.url)}" target="_blank" rel="noopener">Abrir no ${p.origem === 'trello' ? 'Trello' : 'Notion'}</a>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-focar" data-id="${esc(p.id)}">Focar nesta peça</button>
    </div>
    <div class="tb-ficha">
      <section class="card">
        <h2 class="card-titulo">Ficha</h2>
        <dl class="tb-dl">
          <dt>Com quem</dt><dd>${esc(NOME_COM_QUEM[comQuem(p.status)] || '')}${etapa ? ` · ${esc(ETAPAS.find((e) => e.id === etapa)?.nome || '')}` : ''}</dd>
          ${p.formato ? `<dt>Formato</dt><dd>${esc(p.formato)}</dd>` : ''}
          ${p.dados?.pilar ? `<dt>Pilar</dt><dd>${esc(p.dados.pilar)}</dd>` : ''}
          ${p.dados?.objetivo ? `<dt>Objetivo</dt><dd>${esc(p.dados.objetivo)}</dd>` : ''}
          ${p.dados?.serie ? `<dt>Série</dt><dd>${esc(p.dados.serie)}</dd>` : ''}
          ${p.entrega ? `<dt>${p.dados?.producao ? 'Prazo do design' : 'Entrega interna'}</dt><dd>${esc(quando(p.entrega, hoje))}</dd>` : ''}
          ${p.dados?.link_arte ? `<dt>Arte</dt><dd><a href="${esc(p.dados.link_arte)}" target="_blank" rel="noopener">abrir o link</a></dd>` : ''}
          ${p.dados?.feedback ? `<dt>Feedback do cliente</dt><dd>${esc(p.dados.feedback)}</dd>` : ''}
        </dl>
        <form class="formulario tb-mudar" data-form="tb-mudar" data-id="${esc(p.id)}" novalidate>
          <div class="cal-form-linha">
            ${opcoes.length ? `<label class="campo"><span class="campo-rotulo">${p.origem === 'trello' ? 'Lista' : 'Status'}</span><select name="status">${opcoes.map((o) => `<option${o === p.status ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>` : ''}
            ${p.dados?.producao ? '' : `<label class="campo"><span class="campo-rotulo">Data de postagem</span><input name="data" type="date" value="${esc(p.data || '')}"></label>`}
          </div>
          <div class="acoes"><button class="botao botao-primario" type="submit">Salvar no ${p.origem === 'trello' ? 'Trello' : 'Notion'}</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
      <section class="card tb-texto">
        <div class="card-topo"><h2 class="card-titulo">Texto</h2>
          ${p.origem === 'notion' ? `<button class="card-link" type="button" data-acao="tb-ler-texto" data-id="${esc(p.id)}">${p.texto ? 'Ler de novo' : 'Ler do Notion'}</button>` : ''}</div>
        ${p.texto ? `<div class="tb-texto-corpo">${marcarTexto(p.texto, alertas)}</div>` : '<p class="texto-suave">Ainda sem texto copiado.</p>'}
        ${alertas.length ? `<p class="campo-ajuda">Revisor: ${alertas.length} ${alertas.length === 1 ? 'ponto' : 'pontos'} marcados.</p>` : ''}
        <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-criar-de" data-id="${esc(p.id)}">Abrir no Criar</button></div>
        <form class="formulario" data-form="tb-comentar" data-id="${esc(p.id)}" novalidate>
          <label class="campo"><span class="campo-rotulo">Comentar no ${p.origem === 'trello' ? 'cartão' : 'Notion'}</span><textarea name="texto" rows="2" maxlength="2000" placeholder="O que precisa mudar"></textarea></label>
          <label class="campo-marcar"><input type="checkbox" name="memoria"> Guardar na memória de ${esc(p.cliente_nome || 'cliente')} (a IA lê nos próximos pedidos)</label>
          <div class="acoes"><button class="botao botao-secundario" type="submit">Comentar</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
    </div>`;
}

// Texto com os trechos do revisor marcados (sem HTML vindo de fora: tudo passa por esc).
export function marcarTexto(texto, alertas) {
  const t = String(texto || '');
  const marcas = [...alertas].filter((a) => Number.isFinite(a.inicio)).sort((a, b) => a.inicio - b.inicio);
  let html = '';
  let pos = 0;
  for (const a of marcas) {
    if (a.inicio < pos) continue;
    html += esc(t.slice(pos, a.inicio));
    html += `<mark class="tb-marca tb-marca-${a.tipo}" title="${esc(a.regra)}">${esc(t.slice(a.inicio, a.fim))}</mark>`;
    pos = a.fim;
  }
  html += esc(t.slice(pos));
  return html.replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Aprovar
// ---------------------------------------------------------------------------

const ABA_CURTA = { design: 'Design', voce: 'Você', cliente: 'Cliente', agendar: 'Agendar' };

export function renderAprovar(estado) {
  if (!notionLigado(estado) && !pecasAtivas(estado).length) return semConexao(estado, 'Aprovar');
  const hoje = dataLocal();
  const pecas = filtrar(estado, pecasAtivas(estado));
  const q = quadroDeAprovar(pecas);
  const total = ETAPAS.reduce((t, e) => t + q[e.id].length, 0);
  const aba = estado.aprovarAba || 'voce';
  return `
    ${cabecalho('Aprovar', 'O caminho de cada arte, da designer até o agendamento. Arraste ou use os botões.')}
    <div class="acoes cal-acoes tb-acoes">${chipsCasa(estado)}${barraSync(estado)}</div>
    <div class="segmentado tb-abas-aprovar" role="tablist" aria-label="Etapas">${ETAPAS.map((e) => `
      <button type="button" role="tab" data-acao="tb-aba" data-valor="${e.id}" aria-selected="${aba === e.id}" aria-pressed="${aba === e.id}">${esc(ABA_CURTA[e.id] || e.nome)} ${q[e.id].length}</button>`).join('')}</div>
    ${total ? '' : '<section class="card"><p class="texto-suave">Nada no caminho da aprovação agora. Quando a designer puser uma arte em aprovação, ela aparece aqui.</p></section>'}
    <div class="tb-quadro" data-aba="${esc(aba)}">${ETAPAS.map((e) => `
      <section class="tb-coluna${e.id === 'voce' ? ' destaque' : ''}" data-etapa="${e.id}" aria-label="${esc(e.nome)}">
        <h2 class="tb-coluna-titulo">${esc(e.nome)} <small>${q[e.id].length}</small></h2>
        <p class="tb-coluna-ajuda">${esc(e.ajuda)}</p>
        ${q[e.id].map((p) => cartaoArte(estado, p, e.id, hoje)).join('') || (total ? '<p class="tb-coluna-vazia">Nada aqui agora.</p>' : '')}
      </section>`).join('')}</div>`;
}

function cartaoArte(estado, p, etapa, hoje) {
  const atraso = etapa === 'design' ? atrasoNoDesign(p, hoje) : null;
  const espera = etapa === 'cliente' ? diasDesde(p.dados?.fluxo?.enviadoEm) : 0;
  const quandoTxt = p.data ? `posta ${quando(p.data, hoje)}` : p.entrega ? `prazo ${quando(p.entrega, hoje)}` : '';
  let pe = '';
  if (etapa === 'design') {
    pe = `<span class="tb-arte-pe"><small>${esc(quandoTxt)}</small>${atraso ? `<span class="selo tb-g-risco">${atraso.tipo === 'prazo' ? 'atrasada' : `parada há ${atraso.dias} dias`}</span>` : '<span class="selo">no prazo</span>'}</span>
      ${atraso ? `<span class="tb-arte-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-copiar" data-texto="${esc(cobrancaParaDesigner(p))}">Copiar cobrança</button></span>` : ''}`;
  } else if (etapa === 'voce') {
    pe = `<p class="tb-msg">${esc(mensagemParaCliente(p))}</p>
      <span class="tb-arte-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-copiar" data-texto="${esc(mensagemParaCliente(p))}">Copiar mensagem</button><button class="botao botao-primario botao-pequeno" type="button" data-acao="tb-etapa" data-id="${esc(p.id)}" data-valor="mandei">Mandei ›</button></span>`;
  } else if (etapa === 'cliente') {
    pe = `<span class="tb-arte-pe"><small>${espera ? `mandou há ${espera} ${espera === 1 ? 'dia' : 'dias'}` : 'mandou hoje'}</small>${espera >= 2 ? `<button class="selo tb-g-espera" type="button" data-acao="tb-copiar" data-texto="${esc(lembreteParaCliente(p))}">cobrar?</button>` : ''}</span>
      <span class="tb-arte-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-etapa" data-id="${esc(p.id)}" data-valor="ajuste">Ajuste</button><button class="botao botao-primario botao-pequeno" type="button" data-acao="tb-etapa" data-id="${esc(p.id)}" data-valor="aprovou">Aprovou ›</button></span>`;
  } else if (etapa === 'agendar') {
    pe = `<span class="tb-arte-pe"><small>${esc(quandoTxt || 'sem data')}</small><button class="botao botao-primario botao-pequeno" type="button" data-acao="tb-etapa" data-id="${esc(p.id)}" data-valor="agendei">Agendei ✓</button></span>`;
  }
  return `<article class="tb-arte" data-id="${esc(p.id)}">
    <button class="tb-alca" type="button" data-tb-arrastar="${esc(p.id)}" aria-label="Arrastar ${esc(p.titulo)}" title="Arrastar">⠿</button>
    <a class="tb-arte-topo" href="#conteudo/${esc(p.id)}">${ponto(estado, p)}<b>${esc(p.titulo)}</b></a>
    ${pe}
  </article>`;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function renderClientes(estado) {
  if (!notionLigado(estado) && !clientesAtivos(estado).length) return semConexao(estado, 'Clientes');
  const hoje = dataLocal();
  const pecas = pecasAtivas(estado);
  const visoes = visaoDosClientes(clientesAtivos(estado), pecas, hoje);
  const chave = estado.parametro || null;
  const aberta = chave ? visoes.find((v) => v.cliente.chave === chave) : null;
  const listaHtml = `<nav class="card tb-clientes-lista${aberta ? ' tem-aberto' : ''}" aria-label="Clientes">${CASAS.map((casa) => {
    const daCasa = visoes.filter((v) => v.casa === casa.id);
    if (!daCasa.length) return '';
    return `<p class="tb-casa">${esc(casa.nome)}</p>${daCasa.map((v) => `
      <a class="tb-cliente-linha${v.cliente.chave === chave ? ' aberto' : ''}" href="#clientes/${esc(v.cliente.chave)}"${v.cliente.chave === chave ? ' aria-current="page"' : ''}>
        <i class="tb-cor tb-cor-${corDe(estado, v.cliente.chave)}" aria-hidden="true"></i>
        <span><b>${esc(v.cliente.nome)}</b><small>${esc(v.frase)}</small></span>
        <span class="selo tb-s-${v.saude}">${esc(SAUDES[v.saude])}</span>
      </a>`).join('')}`;
  }).join('')}</nav>`;
  return `
    ${cabecalho(aberta ? aberta.cliente.nome : 'Clientes', aberta ? esc([nomeCasa(aberta.casa), aberta.cliente.dados?.nicho, aberta.cliente.dados?.instagram, (aberta.cliente.dados?.servicos || []).join(', ')].filter(Boolean).join(' · ')) : `${visoes.length} clientes · ${visoes.filter((v) => v.saude === 'urgente').length} urgentes`)}
    <div class="acoes cal-acoes tb-acoes">
      ${aberta ? `<a class="botao botao-secundario botao-pequeno tb-voltar-lista" href="#clientes">← Clientes</a>` : ''}
      ${aberta && aberta.cliente.url ? `<a class="botao botao-secundario botao-pequeno" href="${esc(aberta.cliente.url)}" target="_blank" rel="noopener">Abrir no ${String(aberta.cliente.url).includes('trello') ? 'Trello' : 'Notion'}</a>` : ''}
      ${aberta ? `<button class="botao botao-primario botao-pequeno" type="button" data-acao="tb-criar-para" data-valor="${esc(aberta.cliente.chave)}">Criar para ${esc(aberta.cliente.nome.split(' ')[0] === 'Dra.' || aberta.cliente.nome.split(' ')[0] === 'Dr.' ? 'ela' : aberta.cliente.nome.split(' ')[0])}</button>` : barraSync(estado)}
    </div>
    <div class="tb-clientes${aberta ? ' com-ficha' : ''}">
      ${listaHtml}
      ${aberta ? fichaDoCliente(estado, aberta, pecas, hoje) : '<section class="card tb-escolha"><p class="texto-suave">Escolha um cliente para ver a semana, o radar, as próximas peças e a memória de feedback.</p></section>'}
    </div>`;
}

function fichaDoCliente(estado, v, pecas, hoje) {
  const doCliente = pecas.filter((p) => p.cliente === v.cliente.chave);
  const alertas = radar(doCliente, hoje);
  const memoria = v.cliente.dados?.memoria || [];
  const feedbacks = doCliente.filter((p) => p.dados?.feedback).slice(0, 3);
  return `<div class="tb-ficha-cliente">
    <section class="card"><h2 class="tb-rot">Esta semana</h2>
      <div class="tb-numeros">
        <span><b>${v.daSemana}</b><small>peças</small></span><span><b>${v.conta.voce}</b><small>com você</small></span>
        <span><b>${v.conta.cliente}</b><small>com o cliente</small></span><span><b>${String(ritmo(doCliente, hoje)).replace('.', ',')}</b><small>por semana no mês</small></span>
      </div></section>
    <section class="card"><h2 class="tb-rot">Radar</h2>
      ${[...v.riscos.map((r) => `<p>${esc(r.peca.titulo)}: ${esc(r.texto.toLowerCase())}.</p>`), ...alertas.map((a) => `<p>${esc(a.titulo)}. <small class="texto-suave">${esc(a.texto)}</small></p>`)].join('') || '<p class="texto-suave">Nada pedindo atenção.</p>'}</section>
    <section class="card"><h2 class="tb-rot">Próximas peças</h2>
      ${v.proximas.length ? `<ul class="lista-simples">${v.proximas.map((p) => `<li class="tb-linha"><a href="#conteudo/${esc(p.id)}"><span class="tb-quando">${esc(quando(p.data, hoje))}</span><span class="tb-linha-texto"><b>${esc(p.titulo)}</b></span>${seloGrupo(p)}</a></li>`).join('')}</ul>` : '<p class="texto-suave">Nada marcado pela frente.</p>'}</section>
    <section class="card"><h2 class="tb-rot">Memória de feedback · entra na IA</h2>
      ${memoria.length || feedbacks.length ? `<ul class="lista-simples tb-memoria">${memoria.map((m) => `<li><span>${esc(m.texto)}<small>${esc(m.origem || 'anotado')} · ${esc(new Date(m.em).toLocaleDateString('pt-BR'))}</small></span><button class="botao-icone botao-icone-p" type="button" data-acao="tb-memoria-tirar" data-cliente="${esc(v.cliente.chave)}" data-id="${esc(m.id)}" aria-label="Tirar da memória" title="Tirar">×</button></li>`).join('')}${feedbacks.map((p) => `<li><span>${esc(p.dados.feedback)}<small>feedback no Notion · ${esc(p.titulo)}</small></span></li>`).join('')}</ul>` : '<p class="texto-suave">Nada guardado ainda. Os ajustes que o cliente pede entram aqui e a IA segue nos próximos pedidos.</p>'}
      <form class="formulario tb-memoria-form" data-form="tb-memoria" data-cliente="${esc(v.cliente.chave)}" novalidate>
        <label class="campo"><span class="campo-rotulo">Novo aprendizado</span><input name="texto" type="text" maxlength="300" placeholder='Ex.: Prefere "pele saudável" a "pele perfeita".'></label>
        <button class="botao botao-secundario" type="submit">Guardar</button>
      </form></section>
    ${v.cliente.dados?.ficha ? `<details class="card tb-ficha-texto"><summary class="card-titulo">Ficha do Notion</summary><div class="tb-texto-corpo">${esc(v.cliente.dados.ficha).replace(/\n/g, '<br>')}</div></details>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

export function renderCriar(estado) {
  const r = estado.criar || {};
  const clientes = clientesAtivos(estado);
  const cli = clientePelaChave(estado, r.cliente);
  const alertas = revisar(r.texto || '', { saude: cli ? clienteDeSaude(cli.nome, cli.dados?.nicho) : false });
  const rascunhos = (estado.rascunhos || []).filter((x) => !x.excluido_em).sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
  const calendarios = estado.trabCalendarios || [];
  const memoria = cli?.dados?.memoria || [];
  return `
    ${cabecalho('Criar', 'Rascunho com o método da Essence. O revisor marca o que as regras proíbem enquanto você escreve.')}
    <div class="acoes cal-acoes tb-acoes">
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-rascunho-novo">Novo rascunho</button>
      ${rascunhos.length ? `<details class="menu-mais"><summary class="botao botao-secundario botao-pequeno">Rascunhos · ${rascunhos.length}</summary><div class="menu-mais-lista">${rascunhos.slice(0, 12).map((x) => `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="tb-rascunho-abrir" data-id="${esc(x.id)}">${esc(x.tema || x.formato || 'Sem tema')}${x.cliente ? ` · ${esc(clientePelaChave(estado, x.cliente)?.nome || x.cliente)}` : ''}</button>`).join('')}</div></details>` : ''}
    </div>
    <div class="tb-criar">
      <form class="formulario tb-criar-form" data-form="tb-criar" novalidate>
        <div class="tb-criar-campos">
          <label class="campo"><span class="campo-rotulo">Para</span><select name="cliente" data-acao-mudar="tb-criar-campo"><option value="">Escolha</option>${clientes.map((c) => `<option value="${esc(c.chave)}"${c.chave === r.cliente ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label class="campo"><span class="campo-rotulo">Formato</span><select name="formato" data-acao-mudar="tb-criar-campo">${FORMATOS.map((f) => `<option${f === (r.formato || FORMATOS[0]) ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          <label class="campo"><span class="campo-rotulo">Objetivo</span><select name="objetivo" data-acao-mudar="tb-criar-campo">${OBJETIVOS.map((o) => `<option${o === (r.objetivo || 'Educação') ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
          <label class="campo tb-criar-tema"><span class="campo-rotulo">Tema</span><input name="tema" type="text" maxlength="200" value="${esc(r.tema || '')}" placeholder="Ex.: Melasma tem cura?" data-acao-mudar="tb-criar-campo"></label>
        </div>
        <label class="campo"><span class="campo-rotulo">Texto</span>
          <textarea class="tb-criar-texto" name="texto" rows="16" data-acao-mudar="tb-criar-texto" placeholder="Escreva aqui, ou toque em Gerar com a IA.">${esc(r.texto || '')}</textarea></label>
        <div class="acoes">
          <button class="botao botao-secundario" type="button" data-acao="tb-ia" data-valor="criar">Gerar com a IA</button>
          <button class="botao botao-secundario" type="button" data-acao="tb-ia" data-valor="gancho">Melhorar o gancho</button>
          <button class="botao botao-secundario" type="button" data-acao="tb-ia" data-valor="arte">Preparar o pedido da arte</button>
          <button class="botao botao-secundario" type="button" data-acao="tb-modelo">Usar o modelo do formato</button>
        </div>
        <p class="campo-ajuda" data-tb-ia-status aria-live="polite">${esc(estado.criarStatus || '')}</p>
        <fieldset class="tb-enviar"><legend class="campo-rotulo">Mandar para o calendário</legend>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Calendário</span><select name="calendario">${calendarios.map((c) => `<option${c === r.calendario ? ' selected' : ''}>${esc(c)}</option>`).join('') || '<option value="">Sincronize o Trabalho primeiro</option>'}</select></label>
            <label class="campo"><span class="campo-rotulo">Data de postagem</span><input name="data" type="date" value="${esc(r.data || '')}"></label>
          </div>
          <label class="campo"><span class="campo-rotulo">Título da peça</span><input name="titulo" type="text" maxlength="200" value="${esc(r.titulo || r.tema || '')}"></label>
          <div class="acoes"><button class="botao botao-primario" type="submit">Criar no Notion</button><button class="botao botao-secundario" type="button" data-acao="tb-rascunho-guardar">Guardar rascunho</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </fieldset>
      </form>
      <aside class="card tb-revisor" aria-label="Revisor">
        <p class="tb-rot" data-tb-revisor-total>Revisor · ${alertas.length} ${alertas.length === 1 ? 'ponto' : 'pontos'}</p>
        <ul class="tb-alertas" data-tb-revisor>${listaAlertas(alertas)}</ul>
        ${cli ? `<p class="tb-rot tb-rot-meio">Lembrado de ${esc(cli.nome)}</p>${memoria.length ? `<ul class="lista-simples tb-memoria">${memoria.slice(0, 6).map((m) => `<li><span>${esc(m.texto)}</span></li>`).join('')}</ul>` : '<p class="texto-suave">Nada guardado ainda.</p>'}` : ''}
      </aside>
    </div>`;
}

export function listaAlertas(alertas) {
  if (!alertas.length) return '<li class="texto-suave">Nada para apontar. Leia em voz alta antes de mandar.</li>';
  return alertas.map((a) => `<li class="tb-alerta-${a.tipo}"><b>"${esc(a.trecho.length > 40 ? `${a.trecho.slice(0, 40)}…` : a.trecho)}"</b><span>${esc(a.regra)}</span></li>`).join('');
}

// ---------------------------------------------------------------------------
// Configurações → Trabalho
// ---------------------------------------------------------------------------

export function cardTrabalhoConfig(estado) {
  const c = conexaoDe(estado, 'notion_trabalho');
  const ligado = c?.status === 'conectado';
  const escreve = estado.trabSituacao?.trelloEscreve;
  return `
    <section class="card" id="trabalho" aria-labelledby="config-trabalho">
      <h2 class="card-titulo" id="config-trabalho">Trabalho (Notion e Trello da agência)</h2>
      <p class="texto-suave">O grupo Trabalho copia os calendários do Notion e os quadros do Trello, e muda status, data e lista quando você pede. A trava: nunca mexe na estrutura dos bancos do Notion e nada é apagado no Trello.</p>
      ${ligado ? `<div class="ava-sucesso"><strong>✓ Notion conectado${c.detalhe?.nome ? ` (${esc(c.detalhe.nome)})` : ''}</strong><span>${c.ultima_sincronizacao ? `Última cópia ${esc(new Date(c.ultima_sincronizacao).toLocaleString('pt-BR'))}` : 'Ainda não copiado'}</span></div>
        <div class="acoes"><button class="botao botao-primario" type="button" data-acao="tb-sincronizar">Sincronizar agora</button><button class="botao botao-secundario" type="button" data-acao="tb-desconectar">Desconectar</button></div>`
    : `<ol class="passos-ios">
        <li>Em <strong>notion.so/profile/integrations</strong>, abra a conexão do Pauta (ou crie uma interna) com <strong>ler, atualizar e inserir conteúdo</strong> e <strong>comentários</strong>.</li>
        <li>Ligue a conexão à página de cada calendário e das bases de clientes (••• → Conexões).</li>
        <li>Copie o <strong>Segredo interno</strong> e cole abaixo. Ele fica criptografado e nunca volta para a tela.</li>
      </ol>
      <form class="formulario" data-form="tb-conectar" novalidate>
        <label class="campo"><span class="campo-rotulo">Segredo do Notion do trabalho</span><input name="token" type="password" autocomplete="off" placeholder="ntn_..." required></label>
        <div class="acoes"><button class="botao botao-primario" type="submit">Conectar</button></div>
        <p class="campo-ajuda" data-erro hidden></p>
      </form>`}
      <h3 class="ava-subtitulo">Trello</h3>
      ${conexaoDe(estado, 'trello') ? (escreve === false ? '<p class="ava-alerta" role="alert">O Trello está conectado só para ler. Para mover cartões pelo Aprovar, conecte de novo em Configurações → Demandas (a nova autorização pede ler e escrever).</p>'
    : escreve ? '<p class="texto-suave">✓ O Trello deixa mover cartões. Os quadros vêm da escolha feita em Demandas (quadro dos designers e quadros dos clientes).</p>'
      : '<p class="texto-suave">Os quadros vêm da escolha feita em Demandas (quadro dos designers e quadros dos clientes).</p>')
    : '<p class="texto-suave">Conecte o Trello em Configurações → Demandas para trazer o quadro dos designers e os dos clientes.</p>'}
    </section>`;
}

// ---------------------------------------------------------------------------
// Hoje → Comece por aqui (trabalho)
// ---------------------------------------------------------------------------

export function cardComecePorAqui(estado, itens, tese) {
  return `
    <section class="card tb-comece" aria-labelledby="tb-comece-titulo">
      <div class="card-topo"><h2 class="card-titulo" id="tb-comece-titulo">Comece por aqui</h2><a class="card-link" href="#aprovar">Trabalho</a></div>
      ${itens.length ? `<ol class="tb-comece-lista">${itens.map((i) => `<li><a href="${esc(i.rota)}"><b>${esc(i.titulo)}</b><small>${esc(i.motivo)}</small></a></li>`).join('')}</ol>`
    : '<p class="texto-suave">Nada do trabalho apertando agora.</p>'}
      ${tese ? `<p class="tb-tese">“${esc(tese)}”</p>` : ''}
    </section>`;
}
