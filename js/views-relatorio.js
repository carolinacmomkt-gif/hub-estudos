// Trabalho → Relatórios (#relatorio e #relatorio/<cliente>:<AAAA-MM>).
// Lista dos relatórios e o editor: prints → números (IA) → conteúdo relevante → considerações → PPTX e PDF.

import { cabecalho } from './componentes.js';
import { esc } from './utilidades.js';
import { clientesAtivos, clientePelaChave } from './dados-trabalho.js';
import {
  METRICAS, SLIDES, relatoriosSalvos, relatorioDaRota, lerParametro, parametroDe, mesPadrao, mesCurto, nomeDoMes,
  formatar, comparar, textoComparacao, anteriorDe,
} from './dados-relatorio.js';

export function renderRelatorio(estado) {
  const p = lerParametro(estado.parametro);
  return p ? editor(estado, p) : listaDeRelatorios(estado);
}

function listaDeRelatorios(estado) {
  const salvos = relatoriosSalvos(estado.config);
  const clientes = clientesAtivos(estado);
  const porMes = new Map();
  for (const r of salvos) {
    if (!porMes.has(r.mes)) porMes.set(r.mes, []);
    porMes.get(r.mes).push(r);
  }
  return `
    ${cabecalho('Relatórios', 'Relatório de métricas no modelo da Confluir: suba os prints, confira os números e baixe em PPTX ou PDF.')}
    <div class="rel-lista">
      <form class="card formulario rel-novo" data-form="rel-novo" novalidate>
        <h2 class="card-titulo">Novo relatório</h2>
        <label class="campo"><span class="campo-rotulo">Cliente</span>
          <select name="cliente" data-acao-mudar="rel-novo-cliente">
            ${clientes.map((c) => `<option value="${esc(c.chave)}">${esc(c.nome)}</option>`).join('')}
            <option value="">Outro (digitar o nome)</option>
          </select></label>
        <label class="campo" data-rel-outro${clientes.length ? ' hidden' : ''}><span class="campo-rotulo">Nome que aparece no relatório</span>
          <input name="nome" type="text" maxlength="80" placeholder="Ex.: Dra. Karyne Magalhães"></label>
        <label class="campo"><span class="campo-rotulo">Mês</span><input name="mes" type="month" value="${esc(mesPadrao())}" required></label>
        <div class="acoes"><button class="botao botao-primario" type="submit">Começar</button></div>
        <p class="campo-ajuda" data-erro hidden></p>
      </form>
      <section class="rel-salvos" aria-label="Relatórios feitos">
        ${salvos.length ? [...porMes.entries()].map(([mes, lista]) => `
          <h2 class="rel-mes">${esc(nomeDoMes(mes))} de ${esc(mes.slice(0, 4))}</h2>
          <div class="rel-cartoes">${lista.map((r) => cartao(r)).join('')}</div>`).join('')
        : '<div class="card rel-vazio"><p class="texto-suave">Nenhum relatório ainda. Escolha a cliente e o mês ao lado para começar.</p></div>'}
      </section>
    </div>`;
}

function cartao(r) {
  const n = r.valor.numeros || {};
  const feitos = METRICAS.filter((m) => Number.isFinite(n[m.id])).length;
  const href = `#relatorio/${parametroDe(r.cliente, r.mes)}`;
  return `<article class="card rel-cartao">
    <a class="rel-cartao-link" href="${esc(href)}">
      <b>${esc(r.valor.nome || r.cliente)}</b>
      <small>${feitos ? `${feitos} de ${METRICAS.length} números` : 'Sem números ainda'}${Number.isFinite(n.alcance) ? ` · ${esc(formatar(n.alcance))} alcançadas` : ''}</small>
    </a>
    <button class="botao-icone rel-cartao-tirar" type="button" data-acao="rel-excluir" data-valor="${esc(r.chave)}" aria-label="Excluir o relatório de ${esc(r.valor.nome || r.cliente)}" title="Excluir">×</button>
  </article>`;
}

function editor(estado, p) {
  const cli = clientePelaChave(estado, p.cliente);
  const rel = relatorioDaRota(estado, estado.parametro, cli?.nome || '');
  const anterior = anteriorDe(estado, rel);
  const prints = estado.relPrints?.chave === rel.chave ? estado.relPrints.lista : [];
  const leitura = estado.relLeitura?.chave === rel.chave ? estado.relLeitura : null;
  const lendo = leitura && /enviando|lendo/.test(leitura.status);
  const ocupado = estado.relOcupado || '';
  return `
    ${cabecalho('Relatório de métricas', `${esc(rel.nome || 'Sem nome')} · ${esc(mesCurto(rel.mes))}`)}
    <div class="acoes cal-acoes tb-acoes rel-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#relatorio">← Relatórios</a>
      <button class="botao botao-primario botao-pequeno" type="button" data-acao="rel-baixar" data-valor="pptx"${ocupado ? ' disabled' : ''}>Baixar PPTX</button>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="rel-baixar" data-valor="pdf"${ocupado ? ' disabled' : ''}>Baixar PDF</button>
      <span class="texto-suave rel-ocupado" aria-live="polite" data-rel-ocupado>${esc(ocupado)}</span>
    </div>
    <div class="rel-editor">
      <div class="rel-form">
        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">1</span>Prints do Instagram</h2>
          <p class="texto-suave">Os prints das estatísticas do mês: visão geral, atividade do perfil, alcance, seguidores, interações e principais conteúdos.</p>
          <label class="campo"><span class="campo-rotulo">Nome que aparece no relatório</span>
            <input type="text" maxlength="80" value="${esc(rel.nome)}" data-acao-mudar="rel-campo" data-campo="nome"></label>
          <div class="rel-prints">
            ${prints.map((pr, i) => `<figure class="rel-print"><img src="${esc(pr.url)}" alt="Print ${i + 1}"><button class="botao-icone rel-print-tirar" type="button" data-acao="rel-print-tirar" data-valor="${esc(pr.id)}" aria-label="Tirar o print ${i + 1}">×</button></figure>`).join('')}
            <label class="rel-print-novo"><input type="file" accept="image/*" multiple data-acao-mudar="rel-prints"><span aria-hidden="true">+</span><small>${prints.length ? 'Mais prints' : 'Escolher prints'}</small></label>
          </div>
          <div class="acoes">
            <button class="botao botao-primario" type="button" data-acao="rel-ler"${!prints.length || lendo ? ' disabled' : ''}>${lendo ? 'Lendo os prints…' : 'Ler os números com a IA'}</button>
          </div>
          <p class="campo-ajuda${leitura?.status === 'erro' ? ' rel-erro' : ''}" aria-live="polite">${esc(textoDaLeitura(leitura, prints.length))}</p>
        </section>

        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">2</span>Números do mês</h2>
          <p class="texto-suave">Confira com o print. O que estiver vazio sai como "—" (ou desligue o slide abaixo).</p>
          <div class="rel-numeros">
            ${METRICAS.map((m) => {
              const comp = textoComparacao(comparar(rel, anterior, m.id));
              return `<label class="campo rel-numero"><span class="campo-rotulo" title="${esc(m.rotulo)}">${esc(m.curto)}</span>
                <input type="text" inputmode="numeric" autocomplete="off" value="${esc(formatar(rel.numeros[m.id]))}" placeholder="—" data-acao-mudar="rel-numero" data-campo="${m.id}">
                <small class="rel-comp" data-rel-comp="${m.id}">${esc(comp)}</small></label>`;
            }).join('')}
          </div>
          ${anterior ? `<p class="campo-ajuda">Comparando com o relatório de ${esc(mesCurto(anterior.mes))}.</p>` : '<p class="campo-ajuda">Sem relatório do mês anterior: a comparação vem da porcentagem que o print mostra (quando mostra).</p>'}
          <fieldset class="rel-slides"><legend class="campo-rotulo">Slides do relatório</legend>
            ${SLIDES.map((s) => `<label class="rel-slide-opcao"><input type="checkbox" data-acao-mudar="rel-slide" value="${s.id}"${rel.slides[s.id] !== false ? ' checked' : ''}><span>${esc(s.nome)}</span></label>`).join('')}
          </fieldset>
        </section>

        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">3</span>Conteúdo relevante</h2>
          <p class="texto-suave">Até 3 capas. Recorte do print${rel.destaques?.length ? ' (a IA já sugeriu as de melhor desempenho)' : ''} ou escolha uma imagem.</p>
          <div class="rel-capas">
            ${[0, 1, 2].map((i) => capa(rel, i, prints.length)).join('')}
          </div>
        </section>

        <section class="card rel-passo">
          <h2 class="card-titulo"><span class="rel-num">4</span>Considerações</h2>
          <div class="rel-topicos">
            ${rel.consideracoes.map((c, i) => `<div class="campo rel-topico">
              <div class="rel-topico-topo">
                <input class="rel-topico-titulo" type="text" maxlength="40" value="${esc(c.titulo)}" aria-label="Tópico ${i + 1}" data-acao-mudar="rel-topico" data-campo="titulo" data-indice="${i}">
                <button class="botao-icone" type="button" data-acao="rel-topico-tirar" data-valor="${i}" aria-label="Tirar o tópico ${esc(c.titulo || i + 1)}" title="Tirar">×</button>
              </div>
              <textarea rows="3" maxlength="600" aria-label="Texto de ${esc(c.titulo || `tópico ${i + 1}`)}" data-acao-mudar="rel-topico" data-campo="texto" data-indice="${i}" placeholder="Uma ou duas frases.">${esc(c.texto)}</textarea>
            </div>`).join('')}
          </div>
          <div class="acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="rel-topico-novo"${rel.consideracoes.length >= 6 ? ' disabled' : ''}>+ Tópico</button></div>
          <label class="campo"><span class="campo-rotulo">Algo para a IA levar em conta (opcional)</span>
            <textarea rows="2" maxlength="1200" data-acao-mudar="rel-campo" data-campo="observacoes" placeholder="Ex.: mês de campanha de check-up; reels de bastidor foram bem.">${esc(rel.observacoes || '')}</textarea></label>
          <div class="acoes">
            <button class="botao botao-primario" type="button" data-acao="rel-escrever"${estado.relEscrevendo ? ' disabled' : ''}>${estado.relEscrevendo ? 'Escrevendo…' : 'Escrever com a IA'}</button>
          </div>
          <p class="campo-ajuda" aria-live="polite">${esc(estado.relEscritaStatus || 'A IA usa os números conferidos e os temas dos conteúdos em destaque. Você edita tudo depois.')}</p>
        </section>
      </div>

      <aside class="rel-previa-coluna" aria-label="Prévia do relatório">
        <p class="tb-rot">Prévia</p>
        <div class="rel-previa" data-rel-previa></div>
      </aside>
    </div>`;
}

function capa(rel, i, temPrints) {
  const src = rel.imagens[i];
  const sugestao = rel.destaques?.[i]?.tema;
  return `<div class="rel-capa">
    <div class="rel-capa-imagem${src ? '' : ' vazia'}">${src ? `<img src="${esc(src)}" alt="Capa ${i + 1}">` : `<span>${i + 1}</span>`}</div>
    ${sugestao ? `<small class="rel-capa-tema">${esc(sugestao)}</small>` : ''}
    <div class="rel-capa-acoes">
      ${temPrints ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="rel-recortar" data-valor="${i}">Recortar do print</button>` : ''}
      <label class="botao botao-secundario botao-pequeno rel-arquivo">Escolher imagem<input type="file" accept="image/*" data-acao-mudar="rel-capa" data-indice="${i}"></label>
      ${src ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="rel-capa-tirar" data-valor="${i}">Tirar</button>` : ''}
    </div>
  </div>`;
}

function textoDaLeitura(leitura, nPrints) {
  if (!leitura) return nPrints ? `${nPrints} ${nPrints === 1 ? 'print' : 'prints'}. A IA lê os números; você confere antes de baixar.` : 'Os prints ficam só neste aparelho enquanto a tela está aberta; a IA lê e apaga a cópia dela.';
  if (leitura.status === 'enviando') return 'Mandando os prints…';
  if (leitura.status === 'lendo') return 'A IA está lendo os prints. Leva uns 20 a 40 segundos.';
  if (leitura.status === 'erro') return leitura.erro || 'Não deu para ler agora.';
  return leitura.texto || 'Pronto. Confira os números abaixo.';
}
