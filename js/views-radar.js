// Tela do Radar do nicho (#radar, #radar/<nicho>, #radar/novo, #radar/editar:<nicho>): o que vai
// bombar nas próximas 2 semanas, as notícias em alta, o briefing da semana e os sinais por trás.

import { esc } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { TEMPERATURAS, nichosDoRadar, chaveDoRadar, MAX_PALAVRAS, vistosDoRadar, chaveDoVisto, novasDesde, ESPECIALIDADES, GRUPOS_ESPECIALIDADE, especialidade, especialidadeDaCliente, porProducao, mesDaProxima, nomeDoMesRadar, guardadasDoRadar, idDaGuardada } from './dados-radar.js';
import { hojeLocal } from './views-demandas.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtQuando = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } };
const temp = (id) => TEMPERATURAS.find((t) => t.id === id) || TEMPERATURAS[1];

export const resultadoDoRadar = (estado, id) => (estado.config || []).find((c) => c.chave === chaveDoRadar(id) && !c.excluido_em)?.valor || null;
const clientesVivas = (estado) => (estado.clientesTrabalho || []).filter((c) => !c.excluido_em && c.nome && !/\bteste\b/i.test(c.nome))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
export const ABAS_RADAR = [['geral', 'Geral'], ['clientes', 'Clientes'], ['noticias', 'Notícias'], ['sinais', 'Sinais']];

export function renderRadar(estado) {
  const nichos = nichosDoRadar(estado.config);
  const p = estado.parametro || '';
  if (p === 'clientes' || (!nichos.length && p !== 'novo')) return telaMontar(estado, nichos);
  if (p === 'novo') return formNicho(estado, null, nichos);
  if (p.startsWith('editar:')) return formNicho(estado, nichos.find((n) => n.id === p.slice(7)) || null, nichos);
  const nicho = nichos.find((n) => n.id === p) || nichos[0];
  return `
    ${cabecalho('Radar do nicho', 'O que está subindo no nicho das suas clientes nas próximas 2 semanas, com as notícias novas e as sugestões de conteúdo de cada uma.', '<a class="botao botao-primario" href="#radar/novo">+ Novo nicho</a>')}
    <div class="rd-barra">
      ${nichos.length > 1 ? `<div class="segmentado rd-nichos" role="group" aria-label="Nichos">${nichos.map((n) => `
        <button type="button" data-acao="radar-aba" data-id="${esc(n.id)}" aria-pressed="${n.id === nicho.id}">${esc(n.nome)}</button>`).join('')}</div>` : '<span></span>'}
      <div class="rd-barra-acoes">
        <a class="botao botao-secundario botao-pequeno" href="#radar/editar:${esc(nicho.id)}">Editar o nicho</a>
        <a class="botao botao-secundario botao-pequeno" href="#radar/clientes">Clientes e especialidades</a>
      </div>
    </div>
    ${painel(estado, nicho)}`;
}

// A busca das especialidades: as sugestões aparecem enquanto ela digita, com o grupo ao lado
// (Especialidades médicas, Áreas de atuação, Outras da saúde, Negócios).
function listaDeEspecialidades() {
  const grupo = Object.fromEntries(GRUPOS_ESPECIALIDADE.map((g) => [g.id, g.nome]));
  return `<datalist id="rd-especialidades">${ESPECIALIDADES.map((e) => `<option value="${esc(e.nome)}" label="${esc(grupo[e.grupo] || '')}"></option>`).join('')}</datalist>`;
}

// Primeira vez (ou "Clientes e especialidades"): a especialidade de cada cliente monta os nichos.
function telaMontar(estado, nichos) {
  const clientes = clientesVivas(estado);
  const noNicho = new Map(nichos.flatMap((n) => n.clientes.map((c) => [c, n.id])));
  return `
    ${cabecalho('Radar do nicho', 'Marque a especialidade de cada cliente e o radar monta os nichos, com as palavras que o público usa.', nichos.length ? '<a class="botao botao-secundario" href="#radar">Voltar ao radar</a>' : '')}
    ${nichos.length ? '' : `
      <section class="card rd-como">
        <h2 class="card-titulo">Como o radar funciona</h2>
        <ol class="rd-como-lista">
          <li><strong>Atualiza sozinho:</strong> notícias a cada 2 horas (7h às 21h) e a análise com a IA às 6h30.</li>
          <li><strong>Avisa no celular</strong> quando um assunto dispara para uma cliente, com tempo para criar.</li>
          <li><strong>Uma caixa por cliente:</strong> quantas notícias novas, quais são e as fontes.</li>
          <li><strong>Sugestões no seu método:</strong> formato, linha editorial, gancho, slides ou roteiro, CTA e o cuidado do conselho.</li>
          <li><strong>Exporta</strong> em PDF ou copia para o WhatsApp e o Notion.</li>
        </ol>
      </section>`}
    ${clientes.length ? `
      <form class="card formulario rd-montar" data-form="radar-montar" novalidate>
        <div class="card-topo"><h2 class="card-titulo">Suas clientes</h2><span class="campo-ajuda">${clientes.length} no Trabalho</span></div>
        <ul class="rd-montar-lista">${clientes.map((c, i) => {
          const atual = noNicho.get(c.nome) || especialidadeDaCliente(c);
          return `
          <li>
            <label class="rd-montar-nome" for="rd-esp-${i}">${esc(c.nome)}</label>
            <span class="campo"><input id="rd-esp-${i}" name="esp" type="search" list="rd-especialidades" autocomplete="off" enterkeyhint="next" placeholder="Digite: neuro…" value="${esc(especialidade(atual)?.nome || '')}" data-cliente="${esc(c.nome)}" data-chave="${esc(c.chave || '')}"></span>
          </li>`;
        }).join('')}</ul>
        ${listaDeEspecialidades()}
        <p class="campo-ajuda">${ESPECIALIDADES.length} especialidades: todas as médicas, as áreas de atuação (neuropediatria, medicina do sono, fertilidade…) e as outras da saúde. Deixe em branco quem não entra no radar. A especialidade também fica na ficha da cliente e vale para as datas da saúde do Calendário.</p>
        <div class="acoes">
          <button class="botao botao-primario" type="submit">${nichos.length ? 'Salvar e atualizar os nichos' : 'Criar os nichos'}</button>
          <a class="botao botao-secundario" href="#radar/novo">Criar um nicho à mão</a>
        </div>
      </form>` : `
      <section class="card"><p>Ainda não há clientes no Trabalho. Conecte o Trabalho em Configurações, ou crie um nicho à mão.</p>
        <div class="acoes"><a class="botao botao-primario" href="#radar/novo">Criar um nicho à mão</a></div></section>`}`;
}

function menuExportar(nicho, cliente = '') {
  const c = cliente ? ` data-cliente="${esc(cliente)}"` : '';
  return `
    <details class="menu-mais rd-exportar">
      <summary class="botao botao-secundario${cliente ? ' botao-pequeno' : ''}">Exportar</summary>
      <div class="menu-mais-lista">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-exportar" data-como="pdf" data-id="${esc(nicho.id)}"${c}>Baixar PDF</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-exportar" data-como="whatsapp" data-id="${esc(nicho.id)}"${c}>Copiar para o WhatsApp</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-exportar" data-como="notion" data-id="${esc(nicho.id)}"${c}>Copiar para o Notion</button>
      </div>
    </details>`;
}

function painel(estado, nicho) {
  const r = resultadoDoRadar(estado, nicho.id);
  // Pedido feito aqui: "atualizando" até chegar um resultado mais novo que o pedido.
  const pedido = estado.radarPedido?.[nicho.id];
  const chegou = r?.gerado_em && pedido && Date.parse(r.gerado_em) >= pedido - 1000;
  const lendo = (r?.status === 'lendo' && Date.now() - Date.parse(r.pedido_em || 0) < 5 * 60e3) || (Boolean(pedido) && !chegou && r?.status !== 'erro');
  const itens = r?.itens || [];
  const vistos = vistosDoRadar(estado.config);
  const hist = r?.noticias_hist || [];
  const caixas = nicho.clientes.length ? nicho.clientes : [''];
  const totalNovas = caixas.reduce((t, c) => Math.max(t, novasDesde(hist, vistos[chaveDoVisto(nicho.id, c)], r?.inicio_em).length), 0);
  return `
    <section class="card rd-topo">
      <div class="rd-topo-linha">
        <div>
          <h2 class="card-titulo">${esc(nicho.nome)}${totalNovas ? ` <span class="selo rd-selo-novas">${totalNovas} ${totalNovas === 1 ? 'nova' : 'novas'}</span>` : ''}</h2>
          <p class="rd-palavras">${nicho.palavras.map((p) => `<span class="selo">${esc(p)}</span>`).join(' ')}</p>
        </div>
        <div class="rd-topo-acoes">
          <button class="botao botao-primario" type="button" data-acao="radar-atualizar" data-id="${esc(nicho.id)}"${lendo ? ' disabled aria-busy="true"' : ''}>${lendo ? 'Atualizando…' : 'Atualizar agora'}</button>
          ${r?.gerado_em ? menuExportar(nicho) : ''}
        </div>
      </div>
      <p class="campo-ajuda" role="status">${lendo ? 'Lendo o YouTube e as notícias e pesquisando na web. Leva até 1 minuto; pode sair da tela.'
        : r?.gerado_em ? `Análise de ${esc(fmtQuando.format(new Date(r.gerado_em)))}${r.fonte === 'simples' ? ' (só os sinais, sem a IA)' : ''}${r.noticias_em ? ` · notícias conferidas ${esc(fmtQuando.format(new Date(r.noticias_em)))}` : ''}. Atualiza sozinho: notícias a cada 2 h e a análise às 6h30.` : 'Ainda sem radar para este nicho.'}</p>
      ${r?.status === 'erro' && r.erro ? `<p class="ava-alerta">${esc(r.erro)}</p>` : ''}
      ${(r?.avisos || []).map((a) => `<p class="campo-ajuda rd-aviso">${esc(a)}</p>`).join('')}
    </section>
    ${abasDoNicho(estado, nicho, r, totalNovas)}
    ${conteudoDaAba(estado, nicho, r, { itens, lendo, caixas, vistos })}`;
}

const abaAtual = (estado) => (ABAS_RADAR.some(([id]) => id === estado.radarAba) ? estado.radarAba : 'geral');

function abasDoNicho(estado, nicho, r, totalNovas) {
  const n = (r?.noticias_hist || []).length;
  const rotulo = { clientes: totalNovas ? `Clientes · ${totalNovas}` : 'Clientes', noticias: n ? `Notícias · ${n}` : 'Notícias' };
  return `<div class="segmentado rd-abas" role="tablist" aria-label="Partes do radar">${ABAS_RADAR.map(([id, nome]) => `
    <button type="button" role="tab" data-acao="radar-parte" data-parte="${id}" aria-selected="${abaAtual(estado) === id}" aria-pressed="${abaAtual(estado) === id}">${esc(rotulo[id] || nome)}</button>`).join('')}</div>`;
}

function conteudoDaAba(estado, nicho, r, { itens, lendo, caixas, vistos }) {
  const aba = abaAtual(estado);
  if (aba === 'clientes') {
    return `<section class="rd-secao" aria-label="Por cliente"><div class="rd-caixas">${caixas.map((c) => caixaDaCliente(nicho, r, c, vistos, guardadasDoRadar(estado.config))).join('')}</div></section>`;
  }
  if (aba === 'noticias') {
    const hist = r?.noticias_hist || [];
    return `
      ${(r?.noticias || []).length ? `<section class="card rd-secao" aria-labelledby="rd-noticias">
        <h2 class="card-titulo" id="rd-noticias">Em alta, segundo a análise</h2>
        <ul class="rd-noticias">${r.noticias.map((x) => linhaDaNoticia(x)).join('')}</ul></section>` : ''}
      <section class="card rd-secao" aria-labelledby="rd-hist">
        <h2 class="card-titulo" id="rd-hist">Todas as notícias dos últimos 14 dias</h2>
        ${hist.length ? `<ul class="rd-noticias">${hist.slice(0, 60).map((x) => linhaDaNoticia(x)).join('')}</ul>` : '<p class="texto-suave">As notícias aparecem aqui assim que o radar rodar.</p>'}
      </section>`;
  }
  if (aba === 'sinais') return r?.gerado_em ? sinais(r, true) : '<p class="texto-suave rd-secao">Os sinais aparecem depois da primeira análise.</p>';
  return `
    ${r?.briefing ? `<section class="card rd-briefing"><p class="proximo-rotulo">Briefing da semana</p><p>${esc(r.briefing)}</p></section>` : ''}
    <section class="rd-secao" aria-labelledby="rd-bombar">
      <h2 class="rd-secao-titulo" id="rd-bombar">Vai bombar nas próximas 2 semanas</h2>
      ${itens.length ? `<div class="rd-itens">${itens.map((x, i) => itemDoRadar(x, i, nicho)).join('')}</div>`
        : `<p class="texto-suave">${lendo ? 'Montando…' : r?.gerado_em ? 'Nada subindo forte agora.' : 'Toque em Atualizar agora para montar o primeiro radar deste nicho.'}</p>`}
    </section>`;
}

const fmtNoticia = (n) => [n.fonte, n.data && !Number.isNaN(Date.parse(n.data)) ? fmtDia.format(new Date(n.data)) : ''].filter(Boolean).join(' · ');
const linhaDaNoticia = (n, nova = false) => `
  <li${nova ? ' class="rd-nova"' : ''}><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>
    <span class="campo-ajuda">${esc(fmtNoticia(n))}${n.termo ? ` · ${esc(n.termo)}` : ''}</span>
    ${n.porque ? `<span class="rd-porque">${esc(n.porque)}</span>` : ''}</li>`;

function caixaDaCliente(nicho, r, cliente, vistos, guardadas = []) {
  const hist = r?.noticias_hist || [];
  const novas = novasDesde(hist, vistos[chaveDoVisto(nicho.id, cliente)], r?.inicio_em);
  const sugestoes = (cliente && r?.clientes?.[cliente]?.sugestoes) || [];
  const id = `${nicho.id}-${cliente}`.replace(/[^a-z0-9-]/gi, '-');
  return `
    <article class="card rd-caixa" aria-labelledby="rd-cx-${esc(id)}">
      <div class="rd-caixa-topo">
        <h3 class="card-titulo" id="rd-cx-${esc(id)}">${esc(cliente || nicho.nome)}</h3>
        <span class="selo${novas.length ? ' rd-selo-novas' : ''}">${novas.length ? `${novas.length} ${novas.length === 1 ? 'notícia nova' : 'notícias novas'}` : 'Nada novo'}</span>
        <div class="rd-caixa-acoes">
          ${novas.length ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-visto" data-id="${esc(nicho.id)}" data-cliente="${esc(cliente)}">Marcar como visto</button>` : ''}
          ${r?.gerado_em && cliente ? menuExportar(nicho, cliente) : ''}
        </div>
      </div>
      ${novas.length ? `<ul class="rd-noticias rd-noticias-novas">${novas.slice(0, 3).map((n) => linhaDaNoticia(n, true)).join('')}</ul>
        ${novas.length > 3 ? `<details class="rd-mais"><summary>Ver as outras ${novas.length - 3}</summary><ul class="rd-noticias">${novas.slice(3, 30).map((n) => linhaDaNoticia(n, true)).join('')}</ul></details>` : ''}`
        : `<p class="campo-ajuda rd-nada-novo">${hist.length ? 'Nenhuma notícia nova desde a última vez.' : 'As notícias aparecem aqui assim que o radar rodar.'}</p>`}
      ${sugestoes.length ? blocosDeProducao(nicho, cliente, sugestoes, guardadas) : ''}
    </article>`;
}

// Produção mensal (Carol, 08/11/2026): só entra no meio da produção o urgente (prazo em até 3 dias);
// o resto fica para a pauta do mês seguinte, e ela guarda o que quer levar.
function blocosDeProducao(nicho, cliente, sugestoes, guardadas) {
  const hoje = hojeLocal();
  const { urgentes, proxima } = porProducao(sugestoes, hoje);
  const mes = nomeDoMesRadar(mesDaProxima(hoje));
  const ids = new Set(guardadas.filter((g) => g.cliente === cliente).map((g) => g.id));
  const daCliente = guardadas.filter((g) => g.cliente === cliente && g.mes === mesDaProxima(hoje)).length;
  return `
    <section class="rd-producao rd-producao-urgente" aria-label="Urgentes">
      <h4 class="rd-sub">Urgente · entra na produção atual</h4>
      ${urgentes.length ? `<div class="rd-sugestoes-grade">${urgentes.map(({ x, i }) => cartaoSugestao(nicho, cliente, x, i, { urgente: true })).join('')}</div>`
        : '<p class="campo-ajuda">Nada urgente agora. Só entra no meio da produção o que precisa ser postado em até 3 dias.</p>'}
    </section>
    ${proxima.length ? `
    <section class="rd-producao" aria-label="Próxima produção">
      <h4 class="rd-sub">Para a próxima produção · pauta de ${esc(mes)}${daCliente ? ` <span class="selo">${daCliente} ${daCliente === 1 ? 'guardada' : 'guardadas'}</span>` : ''}</h4>
      <div class="rd-sugestoes-grade">${proxima.map(({ x, i }) => cartaoSugestao(nicho, cliente, x, i, { guardar: mes, guardada: ids.has(idDaGuardada(cliente, x)) })).join('')}</div>
    </section>` : ''}`;
}

const dataDoPrazo = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

function cartaoSugestao(nicho, cliente, x, i, { urgente = false, guardar = '', guardada = false } = {}) {
  return `
    <article class="rd-sugestao${urgente ? ' rd-urgente' : ''}">
      ${urgente ? `<p class="rd-selo-urgente">Urgente · poste até ${esc(dataDoPrazo(x.prazo))}</p>` : ''}
      <p class="rd-temp">${esc([x.formato, x.linha].filter(Boolean).join(' · '))}</p>
      <h5 class="rd-tema">${esc(x.titulo)}</h5>
      ${x.noticia ? `<p class="rd-da-noticia"><span>Partiu desta notícia</span> <a href="${esc(x.noticia.link)}" target="_blank" rel="noopener">${esc(x.noticia.titulo)} ↗</a>${x.noticia.fonte || x.noticia.data ? ` <small>${esc([x.noticia.fonte, fmtCurtoData(x.noticia.data)].filter(Boolean).join(' · '))}</small>` : ''}</p>` : ''}
      ${x.gancho ? `<blockquote class="rd-gancho">${esc(x.gancho)}</blockquote>` : ''}
      <details class="rd-roteiro">
        <summary>Ver o roteiro</summary>
        ${x.caso ? `<p class="rd-caso"><strong>O caso:</strong> ${esc(x.caso)}</p>` : ''}
        ${x.estrutura ? `<p class="campo-ajuda"><strong>Estrutura:</strong> ${esc(x.estrutura)}</p>` : ''}
        ${x.gap ? `<p class="campo-ajuda"><strong>Gap:</strong> ${esc(x.gap)}</p>` : ''}
        ${x.esqueleto?.length ? `<p class="campo-ajuda"><strong>${/reels/i.test(x.formato) ? 'Blocos do roteiro' : 'Slides'}:</strong></p><ol class="rd-esqueleto">${x.esqueleto.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>` : ''}
        ${x.cta ? `<p class="campo-ajuda"><strong>CTA:</strong> ${esc(x.cta)}</p>` : ''}
        ${x.cuidado ? `<p class="campo-ajuda rd-cuidado"><strong>Cuidado:</strong> ${esc(x.cuidado)}</p>` : ''}
        ${x.porque_agora ? `<p class="campo-ajuda"><strong>Por que agora:</strong> ${esc(x.porque_agora)}${x.link && !x.noticia ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(dominio(x.link))} ↗</a>` : ''}</p>` : ''}
      </details>
      <div class="rd-item-acoes">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-criar-sugestao" data-id="${esc(nicho.id)}" data-cliente="${esc(cliente)}" data-i="${i}">Levar para o Criar</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-copiar-sugestao" data-id="${esc(nicho.id)}" data-cliente="${esc(cliente)}" data-i="${i}">Copiar</button>
        ${guardar ? (guardada ? `<span class="selo rd-guardada">Guardada para ${esc(guardar)}</span>`
          : `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-guardar" data-id="${esc(nicho.id)}" data-cliente="${esc(cliente)}" data-i="${i}">Guardar para ${esc(guardar)}</button>`) : ''}
      </div>
    </article>`;
}

// A bandeira do país do vídeo (pelas letras do código do país: BR → 🇧🇷); sem país, um globo.
function bandeira(pais) {
  const p = String(pais || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(p)) return '🌐';
  return String.fromCodePoint(...[...p].map((l) => 0x1f1e6 + l.charCodeAt(0) - 65));
}
const fmtCurtoData = (d) => {
  const t = Date.parse(d || '');
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

function itemDoRadar(x, i, nicho) {
  const t = temp(x.temperatura);
  return `
    <article class="card rd-item temp-${esc(t.id)}">
      <p class="rd-temp"><span class="rd-ponto" aria-hidden="true"></span>${esc(t.nome)}${x.janela ? ` · ${esc(x.janela)}` : ''}</p>
      <h3 class="rd-tema">${esc(x.tema)}</h3>
      ${x.porque ? `<p class="rd-porque">${esc(x.porque)}</p>` : ''}
      ${x.gancho ? `<blockquote class="rd-gancho">${esc(x.gancho)}</blockquote>` : ''}
      <p class="campo-ajuda">${esc([x.formato, x.serve_para?.length ? `Serve para ${x.serve_para.join(', ')}` : ''].filter(Boolean).join(' · '))}</p>
      ${x.links?.length ? `<p class="rd-links">${x.links.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(dominio(l))} ↗</a>`).join('')}</p>` : ''}
      <div class="rd-item-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-criar" data-id="${esc(nicho.id)}" data-i="${i}">Levar para o Criar</button></div>
    </article>`;
}

function sinais(r, aberto = false) {
  const videos = r.videos || [];
  const termos = (r.termos || []).filter((t) => t.recentes || t.antes);
  const datas = r.datas || [];
  if (!videos.length && !termos.length && !datas.length) return '';
  return `
    <details class="card rd-sinais"${aberto ? ' open' : ''}>
      <summary><strong>Os sinais por trás do radar</strong></summary>
      ${videos.length ? `<h3 class="rd-sub">Vídeos subindo no YouTube (7 dias, Brasil e EUA)</h3><ul class="lista-simples">${videos.map((v) => `
        <li><a href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.titulo)}</a>
          <span class="campo-ajuda">${bandeira(v.pais)} ${esc(v.canal)} · ${Number(v.porHora || 0).toLocaleString('pt-BR')}/hora${v.short ? ' · Short' : ''}${v.fora ? ' · fora do Brasil e dos EUA, muito acima da média' : ''}</span></li>`).join('')}</ul>` : ''}
      ${termos.length ? `<h3 class="rd-sub">Notícias por termo</h3><ul class="lista-simples">${termos.map((t) => `
        <li><span>${esc(t.termo)}</span><span class="campo-ajuda">${t.recentes} em 48 h${t.subida ? ` · ${String(t.subida).replace('.', ',')}× o ritmo` : ''}</span></li>`).join('')}</ul>` : ''}
      ${datas.length ? `<h3 class="rd-sub">Datas do período</h3><ul class="lista-simples">${datas.map((d) => `
        <li><span>${esc(d.titulo)}</span><span class="campo-ajuda">${esc(fmtDia.format(new Date(`${d.data}T12:00:00`)))}${d.conferir ? ' · confira antes de postar' : ''}</span></li>`).join('')}</ul>` : ''}
    </details>`;
}

function formNicho(estado, nicho, nichos) {
  const nomes = clientesVivas(estado).map((c) => c.nome);
  return `
    ${cabecalho(nicho ? `Editar ${nicho.nome}` : 'Novo nicho', 'Um nicho é um assunto com as palavras que as pessoas usam para falar dele. O radar busca por essas palavras, sem hashtag.')}
    <form class="card formulario rd-form" data-form="radar-nicho" data-id="${esc(nicho?.id || '')}" novalidate>
      ${nicho ? '' : `<label class="campo"><span class="campo-rotulo">Especialidade <small>(preenche o nome e as palavras)</small></span>
        <input name="especialidade" type="search" list="rd-especialidades" autocomplete="off" data-acao-mudar="radar-especialidade" placeholder="Digite: neuro, pneumo, dentista…"></label>${listaDeEspecialidades()}`}
      <label class="campo"><span class="campo-rotulo">Nome do nicho</span>
        <input name="nome" type="text" maxlength="60" required value="${esc(nicho?.nome || '')}" placeholder="Ex.: Dermatologia"></label>
      <label class="campo"><span class="campo-rotulo">Palavras-chave (até ${MAX_PALAVRAS}, separadas por vírgula)</span>
        <textarea name="palavras" rows="2" maxlength="400" placeholder="Ex.: skincare, acne, manchas na pele, protetor solar">${esc(nicho?.palavras.join(', ') || '')}</textarea>
        <span class="campo-ajuda">Use as palavras que o público usa, não os termos técnicos. As 3 primeiras também buscam no YouTube.</span></label>
      ${nomes.length ? `<fieldset class="campo"><legend class="campo-rotulo">Clientes deste nicho</legend>
        <div class="grupo-marcar rd-clientes">${nomes.map((n) => `
          <label class="campo-marcar"><input type="checkbox" name="clientes" value="${esc(n)}"${nicho?.clientes.includes(n) ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div></fieldset>` : ''}
      <p class="ava-alerta" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${nicho ? 'Salvar' : 'Criar e montar o radar'}</button>
        <a class="botao botao-secundario" href="#radar${nicho ? `/${esc(nicho.id)}` : ''}">Cancelar</a>
        ${nicho ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="radar-excluir" data-id="${esc(nicho.id)}">Excluir o nicho</button>` : ''}
      </div>
    </form>`;
}
