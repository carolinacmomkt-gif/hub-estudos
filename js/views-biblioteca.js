// Tela Biblioteca: lista com filtros (#biblioteca), adicionar por link, PDF ou texto
// (#biblioteca/novo) e o leitor com destaques, notas e fichamento (#biblioteca/<id>).

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { esc, haQuantoTempo } from './utilidades.js';
import { disciplinasAtivas, nomeDaDisciplina } from './dados-faculdade.js';
import { areasAtivas, nomeDaArea } from './dados-estudos.js';
import { opcoes } from './views-youtube.js';
import { trabalhosDoTipo } from './trabalhos-ia.js';
import {
  STATUS, CORES_DESTAQUE, PARTES_FICHAMENTO, nomeStatus, artigoPeloId, filtrarArtigos, tagsDosArtigos,
  contagemPorStatus, minutosDeLeitura, contarPalavras, paragrafos, marcarDestaques, dominio, artigosAtivos,
} from './dados-biblioteca.js';

const ABAS = [
  { id: 'ler', nome: 'Ler' },
  { id: 'destaques', nome: 'Destaques e notas' },
  { id: 'fichamento', nome: 'Fichamento' },
];
const FONTES = [
  { id: 'link', nome: 'Link' },
  { id: 'pdf', nome: 'PDF' },
  { id: 'texto', nome: 'Texto colado' },
];
const TAMANHOS_LEITURA = [0.9, 1, 1.15, 1.3, 1.5];

export function ligacoesDoArtigo(estado, a) {
  return [nomeDaDisciplina(estado, a.disciplina_id), nomeDaArea(estado, a.area_id)].filter(Boolean);
}

export function seletorDeLigacao(estado, { disciplina = '', area = '' } = {}) {
  const disciplinas = disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
  const areas = areasAtivas(estado).map((a) => ({ id: a.id, nome: a.nome }));
  return `
    <div class="cal-form-linha">
      <label class="campo"><span class="campo-rotulo">Disciplina <small>(opcional)</small></span>
        <select name="disciplina">${opcoes([{ id: '', nome: 'Nenhuma' }, ...disciplinas], disciplina)}</select></label>
      <label class="campo"><span class="campo-rotulo">Trilha ou tema <small>(opcional)</small></span>
        <select name="area">${opcoes([{ id: '', nome: 'Nenhum' }, ...areas], area)}</select></label>
    </div>`;
}

function cartaoArtigo(estado, a, agora) {
  const min = minutosDeLeitura(a.texto);
  const lendoPdf = trabalhosDoTipo('artigo').some((t) => t.ligado?.artigo_id === a.id && t.status !== 'erro' && t.status !== 'pronto');
  const meta = [a.autor, dominio(a.url), min ? `${min} min de leitura` : (a.pdf_path ? 'PDF' : ''), `salvo ${haQuantoTempo(new Date(a.criado_em).getTime(), agora)}`].filter(Boolean);
  const busca = `${a.titulo} ${a.autor || ''} ${(a.tags || []).join(' ')}`.toLowerCase();
  return `
    <li class="bib-cartao" data-busca="${esc(busca)}">
      <a class="bib-cartao-link" href="#biblioteca/${esc(a.id)}">
        <span class="bib-status status-${esc(a.status)}">${esc(nomeStatus(a.status))}</span>
        <span class="bib-titulo">${a.favorito ? '<span aria-label="Favorito">★</span> ' : ''}${esc(a.titulo)}</span>
        <span class="bib-meta">${esc(meta.join(' · '))}</span>
        ${lendoPdf ? '<span class="chip">A IA está lendo o PDF…</span>' : ''}
        ${(a.tags || []).length || ligacoesDoArtigo(estado, a).length ? `<span class="bib-tags">${ligacoesDoArtigo(estado, a).map((n) => `<span class="chip chip-ligacao">${esc(n)}</span>`).join('')}${(a.tags || []).map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</span>` : ''}
      </a>
    </li>`;
}

function lista(estado) {
  const agora = Date.now();
  const f = estado.bibFiltros || {};
  const artigos = filtrarArtigos(estado, { ...f, busca: '' });
  const total = artigosAtivos(estado).length;
  const contagem = contagemPorStatus(estado);
  const tags = tagsDosArtigos(estado);
  const disciplinas = disciplinasAtivas(estado).map((d) => ({ id: d.id, nome: d.nome }));
  const areas = areasAtivas(estado).map((a) => ({ id: a.id, nome: a.nome }));

  if (!total) {
    return `
      ${cabecalho('Biblioteca', 'Artigos, PDFs e textos para ler, destacar e fichar')}
      <section class="card vazio">
        <div class="vazio-icone">${icone('biblioteca')}</div>
        <h2>Sua biblioteca de leitura</h2>
        <p class="texto-suave">Salve um artigo por link, PDF ou texto colado. Depois é só ler aqui, destacar, anotar, fazer o fichamento e gerar questões.</p>
        <a class="botao botao-primario" href="#biblioteca/novo">Adicionar leitura</a>
      </section>`;
  }

  return `
    ${cabecalho('Biblioteca', 'Artigos, PDFs e textos para ler, destacar e fichar')}
    <div class="acoes cal-acoes"><a class="botao botao-primario" href="#biblioteca/novo">Adicionar leitura</a></div>
    <div class="segmentado bib-status-filtro" role="group" aria-label="Filtrar por status">
      <button type="button" data-acao="bib-filtro" data-campo="status" data-valor="" aria-pressed="${!f.status}">Todos <span class="selo">${total}</span></button>
      ${STATUS.map((s) => `<button type="button" data-acao="bib-filtro" data-campo="status" data-valor="${s.id}" aria-pressed="${f.status === s.id}">${s.nome} <span class="selo">${contagem[s.id] || 0}</span></button>`).join('')}
    </div>
    <div class="filtros">
      <label class="campo"><span class="campo-rotulo">Buscar</span>
        <input type="search" id="bib-busca" data-filtrar-lista="bib-lista" placeholder="Título, autor ou tag" value="${esc(f.busca || '')}"></label>
      ${disciplinas.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Disciplina</span>
        <select data-acao-mudar="bib-filtro" data-campo="disciplina">${opcoes([{ id: '', nome: 'Todas' }, ...disciplinas], f.disciplina)}</select></label>` : ''}
      ${areas.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Trilha ou tema</span>
        <select data-acao-mudar="bib-filtro" data-campo="area">${opcoes([{ id: '', nome: 'Todos' }, ...areas], f.area)}</select></label>` : ''}
      ${tags.length ? `<label class="campo campo-curto"><span class="campo-rotulo">Tag</span>
        <select data-acao-mudar="bib-filtro" data-campo="tag">${opcoes([{ id: '', nome: 'Todas' }, ...tags.map((t) => ({ id: t, nome: `#${t}` }))], f.tag)}</select></label>` : ''}
      <label class="campo-marcar"><input type="checkbox" data-acao-mudar="bib-filtro" data-campo="favoritos"${f.favoritos ? ' checked' : ''}><span>Só favoritos</span></label>
    </div>
    ${artigos.length
      ? `<ul class="bib-lista" id="bib-lista">${artigos.map((a) => cartaoArtigo(estado, a, agora)).join('')}</ul>
         <p class="texto-suave" data-lista-vazia="bib-lista" hidden>Nada com essa busca.</p>`
      : '<p class="texto-suave">Nenhuma leitura com esses filtros.</p>'}`;
}

function formNovo(estado) {
  const fonte = estado.bibFonte || 'link';
  const pre = estado.bibPreenchido || {};
  const campoFonte = {
    link: `
      <label class="campo"><span class="campo-rotulo">Link do artigo</span>
        <input name="url" type="url" inputmode="url" required placeholder="https://…" value="${esc(pre.url || '')}"></label>
      <p class="campo-ajuda">O app busca a página e guarda só o texto (sem anúncios). Se o site bloquear, cole o texto.</p>`,
    pdf: `
      <label class="campo"><span class="campo-rotulo">Arquivo PDF <small>(até 25 MB)</small></span>
        <input name="pdf" type="file" accept="application/pdf,.pdf" required></label>
      <label class="campo-marcar"><input type="checkbox" name="ia" checked><span>Pedir para a IA tirar o texto e um resumo (para ler, destacar e gerar questões aqui)</span></label>
      <p class="campo-ajuda">O PDF fica guardado e abre a qualquer momento. A leitura da IA roda em segundo plano: pode sair da tela.</p>`,
    texto: `
      <label class="campo"><span class="campo-rotulo">Texto</span>
        <textarea name="texto" rows="10" required placeholder="Cole o texto aqui.">${esc(pre.texto || '')}</textarea></label>`,
  }[fonte];
  return `
    ${cabecalho('Adicionar leitura', 'Por link, PDF ou texto colado')}
    <div class="acoes cal-acoes"><a class="botao botao-secundario botao-pequeno" href="#biblioteca">← Biblioteca</a></div>
    <section class="card">
      <div class="segmentado" role="group" aria-label="De onde vem">${FONTES.map((x) => `
        <button type="button" data-acao="bib-fonte" data-valor="${x.id}" aria-pressed="${fonte === x.id}">${x.nome}</button>`).join('')}
      </div>
      <form class="formulario" data-form="bib-novo" data-fonte="${fonte}" novalidate>
        ${campoFonte}
        <label class="campo"><span class="campo-rotulo">Título ${fonte === 'texto' ? '' : '<small>(opcional: vem do link ou do PDF)</small>'}</span>
          <input name="titulo" type="text" maxlength="300"${fonte === 'texto' ? ' required' : ''} value="${esc(pre.titulo || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Autor <small>(opcional)</small></span>
          <input name="autor" type="text" maxlength="200"></label>
        ${seletorDeLigacao(estado, { area: pre.area || '', disciplina: pre.disciplina || '' })}
        <label class="campo"><span class="campo-rotulo">Tags <small>(separe por vírgula)</small></span>
          <input name="tags" type="text" maxlength="300" placeholder="ex.: metodologia, prova 2"></label>
        <label class="campo campo-curto"><span class="campo-rotulo">Status</span>
          <select name="status">${opcoes(STATUS, 'ler')}</select></label>
        <p class="ava-alerta" role="alert" data-erro hidden></p>
        <div class="acoes">
          <button class="botao botao-primario" type="submit">Salvar na Biblioteca</button>
        </div>
      </form>
    </section>`;
}

function abaLer(estado, a) {
  const tam = TAMANHOS_LEITURA.includes(Number(estado.bibTamanho)) ? Number(estado.bibTamanho) : 1;
  const destaques = Array.isArray(a.destaques) ? a.destaques : [];
  const pars = paragrafos(a.texto);
  const trabalhoPdf = trabalhosDoTipo('artigo').find((t) => t.ligado?.artigo_id === a.id);
  let corpo;
  if (pars.length) {
    corpo = pars.map((p, i) => `<p data-par="${i}">${marcarDestaques(esc(p), destaques, esc)}</p>`).join('');
  } else if (trabalhoPdf && trabalhoPdf.status !== 'erro') {
    corpo = '<p class="texto-suave">A IA está lendo o PDF. O texto aparece aqui sozinho quando terminar (pode levar alguns minutos).</p>';
  } else if (trabalhoPdf?.status === 'erro') {
    corpo = `<div class="ava-alerta" role="alert">${esc(trabalhoPdf.erro || 'A leitura do PDF não deu certo.')}</div>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-ler-pdf" data-id="${esc(a.id)}">Tentar de novo</button>`;
  } else if (a.pdf_path) {
    corpo = `<p class="texto-suave">Este PDF ainda não tem o texto aqui no app. Abra o PDF ou peça para a IA tirar o texto.</p>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-ler-pdf" data-id="${esc(a.id)}">Tirar o texto com a IA</button>`;
  } else {
    corpo = '<p class="texto-suave">Sem texto salvo. Edite a leitura para colar o texto.</p>';
  }
  return `
    <div class="leitor-barra">
      <div class="ferramenta-grupo" role="group" aria-label="Tamanho da letra">
        <button class="botao-icone" type="button" data-acao="bib-letra" data-passo="-1" aria-label="Letra menor">A−</button>
        <button class="botao-icone" type="button" data-acao="bib-letra" data-passo="1" aria-label="Letra maior">A+</button>
      </div>
      ${pars.length ? `
      <div class="ferramenta-grupo" role="group" aria-label="Destacar o trecho selecionado">
        <span class="campo-ajuda">Selecione um trecho e toque:</span>
        ${CORES_DESTAQUE.map((c) => `<button class="leitor-cor" type="button" data-acao="bib-destacar" data-cor="${c.id}" style="--cor: var(--destaque-${c.id})" aria-label="Destacar em ${c.nome.toLowerCase()}" title="Destacar em ${c.nome.toLowerCase()}"></button>`).join('')}
      </div>` : ''}
    </div>
    ${a.resumo ? `<details class="card leitor-resumo"><summary><strong>Resumo</strong></summary><p>${esc(a.resumo)}</p></details>` : ''}
    <article class="card leitor-texto" id="leitor-texto" style="--leitura: ${tam}">${corpo}</article>
    <p class="campo-ajuda">Toque num trecho destacado para anotar ou tirar o destaque.</p>`;
}

function abaDestaques(a) {
  const destaques = Array.isArray(a.destaques) ? a.destaques : [];
  return `
    <section class="card">
      <h2 class="card-titulo">Destaques</h2>
      ${destaques.length ? `<ul class="bib-destaques">${destaques.map((d) => `
        <li class="bib-destaque">
          <blockquote class="destaque-${esc(d.cor || 'amarelo')}">${esc(d.texto)}</blockquote>
          <label class="campo"><span class="campo-rotulo">Nota</span>
            <textarea rows="2" data-bib-nota-destaque="${esc(d.id)}" maxlength="2000" placeholder="O que esse trecho significa para você?">${esc(d.nota || '')}</textarea></label>
          <div class="acoes">
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-destaque-ficha" data-id="${esc(d.id)}">Levar para as citações do fichamento</button>
            <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-destaque-remover" data-id="${esc(d.id)}">Tirar destaque</button>
          </div>
        </li>`).join('')}</ul>` : '<p class="texto-suave">Nenhum destaque ainda. Na aba Ler, selecione um trecho e toque numa cor.</p>'}
    </section>
    <section class="card">
      <label class="campo"><span class="campo-rotulo">Notas gerais</span>
        <textarea rows="8" data-bib-campo="notas" maxlength="20000" placeholder="Suas anotações sobre o texto.">${esc(a.notas || '')}</textarea></label>
    </section>`;
}

function abaFichamento(a) {
  const f = a.fichamento || {};
  return `
    <section class="card">
      <p class="campo-ajuda">Fichamento de leitura. Salva sozinho enquanto você escreve.</p>
      ${PARTES_FICHAMENTO.map((p) => `
        <label class="campo"><span class="campo-rotulo">${esc(p.nome)}</span>
          <textarea rows="${p.id === 'referencia' ? 2 : 4}" data-bib-ficha="${p.id}" maxlength="20000" placeholder="${esc(p.ajuda)}">${esc(f[p.id] || (p.id === 'referencia' ? [a.autor, a.titulo, a.url].filter(Boolean).join('. ') : ''))}</textarea></label>`).join('')}
      <div class="acoes">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-copiar-ficha">Copiar fichamento</button>
        ${a.status !== 'fichado' ? '<button class="botao botao-primario botao-pequeno" type="button" data-acao="bib-status" data-valor="fichado">Marcar como fichado</button>' : ''}
      </div>
    </section>`;
}

function formEditar(estado, a) {
  return `
    <section class="card">
      <h2 class="card-titulo">Dados da leitura</h2>
      <form class="formulario" data-form="bib-editar" data-id="${esc(a.id)}" novalidate>
        <label class="campo"><span class="campo-rotulo">Título</span>
          <input name="titulo" type="text" maxlength="300" required value="${esc(a.titulo)}"></label>
        <label class="campo"><span class="campo-rotulo">Autor</span>
          <input name="autor" type="text" maxlength="200" value="${esc(a.autor || '')}"></label>
        <label class="campo"><span class="campo-rotulo">Link</span>
          <input name="url" type="url" maxlength="2000" value="${esc(a.url || '')}"></label>
        ${seletorDeLigacao(estado, { disciplina: a.disciplina_id || '', area: a.area_id || '' })}
        <label class="campo"><span class="campo-rotulo">Tags <small>(separe por vírgula)</small></span>
          <input name="tags" type="text" maxlength="300" value="${esc((a.tags || []).join(', '))}"></label>
        <label class="campo"><span class="campo-rotulo">Resumo</span>
          <textarea name="resumo" rows="3" maxlength="4000">${esc(a.resumo || '')}</textarea></label>
        <label class="campo"><span class="campo-rotulo">Texto</span>
          <textarea name="texto" rows="8">${esc(a.texto || '')}</textarea></label>
        <p class="campo-ajuda">Mudar o texto pode soltar destaques que não existem mais nele.</p>
        <div class="acoes">
          <button class="botao botao-primario" type="submit">Salvar</button>
          <button class="botao botao-secundario" type="button" data-acao="bib-editar-fechar">Cancelar</button>
        </div>
      </form>
    </section>`;
}

function leitor(estado, a) {
  const aba = ABAS.some((x) => x.id === estado.bibAba) ? estado.bibAba : 'ler';
  const palavras = contarPalavras(a.texto);
  const ligacoes = ligacoesDoArtigo(estado, a);
  const sub = [a.autor, dominio(a.url), palavras ? `${palavras.toLocaleString('pt-BR')} palavras · ${minutosDeLeitura(a.texto)} min` : ''].filter(Boolean).map(esc).join(' · ');
  const corpo = estado.bibEditando === a.id ? formEditar(estado, a)
    : aba === 'destaques' ? abaDestaques(a) : aba === 'fichamento' ? abaFichamento(a) : abaLer(estado, a);
  return `
    ${cabecalho(a.titulo, sub)}
    <div class="acoes cal-acoes leitor-acoes">
      <a class="botao botao-secundario botao-pequeno" href="#biblioteca">← Biblioteca</a>
      <label class="campo campo-curto campo-inline"><span class="campo-rotulo">Status</span>
        <select data-acao-mudar="bib-status">${opcoes(STATUS, a.status)}</select></label>
      <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-favorito" aria-pressed="${Boolean(a.favorito)}">${a.favorito ? '★ Favorito' : '☆ Favoritar'}</button>
      ${a.url ? `<a class="botao botao-secundario botao-pequeno" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Abrir o site</a>` : ''}
      ${a.pdf_path ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-abrir-pdf">Abrir o PDF</button>' : ''}
      <details class="menu-mais">
        <summary class="botao botao-secundario botao-pequeno">Mais</summary>
        <div class="menu-mais-lista">
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-questoes">Gerar questões deste texto</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-substack">Usar numa pauta do Substack</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="bib-editar">Editar dados e texto</button>
          <button class="botao botao-secundario botao-pequeno botao-perigo" type="button" data-acao="bib-excluir">Excluir</button>
        </div>
      </details>
    </div>
    ${ligacoes.length || (a.tags || []).length ? `<p class="bib-tags">${ligacoes.map((n) => `<span class="chip chip-ligacao">${esc(n)}</span>`).join('')}${(a.tags || []).map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</p>` : ''}
    <div class="segmentado" role="tablist" aria-label="Partes da leitura">${ABAS.map((x) => `
      <button type="button" role="tab" data-acao="bib-aba" data-valor="${x.id}" aria-selected="${aba === x.id}" aria-pressed="${aba === x.id}">${x.nome}${x.id === 'destaques' && a.destaques?.length ? ` <span class="selo">${a.destaques.length}</span>` : ''}</button>`).join('')}
    </div>
    ${corpo}`;
}

export function renderBiblioteca(estado) {
  if (estado.parametro === 'novo') return formNovo(estado);
  if (estado.parametro) {
    const a = artigoPeloId(estado, estado.parametro);
    if (!a) {
      return `${cabecalho('Biblioteca')}
        <section class="card"><p class="texto-suave">Esta leitura não foi encontrada. Ela pode ter sido excluída.</p>
        <a class="botao botao-secundario" href="#biblioteca">Voltar para a Biblioteca</a></section>`;
    }
    return leitor(estado, a);
  }
  return lista(estado);
}

// Card do Início: o que está lendo agora.
export function cardLeiturasInicio(estado) {
  const lendo = filtrarArtigos(estado, {}).filter((a) => a.status === 'lendo' || a.status === 'ler').slice(0, 4);
  if (!lendo.length) return '';
  return `
    <section class="card" aria-labelledby="leituras-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="leituras-titulo">Leituras</h2>
        <a class="card-link" href="#biblioteca">Biblioteca</a>
      </div>
      <ul class="lista-simples">${lendo.map((a) => `
        <li><a href="#biblioteca/${esc(a.id)}"><span class="bib-status status-${esc(a.status)}">${esc(nomeStatus(a.status))}</span> ${esc(a.titulo)}</a></li>`).join('')}</ul>
    </section>`;
}
