// Trabalho → Pautas (#pautas e #pautas/<cliente>:<AAAA-MM>): escolher as peças do Trello, as artes e a
// legenda, ver a prévia e baixar a pauta no modelo da Confluir (PPTX e PDF).

import { cabecalho } from './componentes.js';
import { esc } from './utilidades.js';
import { clientesAtivos, clientePelaChave } from './dados-trabalho.js';
import { mesCurto, nomeDoMes } from './dados-relatorio.js';
import {
  TIPOS, pautasSalvas, pautaDaRota, lerParametroPauta, parametroDaPauta, mesDaPautaPadrao, cartaoDoMes, ehImagem, ehVideo, listaEmAprovacao, ordenarLaminas,
} from './dados-pauta.js';

export function renderPautas(estado) {
  const p = lerParametroPauta(estado.parametro);
  return p ? editor(estado, p) : lista(estado);
}

function lista(estado) {
  const salvas = pautasSalvas(estado.config);
  const clientes = clientesAtivos(estado);
  const confluir = clientes.filter((c) => c.casa === 'confluir');
  const outros = clientes.filter((c) => c.casa !== 'confluir');
  const opcao = (c) => `<option value="${esc(c.chave)}">${esc(c.nome)}</option>`;
  const porMes = new Map();
  for (const s of salvas) {
    if (!porMes.has(s.mes)) porMes.set(s.mes, []);
    porMes.get(s.mes).push(s);
  }
  return `
    ${cabecalho('Pautas', 'As artes prontas do Trello com a legenda, no modelo da Confluir. Baixe em PPTX ou PDF.')}
    <div class="rel-lista">
      <form class="card formulario rel-novo" data-form="pauta-nova" novalidate>
        <h2 class="card-titulo">Nova pauta</h2>
        <label class="campo"><span class="campo-rotulo">Cliente</span>
          <select name="cliente">
            ${confluir.length ? `<optgroup label="Confluir">${confluir.map(opcao).join('')}</optgroup>` : ''}
            ${outros.length ? `<optgroup label="Outras">${outros.map(opcao).join('')}</optgroup>` : ''}
          </select></label>
        <label class="campo"><span class="campo-rotulo">Mês</span><input name="mes" type="month" value="${esc(mesDaPautaPadrao())}" required></label>
        <div class="acoes"><button class="botao botao-primario" type="submit"${clientes.length ? '' : ' disabled'}>Começar</button></div>
        <p class="campo-ajuda" data-erro${clientes.length ? ' hidden' : ''}>${clientes.length ? '' : 'Sincronize o Trabalho primeiro para trazer as clientes.'}</p>
      </form>
      <section aria-label="Pautas feitas">
        ${salvas.length ? [...porMes.entries()].map(([mes, l]) => `
          <h2 class="rel-mes">${esc(nomeDoMes(mes))} de ${esc(mes.slice(0, 4))}</h2>
          <div class="rel-cartoes">${l.map((s) => `<article class="card rel-cartao">
            <a class="rel-cartao-link" href="#pautas/${esc(parametroDaPauta(s.cliente, s.mes))}"><b>${esc(s.valor.nome || s.cliente)}</b><small>${(s.valor.pecas || []).length} ${(s.valor.pecas || []).length === 1 ? 'peça' : 'peças'}</small></a>
            <button class="botao-icone rel-cartao-tirar" type="button" data-acao="pauta-excluir" data-valor="${esc(s.chave)}" aria-label="Excluir a pauta de ${esc(s.valor.nome || s.cliente)}" title="Excluir">×</button>
          </article>`).join('')}</div>`).join('')
        : '<div class="card rel-vazio"><p class="texto-suave">Nenhuma pauta ainda. Escolha a cliente e o mês para começar.</p></div>'}
      </section>
    </div>`;
}

const dataCurta = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

function editor(estado, p) {
  const cli = clientePelaChave(estado, p.cliente);
  const pauta = pautaDaRota(estado, estado.parametro, cli?.nome || '');
  const busca = estado.pautaCartoes?.chave === pauta.chave ? estado.pautaCartoes : null;
  const cartoes = busca?.cartoes || [];
  const naPauta = new Set(pauta.pecas.map((x) => x.card));
  const filtro = ['aprovacao', 'mes', 'todos'].includes(estado.pautaFiltro) ? estado.pautaFiltro : 'aprovacao';
  const passa = (c) => filtro === 'todos' || naPauta.has(c.id) || (filtro === 'mes' ? cartaoDoMes(c, pauta.mes) : listaEmAprovacao(c.lista));
  const visiveis = cartoes.filter(passa)
    .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const artes = estado.pautaArtes || {};
  const ocupado = estado.pautaOcupado || '';
  const leg = estado.pautaLegendas || {};
  const faltam = pauta.pecas.filter((x) => !String(x.legenda).trim()).length;
  return `
    ${cabecalho(`Pauta de ${nomeDoMes(pauta.mes).toLowerCase()}`, `${esc(pauta.nome || 'Sem nome')} · ${esc(mesCurto(pauta.mes))}`)}
    <div class="acoes cal-acoes tb-acoes rel-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#pautas">← Pautas</a>
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="pauta-baixar" data-valor="pptx"${ocupado || !pauta.pecas.length ? ' disabled' : ''}>Baixar PPTX</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="pauta-baixar" data-valor="pdf"${ocupado || !pauta.pecas.length ? ' disabled' : ''}>Baixar PDF</button>
      <span class="texto-suave rel-ocupado" aria-live="polite">${esc(ocupado)}</span>
    </div>
    <div class="rel-editor">
      <div class="rel-form">
        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">1</span>Peças do Trello</h2>
          <label class="campo"><span class="campo-rotulo">Nome na capa</span>
            <input type="text" maxlength="80" value="${esc(pauta.nome)}" data-acao-mudar="pauta-nome"></label>
          <div class="pauta-busca-topo">
            <div class="segmentado" role="group" aria-label="Quais cartões">
              ${[['aprovacao', 'Em aprovação'], ['mes', `De ${nomeDoMes(pauta.mes).toLowerCase()}`], ['todos', 'Todos']].map(([id, nome]) => `<button type="button" class="segmentado-opcao${filtro === id ? ' ativo' : ''}" data-acao="pauta-filtro" data-valor="${id}" aria-pressed="${filtro === id}">${esc(nome)}</button>`).join('')}
            </div>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="pauta-buscar"${busca?.carregando ? ' disabled' : ''}>${busca?.carregando ? 'Buscando…' : 'Buscar de novo'}</button>
          </div>
          ${busca?.erro ? `<p class="campo-ajuda rel-erro">${esc(busca.erro)}</p>` : ''}
          ${busca?.carregando && !cartoes.length ? '<p class="texto-suave">Lendo os quadros do Trello…</p>' : ''}
          ${busca && !busca.carregando && !visiveis.length && !busca.erro ? `<p class="texto-suave">${{ aprovacao: 'Nada nas listas de aprovação dessa cliente agora. Veja o mês ou "Todos".', mes: `Nenhum cartão de ${esc(nomeDoMes(pauta.mes).toLowerCase())} (pela lista do mês ou pela data). Veja em "Todos".`, todos: 'Nenhum cartão com a etiqueta dessa cliente.' }[filtro]}</p>` : ''}
          ${visiveis.some((c) => !naPauta.has(c.id)) ? `<div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="pauta-marcar-todas">Marcar todas (${visiveis.filter((c) => !naPauta.has(c.id)).length})</button></div>` : ''}
          <ul class="pauta-cartoes">
            ${visiveis.map((c) => {
              const imgs = c.anexos.filter(ehImagem).length;
              const vids = c.anexos.filter(ehVideo).length;
              return `<li><label class="pauta-cartao${naPauta.has(c.id) ? ' marcado' : ''}">
                <input type="checkbox" data-acao-mudar="pauta-marcar" value="${esc(c.id)}"${naPauta.has(c.id) ? ' checked' : ''}>
                <span class="pauta-cartao-texto"><b>${esc(c.titulo)}</b>
                <small>${esc([c.lista, c.quadro].filter(Boolean).join(' · '))}${c.data ? ` · ${esc(dataCurta(c.data))}` : ''}</small>
                <small>${imgs ? `${imgs} ${imgs === 1 ? 'imagem' : 'imagens'}` : 'sem imagem'}${vids ? ` · ${vids} vídeo${vids > 1 ? 's' : ''}` : ''}${c.descricao ? ' · tem descrição' : ''}</small></span>
              </label></li>`;
            }).join('')}
          </ul>
        </section>

        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">2</span>Na pauta · ${pauta.pecas.length}</h2>
          ${pauta.pecas.length ? '' : '<p class="texto-suave">Marque as peças acima. Elas entram na ordem da data, e você muda a ordem aqui.</p>'}
          <div class="acoes">
            <label class="botao botao-secundario botao-pequeno rel-arquivo">+ Post extra (imagens, PDF ou PPTX)<input type="file" accept="image/*,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple data-acao-mudar="pauta-extra"></label>
            ${pauta.pecas.length ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="pauta-ia-todas"${faltam ? '' : ' disabled'}>Escrever as ${faltam || ''} legendas que faltam com a IA</button>` : ''}
          </div>
          ${estado.pautaImportando ? `<p class="campo-ajuda" aria-live="polite">${esc(estado.pautaImportando)}</p>` : ''}
          <ol class="pauta-pecas">
            ${pauta.pecas.map((x, i) => peca(x, i, pauta.pecas.length, cartoes.find((c) => c.id === x.card), artes, leg[x.card])).join('')}
          </ol>
        </section>
      </div>

      <aside class="rel-previa-coluna" aria-label="Prévia da pauta">
        <p class="tb-rot">Prévia</p>
        <div class="rel-previa" data-pauta-previa></div>
      </aside>
    </div>`;
}

function peca(x, i, total, cartao, artes, legenda) {
  const anexos = [...ordenarLaminas(cartao?.anexos || []), ...(x.locais || []).map((l) => ({ id: l.id, nome: 'Imagem do aparelho', tipo: 'image/jpeg' }))];
  const escolhidos = new Set(x.anexos);
  const status = legenda?.status === 'lendo' || legenda?.status === 'enviando' ? 'A IA está escrevendo a legenda…' : legenda?.status === 'erro' ? legenda.erro : '';
  return `<li class="pauta-peca" data-card="${esc(x.card)}">
    <div class="pauta-peca-topo">
      <span class="rel-num">${i + 1}</span>${x.extra ? '<span class="selo">Extra</span>' : ''}
      <select aria-label="Tipo da peça ${i + 1}" data-acao-mudar="pauta-campo" data-campo="tipo" data-card="${esc(x.card)}">${TIPOS.map((t) => `<option${t === x.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <input class="pauta-titulo" type="text" maxlength="120" value="${esc(x.titulo)}" aria-label="Título da peça ${i + 1}" data-acao-mudar="pauta-campo" data-campo="titulo" data-card="${esc(x.card)}">
      <div class="pauta-ordem">
        <button class="botao-icone" type="button" data-acao="pauta-mover" data-card="${esc(x.card)}" data-valor="-1"${i === 0 ? ' disabled' : ''} aria-label="Subir" title="Subir">↑</button>
        <button class="botao-icone" type="button" data-acao="pauta-mover" data-card="${esc(x.card)}" data-valor="1"${i === total - 1 ? ' disabled' : ''} aria-label="Descer" title="Descer">↓</button>
        <button class="botao-icone" type="button" data-acao="pauta-tirar" data-card="${esc(x.card)}" aria-label="Tirar da pauta" title="Tirar da pauta">×</button>
      </div>
    </div>
    ${cartao || x.extra || x.locais?.length ? `<div class="pauta-artes" role="group" aria-label="Artes da peça ${i + 1}">
      ${anexos.length ? anexos.map((a) => {
        const arte = artes[`${x.card}:${a.id}`];
        const ligado = escolhidos.has(a.id);
        const ordem = x.anexos.indexOf(a.id) + 1;
        return `<button type="button" class="pauta-arte${ligado ? ' ligada' : ''}" data-acao="pauta-anexo" data-card="${esc(x.card)}" data-valor="${esc(a.id)}" aria-pressed="${ligado}" title="${esc(a.nome)}">
          ${arte?.src ? `<img src="${esc(arte.src)}" alt="">` : `<span class="pauta-arte-vazia">${arte?.erro ? '!' : ehVideo(a) ? '▶' : '…'}</span>`}
          ${ligado ? `<i class="pauta-arte-n">${ordem}</i>` : ''}
        </button>`;
      }).join('') : '<p class="texto-suave">Sem imagem no cartão.</p>'}
      <label class="pauta-arte pauta-arte-nova" title="Escolher uma imagem do aparelho"><input type="file" accept="image/*" data-acao-mudar="pauta-arquivo" data-card="${esc(x.card)}"><span aria-hidden="true">+</span></label>
    </div>
    ${anexos.some((a) => artes[`${x.card}:${a.id}`]?.erro && escolhidos.has(a.id)) ? `<p class="campo-ajuda rel-erro">${esc(anexos.map((a) => artes[`${x.card}:${a.id}`]?.erro).find(Boolean))}</p>` : ''}` : '<p class="texto-suave">Buscando o cartão no Trello…</p>'}
    <div class="pauta-legenda">
      <div class="segmentado" role="group" aria-label="Legenda da peça ${i + 1}">
        <button type="button" class="segmentado-opcao${x.modo === 'descricao' ? ' ativo' : ''}" data-acao="pauta-modo" data-card="${esc(x.card)}" data-valor="descricao" aria-pressed="${x.modo === 'descricao'}"${x.descricao ? '' : ' disabled'}>Da descrição</button>
        <button type="button" class="segmentado-opcao${x.modo !== 'descricao' ? ' ativo' : ''}" data-acao="pauta-modo" data-card="${esc(x.card)}" data-valor="ia" aria-pressed="${x.modo !== 'descricao'}">Escrever</button>
      </div>
      <textarea rows="6" maxlength="2200" aria-label="Legenda da peça ${i + 1}" data-acao-mudar="pauta-campo" data-campo="legenda" data-card="${esc(x.card)}" placeholder="${x.modo === 'descricao' ? 'A legenda da descrição do cartão aparece aqui.' : 'Escreva, ou peça à IA (ela olha as artes e a descrição do cartão).'}">${esc(x.legenda)}</textarea>
      ${x.modo !== 'descricao' ? `<div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="pauta-ia" data-card="${esc(x.card)}"${status && legenda?.status !== 'erro' ? ' disabled' : ''}>${x.legenda ? 'Escrever de novo com a IA' : 'Escrever com a IA'}</button></div>` : ''}
      ${status ? `<p class="campo-ajuda${legenda?.status === 'erro' ? ' rel-erro' : ''}" aria-live="polite">${esc(status)}</p>` : ''}
      ${x.descricao && x.modo !== 'descricao' ? `<details class="pauta-desc"><summary>Descrição do cartão</summary><p>${esc(x.descricao)}</p></details>` : ''}
    </div>
  </li>`;
}
