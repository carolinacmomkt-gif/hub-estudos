// Cards criados pela Carol no Início (nota, atalhos, checklist, contagem) e o formulário deles.

import { esc, diasAte } from './utilidades.js';
import { chaveValida, dataDaChave } from './dados-calendario.js';
import { TIPOS_PROPRIOS } from './inicio-layout.js';

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

// Só http(s) e rotas do próprio app ("#calendario") viram link.
export function destinoSeguro(url) {
  const u = String(url || '').trim();
  if (/^#[a-z]/i.test(u)) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return `https://${u}`;
  return null;
}

const textoComQuebras = (t) => esc(t).replace(/\n/g, '<br>');

function corpoNota(c) {
  return c.texto ? `<p class="proprio-texto">${textoComQuebras(c.texto)}</p>` : '<p class="texto-suave">Toque em Personalizar → Editar para escrever aqui.</p>';
}

function corpoAtalhos(c) {
  const links = (c.links || []).map((l) => ({ ...l, url: destinoSeguro(l.url) })).filter((l) => l.url);
  if (!links.length) return '<p class="texto-suave">Nenhum atalho ainda.</p>';
  return `<div class="atalhos">${links.map((l) => {
    const externo = !l.url.startsWith('#');
    return `<a class="botao botao-secundario" href="${esc(l.url)}"${externo ? ' target="_blank" rel="noopener"' : ''}>${esc(l.rotulo || l.url)}</a>`;
  }).join('')}</div>`;
}

function corpoChecklist(id, c) {
  const itens = c.itens || [];
  if (!itens.length) return '<p class="texto-suave">Nenhum item ainda.</p>';
  const feitos = itens.filter((i) => i.feito).length;
  return `
    <p class="texto-suave">${feitos} de ${itens.length} feitos</p>
    <ul class="checklist">${itens.map((item, i) => `
      <li>
        <label class="campo-marcar${item.feito ? ' feito' : ''}">
          <input type="checkbox" data-acao="inicio-marcar" data-id="${esc(id)}" data-indice="${i}"${item.feito ? ' checked' : ''}>
          <span>${esc(item.texto)}</span>
        </label>
      </li>`).join('')}</ul>`;
}

function corpoContagem(c, agora) {
  if (!chaveValida(c.data)) return '<p class="texto-suave">Escolha a data em Personalizar → Editar.</p>';
  const dias = diasAte(dataDaChave(c.data).getTime(), agora);
  const numero = Math.abs(dias);
  const rotulo = dias === 0 ? 'é o dia!' : dias > 0 ? (dias === 1 ? 'dia falta' : 'dias faltam') : (numero === 1 ? 'dia atrás' : 'dias atrás');
  return `
    <p class="contagem"><strong>${dias === 0 ? 'Hoje' : numero}</strong><span>${rotulo}</span></p>
    <p class="texto-suave">${esc(fmtData.format(dataDaChave(c.data)))}</p>`;
}

export function renderProprio(id, c, agora = Date.now()) {
  const corpo = { nota: corpoNota, atalhos: corpoAtalhos, checklist: (x) => corpoChecklist(id, x), contagem: (x) => corpoContagem(x, agora) }[c.tipo];
  if (!corpo) return '';
  const nomeTipo = TIPOS_PROPRIOS.find((t) => t.id === c.tipo)?.nome || 'Card';
  return `
    <section class="card proprio proprio-${esc(c.tipo)}" aria-labelledby="titulo-${esc(id)}">
      <div class="card-topo"><h2 class="card-titulo" id="titulo-${esc(id)}">${esc(c.titulo || nomeTipo)}</h2></div>
      ${corpo(c)}
    </section>`;
}

// Formulário (na folha) para criar ou editar um card próprio.
export function renderFormProprio(tipo, c = {}, id = '') {
  const campos = {
    nota: `
      <label class="campo"><span class="campo-rotulo">Texto</span>
        <textarea name="texto" rows="6" maxlength="3000" placeholder="O que você quiser ver toda vez que abrir o app">${esc(c.texto || '')}</textarea></label>`,
    atalhos: `
      <label class="campo"><span class="campo-rotulo">Atalhos <small>(um por linha: nome | endereço)</small></span>
        <textarea name="links" rows="6" maxlength="3000" placeholder="AVA | https://avagrad.unievangelica.edu.br&#10;Calendário | #calendario">${esc((c.links || []).map((l) => `${l.rotulo} | ${l.url}`).join('\n'))}</textarea>
        <span class="campo-ajuda">Para uma tela do app, use #calendario, #faculdade, #cadernos…</span></label>`,
    checklist: `
      <label class="campo"><span class="campo-rotulo">Itens <small>(um por linha)</small></span>
        <textarea name="itens" rows="6" maxlength="3000" placeholder="Beber água&#10;Revisar a aula de hoje">${esc((c.itens || []).map((i) => i.texto).join('\n'))}</textarea></label>`,
    contagem: `
      <label class="campo"><span class="campo-rotulo">Data</span>
        <input name="data" type="date" value="${esc(c.data || '')}" required></label>`,
  }[tipo];
  const padrao = { nota: 'Lembrete', atalhos: 'Atalhos', checklist: 'Hoje', contagem: 'Férias' }[tipo];
  return `
    <form class="formulario" data-form="inicio-proprio" data-tipo="${esc(tipo)}" data-id="${esc(id)}"${tipo === 'checklist' ? ` data-itens="${esc(JSON.stringify(c.itens || []))}"` : ''} novalidate>
      <label class="campo"><span class="campo-rotulo">Título do card</span>
        <input name="titulo" type="text" maxlength="60" value="${esc(c.titulo || '')}" placeholder="${esc(padrao)}"></label>
      ${campos}
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${id ? 'Salvar' : 'Adicionar ao Hoje'}</button>
        ${id ? `<button class="botao botao-secundario" type="button" data-acao="inicio-remover" data-id="${esc(id)}">Excluir card</button>` : ''}
        <button class="botao botao-secundario" type="button" data-acao="cal-fechar">Cancelar</button>
      </div>
    </form>`;
}

// Lê o formulário e devolve { dados } ou { erro }.
export function lerFormProprio(form) {
  const tipo = form.dataset.tipo;
  const titulo = form.elements.titulo.value.trim().slice(0, 60);
  if (tipo === 'nota') return { dados: { titulo, texto: form.elements.texto.value.trim().slice(0, 3000) } };
  if (tipo === 'atalhos') {
    const links = form.elements.links.value.split('\n').map((l) => l.trim()).filter(Boolean).map((linha) => {
      const [rotulo, ...resto] = linha.split('|');
      const url = (resto.length ? resto.join('|') : rotulo).trim();
      return { rotulo: (resto.length ? rotulo : url).trim().slice(0, 40), url };
    });
    const ruim = links.find((l) => !destinoSeguro(l.url));
    if (ruim) return { erro: `O endereço de "${ruim.rotulo}" não parece um link. Use https://… ou #tela.` };
    return { dados: { titulo, links: links.slice(0, 12) } };
  }
  if (tipo === 'checklist') {
    const anteriores = new Map((form.dataset.itens ? JSON.parse(form.dataset.itens) : []).map((i) => [i.texto, i.feito]));
    const itens = form.elements.itens.value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30)
      .map((texto) => ({ texto: texto.slice(0, 120), feito: Boolean(anteriores.get(texto)) }));
    return { dados: { titulo, itens } };
  }
  const data = form.elements.data.value;
  if (!chaveValida(data)) return { erro: 'Escolha a data.' };
  return { dados: { titulo, data } };
}
