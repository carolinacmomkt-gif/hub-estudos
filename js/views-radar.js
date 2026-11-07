// Tela do Radar do nicho (#radar, #radar/<nicho>, #radar/novo, #radar/editar:<nicho>): o que vai
// bombar nas próximas 2 semanas, as notícias em alta, o briefing da semana e os sinais por trás.

import { esc } from './utilidades.js';
import { cabecalho } from './componentes.js';
import { TEMPERATURAS, nichosDoRadar, sugerirNichos, chaveDoRadar, MAX_PALAVRAS } from './dados-radar.js';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtQuando = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } };
const temp = (id) => TEMPERATURAS.find((t) => t.id === id) || TEMPERATURAS[1];

export const resultadoDoRadar = (estado, id) => (estado.config || []).find((c) => c.chave === chaveDoRadar(id) && !c.excluido_em)?.valor || null;
const clientesVivas = (estado) => (estado.clientesTrabalho || []).filter((c) => !c.excluido_em);

export function renderRadar(estado) {
  const nichos = nichosDoRadar(estado.config);
  const p = estado.parametro || '';
  if (p === 'novo' || !nichos.length) return formNicho(estado, null, nichos);
  if (p.startsWith('editar:')) return formNicho(estado, nichos.find((n) => n.id === p.slice(7)) || null, nichos);
  const nicho = nichos.find((n) => n.id === p) || nichos[0];
  return `
    ${cabecalho('Radar do nicho', 'O que está subindo no nicho das suas clientes para as próximas 2 semanas, pelos sinais do YouTube, das notícias e das datas. Sem hashtag e sem áudio.', '<a class="botao botao-primario" href="#radar/novo">+ Novo nicho</a>')}
    ${nichos.length > 1 ? `<div class="segmentado rd-nichos" role="group" aria-label="Nichos">${nichos.map((n) => `
      <button type="button" data-acao="radar-aba" data-id="${esc(n.id)}" aria-pressed="${n.id === nicho.id}">${esc(n.nome)}</button>`).join('')}</div>` : ''}
    ${painel(estado, nicho)}`;
}

function painel(estado, nicho) {
  const r = resultadoDoRadar(estado, nicho.id);
  // Pedido feito aqui: "atualizando" até chegar um resultado mais novo que o pedido.
  const pedido = estado.radarPedido?.[nicho.id];
  const chegou = r?.gerado_em && pedido && Date.parse(r.gerado_em) >= pedido - 1000;
  const lendo = (r?.status === 'lendo' && Date.now() - Date.parse(r.pedido_em || 0) < 5 * 60e3) || (Boolean(pedido) && !chegou && r?.status !== 'erro');
  const itens = r?.itens || [];
  return `
    <section class="card rd-topo">
      <div class="rd-topo-linha">
        <div>
          <h2 class="card-titulo">${esc(nicho.nome)}</h2>
          <p class="rd-palavras">${nicho.palavras.map((p) => `<span class="selo">${esc(p)}</span>`).join(' ')}</p>
          ${nicho.clientes.length ? `<p class="campo-ajuda">Para ${esc(nicho.clientes.join(', '))}</p>` : ''}
        </div>
        <div class="rd-topo-acoes">
          <button class="botao botao-primario" type="button" data-acao="radar-atualizar" data-id="${esc(nicho.id)}"${lendo ? ' disabled aria-busy="true"' : ''}>${lendo ? 'Atualizando…' : 'Atualizar'}</button>
          <a class="botao botao-secundario" href="#radar/editar:${esc(nicho.id)}">Editar</a>
        </div>
      </div>
      <p class="campo-ajuda" role="status">${lendo ? 'Lendo o YouTube e as notícias e pesquisando na web. Leva até 1 minuto; pode sair da tela.'
        : r?.gerado_em ? `Atualizado ${esc(fmtQuando.format(new Date(r.gerado_em)))}${r.fonte === 'simples' ? ' · só os sinais, sem a análise da IA' : ''}.` : 'Ainda sem radar para este nicho.'}</p>
      ${r?.status === 'erro' && r.erro ? `<p class="ava-alerta">${esc(r.erro)}</p>` : ''}
      ${(r?.avisos || []).map((a) => `<p class="campo-ajuda rd-aviso">${esc(a)}</p>`).join('')}
    </section>
    ${r?.briefing ? `<section class="card rd-briefing"><p class="proximo-rotulo">Briefing da semana</p><p>${esc(r.briefing)}</p></section>` : ''}
    <section class="rd-secao" aria-labelledby="rd-bombar">
      <h2 class="rd-secao-titulo" id="rd-bombar">Vai bombar nas próximas 2 semanas</h2>
      ${itens.length ? `<div class="rd-itens">${itens.map((x, i) => itemDoRadar(x, i, nicho)).join('')}</div>`
        : `<p class="texto-suave">${lendo ? 'Montando…' : 'Toque em Atualizar para montar o radar deste nicho.'}</p>`}
    </section>
    ${(r?.noticias || []).length ? `
      <section class="card rd-secao" aria-labelledby="rd-noticias">
        <h2 class="card-titulo" id="rd-noticias">Notícias em alta</h2>
        <ul class="rd-noticias">${r.noticias.map((n) => `
          <li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>
            <span class="campo-ajuda">${esc([n.fonte, n.data && !Number.isNaN(Date.parse(n.data)) ? fmtDia.format(new Date(n.data)) : ''].filter(Boolean).join(' · '))}</span>
            ${n.porque ? `<span class="rd-porque">${esc(n.porque)}</span>` : ''}</li>`).join('')}</ul>
      </section>` : ''}
    ${r?.gerado_em ? sinais(r) : ''}`;
}

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

function sinais(r) {
  const videos = r.videos || [];
  const termos = (r.termos || []).filter((t) => t.recentes || t.antes);
  const datas = r.datas || [];
  if (!videos.length && !termos.length && !datas.length) return '';
  return `
    <details class="card rd-sinais">
      <summary><strong>Os sinais por trás do radar</strong></summary>
      ${videos.length ? `<h3 class="rd-sub">Vídeos subindo no YouTube (7 dias)</h3><ul class="lista-simples">${videos.map((v) => `
        <li><a href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.titulo)}</a>
          <span class="campo-ajuda">${esc(v.canal)} · ${Number(v.porHora || 0).toLocaleString('pt-BR')}/hora${v.short ? ' · Short' : ''}</span></li>`).join('')}</ul>` : ''}
      ${termos.length ? `<h3 class="rd-sub">Notícias por termo</h3><ul class="lista-simples">${termos.map((t) => `
        <li><span>${esc(t.termo)}</span><span class="campo-ajuda">${t.recentes} em 48 h${t.subida ? ` · ${String(t.subida).replace('.', ',')}× o ritmo` : ''}</span></li>`).join('')}</ul>` : ''}
      ${datas.length ? `<h3 class="rd-sub">Datas do período</h3><ul class="lista-simples">${datas.map((d) => `
        <li><span>${esc(d.titulo)}</span><span class="campo-ajuda">${esc(fmtDia.format(new Date(`${d.data}T12:00:00`)))}${d.conferir ? ' · confira antes de postar' : ''}</span></li>`).join('')}</ul>` : ''}
    </details>`;
}

function formNicho(estado, nicho, nichos) {
  const sugestoes = nicho ? [] : sugerirNichos(clientesVivas(estado), nichos);
  const nomes = clientesVivas(estado).map((c) => c.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return `
    ${cabecalho(nicho ? `Editar ${nicho.nome}` : 'Novo nicho', 'Um nicho é um assunto com as palavras que as pessoas usam para falar dele. O radar busca por essas palavras, sem hashtag.')}
    ${sugestoes.length ? `
      <section class="card">
        <h2 class="card-titulo">Pelas suas clientes</h2>
        <ul class="rd-sugestoes">${sugestoes.map((s, i) => `
          <li><div><strong>${esc(s.nome)}</strong><span class="campo-ajuda">${esc(s.palavras.join(', '))} · ${esc(s.clientes.join(', '))}</span></div>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="radar-sugestao" data-i="${i}">Usar</button></li>`).join('')}</ul>
        ${sugestoes.length > 1 ? '<div class="acoes"><button class="botao botao-secundario" type="button" data-acao="radar-sugestoes-todas">Criar todos</button></div>' : ''}
      </section>` : ''}
    <form class="card formulario" data-form="radar-nicho" data-id="${esc(nicho?.id || '')}" novalidate>
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
        ${nichos.length ? `<a class="botao botao-secundario" href="#radar${nicho ? `/${esc(nicho.id)}` : ''}">Cancelar</a>` : ''}
        ${nicho ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="radar-excluir" data-id="${esc(nicho.id)}">Excluir o nicho</button>` : ''}
      </div>
    </form>`;
}
