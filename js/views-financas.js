// Tela Finanças (#financas, #financas/lancamentos, #financas/contas, #financas/caixinhas,
// #financas/ajustes), os formulários e os cards do Hoje.

import { cabecalho, barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import {
  ORIGENS_PADRAO, CATEGORIAS_PADRAO, iso, mesDe, somarMeses, lerLancamento, lancamentos, contasFixas, caixinhas,
  resumoDoMes, variacao, situacaoDasContas, contasDaSemana, progressoCaixinha, livreParaGastar,
} from './dados-financas.js';
import { abaRecompensas } from './views-recompensas.js';

export const ABAS_FINANCAS = [
  { id: 'mes', nome: 'Mês' },
  { id: 'lancamentos', nome: 'Lançamentos' },
  { id: 'contas', nome: 'Contas fixas' },
  { id: 'caixinhas', nome: 'Caixinhas' },
  { id: 'recompensas', nome: 'Recompensas' },
  { id: 'ajustes', nome: 'Categorias' },
];
const CHAVE_OCULTAR = 'bussola.financas.ocultar';
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

export const hojeIso = () => iso(new Date());
const deIso = (s) => new Date(`${s}T12:00:00`);
export const nomeMes = (mes) => fmtMes.format(deIso(`${mes}-15`)).replace(/^./, (c) => c.toUpperCase());

export function valoresOcultos() {
  try {
    return localStorage.getItem(CHAVE_OCULTAR) === '1';
  } catch {
    return false;
  }
}
export function ocultarValores(sim) {
  try {
    localStorage.setItem(CHAVE_OCULTAR, sim ? '1' : '0');
  } catch {
    // vale só agora
  }
}
export const dinheiro = (v, { sinal = false } = {}) => {
  if (valoresOcultos()) return 'R$ •••';
  const t = fmtMoeda.format(Math.abs(Number(v) || 0));
  return sinal && v > 0 ? `+${t}` : sinal && v < 0 ? `−${t}` : t;
};

// Categorias e origens: as padrão com o que a Carol mudou (nome, limite) e as que ela criou.
export function prefsFinancas(estado) {
  const v = (estado.config || []).find((c) => c.chave === 'financas' && !c.excluido_em)?.valor || {};
  const junta = (padrao, salvas = []) => {
    const lista = padrao.map((p) => ({ ...p, ...(salvas.find((s) => s.id === p.id) || {}) }));
    for (const s of salvas) if (!lista.some((x) => x.id === s.id)) lista.push({ palavras: [], ...s });
    return lista.filter((x) => !x.removida);
  };
  return { categorias: junta(CATEGORIAS_PADRAO, v.categorias), origens: junta(ORIGENS_PADRAO, v.origens) };
}

const nomeDe = (lista, id) => lista.find((x) => x.id === id)?.nome || 'Outros';

function navegarMes(mes, aba) {
  const atual = mesDe(hojeIso());
  return `
    <div class="fin-mes" role="group" aria-label="Mês">
      <button class="botao-icone" type="button" data-acao="fin-mes" data-valor="${somarMeses(mes, -1)}" aria-label="Mês anterior">‹</button>
      <strong>${esc(nomeMes(mes))}</strong>
      <button class="botao-icone" type="button" data-acao="fin-mes" data-valor="${somarMeses(mes, 1)}" aria-label="Próximo mês">›</button>
      ${mes !== atual ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="fin-mes" data-valor="${atual}">Este mês</button>` : ''}
      <button class="botao-icone fin-olho" type="button" data-acao="fin-ocultar" aria-pressed="${valoresOcultos()}" aria-label="${valoresOcultos() ? 'Mostrar os valores' : 'Esconder os valores'}" title="${valoresOcultos() ? 'Mostrar os valores' : 'Esconder os valores (para usar em público)'}">${valoresOcultos() ? '◌' : '◉'}</button>
    </div>`;
}

export function campoFinanceiro({ dica = false } = {}) {
  return `
    <form class="tarefa-rapida" data-form="fin-rapido" novalidate>
      <label class="visualmente-oculto" for="fin-rapido">Novo lançamento</label>
      <input id="fin-rapido" name="texto" type="text" maxlength="200" autocomplete="off" enterkeyhint="done" placeholder="Novo lançamento" data-acao-mudar="fin-previa">
      <button class="botao botao-primario" type="submit" aria-label="Lançar">+</button>
      <p class="tarefa-previa" data-previa aria-live="polite"></p>
      ${dica ? '<p class="tarefa-dica campo-ajuda">Dica: "mercado 120 ontem", "drive thru 32,90", "+3500 sensus" (entrada) ou "salário confluir 2800".</p>' : ''}
    </form>`;
}

export function textoPreviaFin(texto, prefs, hoje = hojeIso()) {
  if (!texto.trim()) return '';
  const r = lerLancamento(texto, hoje, prefs);
  if (!Number.isFinite(r.valor) || r.valor <= 0) return 'Falta o valor (ex.: 35,90).';
  const quando = r.data === hoje ? 'hoje' : fmtDia.format(deIso(r.data)).replace('.', '');
  return r.tipo === 'entrada'
    ? `↓ Entrada de ${fmtMoeda.format(r.valor)} · ${nomeDe(prefs.origens, r.origem)}${r.cliente ? ` (${r.cliente})` : ''} · ${quando}`
    : `↑ Gasto de ${fmtMoeda.format(r.valor)} · ${nomeDe(prefs.categorias, r.categoria)} · ${quando}`;
}

function textoVariacao(v, inverter = false) {
  if (v === null || !Number.isFinite(v)) return '';
  if (Math.abs(v) < 0.005) return '<small class="campo-ajuda">igual ao mês anterior</small>';
  const subiu = v > 0;
  const bom = inverter ? !subiu : subiu;
  return `<small class="fin-var ${bom ? 'bom' : 'ruim'}">${subiu ? '↑' : '↓'} ${Math.round(Math.abs(v) * 100)}% vs mês anterior</small>`;
}

function barras(itens, total, { limites = {} } = {}) {
  if (!itens.length) return '<p class="texto-suave">Nada neste mês.</p>';
  const maior = Math.max(...itens.map((i) => i.total), 1);
  return `<ul class="fin-barras">${itens.map((i) => {
    const limite = Number(limites[i.id]) || 0;
    const fracao = limite ? i.total / limite : i.total / maior;
    const nivel = limite ? (fracao >= 1 ? ' passou' : fracao >= 0.8 ? ' perto' : '') : '';
    return `
      <li class="fin-barra${nivel}">
        <span class="fin-barra-nome">${esc(i.nome)}</span>
        <span class="fin-barra-valor">${dinheiro(i.total)}${limite ? ` <small>de ${dinheiro(limite)}</small>` : ` <small>${total ? Math.round((i.total / total) * 100) : 0}%</small>`}</span>
        <span class="fin-trilho" aria-hidden="true"><span style="width: ${Math.min(100, Math.round(fracao * 100))}%"></span></span>
      </li>`;
  }).join('')}</ul>`;
}

function itemConta(x) {
  const c = x.conta;
  const quando = x.estado === 'paga' ? 'Paga' : x.estado === 'atrasada' ? `Atrasada (dia ${Number(c.recorrencia?.dia) || 1})` : x.dias === 0 ? 'Vence hoje' : x.dias === 1 ? 'Vence amanhã' : `Vence ${fmtDia.format(deIso(x.vence)).replace('.', '')}`;
  return `
    <li class="fin-conta estado-${x.estado}">
      <button class="fin-conta-corpo" type="button" data-acao="fin-conta-editar" data-id="${esc(c.id)}">
        <span class="fin-conta-nome">${esc(c.descricao)}</span>
        <span class="fin-conta-meta">${esc(quando)}</span>
      </button>
      <span class="fin-valor">${dinheiro(c.valor)}</span>
      ${x.estado === 'paga'
        ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="fin-conta-desfazer" data-id="${esc(x.pagamento.id)}">Desfazer</button>`
        : `<button class="botao botao-primario botao-pequeno" type="button" data-acao="fin-conta-pagar" data-id="${esc(c.id)}" data-mes="${esc(mesDe(x.vence))}">Paguei</button>`}
    </li>`;
}

function itemLancamento(l, prefs) {
  const entrada = l.tipo === 'entrada';
  const onde = entrada ? nomeDe(prefs.origens, l.origem) : nomeDe(prefs.categorias, l.categoria);
  return `
    <li>
      <button class="fin-lanc ${entrada ? 'eh-entrada' : 'eh-saida'}" type="button" data-acao="fin-abrir" data-id="${esc(l.id)}">
        <span class="fin-lanc-marca" aria-hidden="true">${entrada ? '↓' : '↑'}</span>
        <span class="fin-lanc-texto"><span class="fin-lanc-desc">${esc(l.descricao || onde)}</span>
          <small class="campo-ajuda">${esc(onde)}${l.dados?.cliente ? ` · ${esc(l.dados.cliente)}` : ''}${l.dados?.conta_id ? ' · conta fixa' : ''}</small></span>
        <span class="fin-valor ${entrada ? 'positivo' : ''}">${dinheiro(entrada ? l.valor : -l.valor, { sinal: true })}</span>
      </button>
    </li>`;
}

function abaMes(estado, mes, prefs) {
  const r = resumoDoMes(estado.financas, mes, prefs);
  const ant = resumoDoMes(estado.financas, somarMeses(mes, -1), prefs);
  const limites = Object.fromEntries(prefs.categorias.filter((c) => Number(c.limite) > 0).map((c) => [c.id, Number(c.limite)]));
  const contas = situacaoDasContas(estado.financas, mes, hojeIso());
  const cx = caixinhas(estado.financas);
  const futuro = mes > mesDe(hojeIso());
  const previstas = contas.filter((x) => x.estado !== 'paga').reduce((t, x) => t + (Number(x.conta.valor) || 0), 0);
  return `
    ${futuro ? `<section class="card fin-livre">
      <p class="proximo-rotulo">Previsão de ${esc(nomeMes(mes).toLowerCase())}</p>
      <p class="fin-grande">${dinheiro(previstas)}</p>
      <p class="campo-ajuda">em ${contas.length} ${contas.length === 1 ? 'conta fixa' : 'contas fixas'}${r.quantidade ? ` · e ${r.quantidade} ${r.quantidade === 1 ? 'lançamento já marcado' : 'lançamentos já marcados'} para este mês` : ''}. Para planejar uma entrada ou um gasto futuro, lance com a data (ex.: "+3500 sensus 05/${esc(mes.slice(5, 7))}").</p>
    </section>` : ''}
    <div class="fin-resumo">
      <section class="card fin-numero"><p class="proximo-rotulo">Entrou</p><p class="fin-grande positivo">${dinheiro(r.entrou)}</p>${textoVariacao(variacao(r.entrou, ant.entrou))}</section>
      <section class="card fin-numero"><p class="proximo-rotulo">Saiu</p><p class="fin-grande">${dinheiro(r.saiu)}</p>${textoVariacao(variacao(r.saiu, ant.saiu), true)}</section>
      <section class="card fin-numero"><p class="proximo-rotulo">Sobrou</p><p class="fin-grande ${r.sobrou < 0 ? 'negativo' : 'positivo'}">${r.sobrou < 0 ? '−' : ''}${dinheiro(Math.abs(r.sobrou))}</p>
        <small class="campo-ajuda">${r.quantidade} ${r.quantidade === 1 ? 'lançamento' : 'lançamentos'}</small></section>
    </div>
    ${mes === mesDe(hojeIso()) && r.entrou > 0 ? cardLivre(estado) : ''}
    <div class="fin-duas">
      <section class="card"><h2 class="card-titulo">De onde veio</h2>${barras(r.porOrigem, r.entrou)}</section>
      <section class="card"><div class="card-topo"><h2 class="card-titulo">Para onde foi</h2><a class="card-link" href="#financas/ajustes">Limites</a></div>${barras(r.porCategoria, r.saiu, { limites })}</section>
    </div>
    <div class="fin-duas">
      <section class="card"><div class="card-topo"><h2 class="card-titulo">Contas do mês</h2><a class="card-link" href="#financas/contas">Contas fixas</a></div>
        ${contas.length ? `<ul class="fin-contas">${contas.map(itemConta).join('')}</ul>` : '<p class="texto-suave">Cadastre o aluguel, a internet e o que se repete todo mês para ver o que falta pagar.</p>'}</section>
      <section class="card"><div class="card-topo"><h2 class="card-titulo">Caixinhas</h2><a class="card-link" href="#financas/caixinhas">Ver todas</a></div>
        ${cx.length ? `<ul class="lista-simples">${cx.slice(0, 4).map((c) => { const pr = progressoCaixinha(c); return `<li class="fin-caixinha-linha"><span>${esc(c.descricao)}</span>${barraProgresso(pr.fracao, `Caixinha ${c.descricao}`)}</li>`; }).join('')}</ul>`
          : '<p class="texto-suave">Uma caixinha guarda dinheiro para um objetivo: viagem para Brasília, reserva, um curso.</p>'}</section>
    </div>`;
}

function cardLivre(estado) {
  const l = livreParaGastar(estado.financas, hojeIso());
  const detalhes = [l.contasAbertas > 0 && `${dinheiro(l.contasAbertas)} de contas que ainda vão vencer`, l.guardadoNoMes > 0 && `${dinheiro(l.guardadoNoMes)} guardados nas caixinhas`].filter(Boolean);
  return `
    <section class="card fin-livre${l.livre < 0 ? ' apertado' : ''}">
      <div>
        <p class="proximo-rotulo">Livre para gastar até o fim do mês</p>
        <p class="fin-grande ${l.livre < 0 ? 'negativo' : 'positivo'}">${l.livre < 0 ? '−' : ''}${dinheiro(Math.abs(l.livre))}</p>
        <p class="campo-ajuda">${l.livre > 0 ? `Dá ${dinheiro(l.porDia)} por dia nos ${l.diasRestantes} ${l.diasRestantes === 1 ? 'dia que falta' : 'dias que faltam'}.` : 'As contas do mês já passam do que entrou. Vale segurar os gastos.'}${detalhes.length ? ` Já descontados: ${detalhes.join(' e ')}.` : ''}</p>
      </div>
    </section>`;
}

function abaLancamentos(estado, mes, prefs) {
  const filtro = estado.filtroFinancas || '';
  const lista = lancamentos(estado.financas).filter((l) => mesDe(l.data) === mes && (!filtro || l.tipo === filtro))
    .sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)));
  const dias = [];
  for (const l of lista) {
    const g = dias.at(-1);
    if (g?.data === l.data) g.itens.push(l);
    else dias.push({ data: l.data, itens: [l] });
  }
  return `
    <div class="tarefa-filtros" role="group" aria-label="Filtrar">
      ${[['', 'Todos'], ['entrada', 'Entradas'], ['saida', 'Gastos']].map(([v, n]) => `<button class="chip-filtro" type="button" data-acao="fin-filtro" data-valor="${v}" aria-pressed="${filtro === v}">${n}</button>`).join('')}
    </div>
    ${dias.length ? dias.map((g) => `
      <section class="card fin-dia"><h2 class="card-titulo">${esc(fmtDia.format(deIso(g.data)).replace('.', '').replace(/^./, (c) => c.toUpperCase()))}
        <small class="campo-ajuda">${dinheiro(g.itens.reduce((t, l) => t + (l.tipo === 'entrada' ? l.valor : -l.valor), 0), { sinal: true })}</small></h2>
        <ul class="fin-lancs">${g.itens.map((l) => itemLancamento(l, prefs)).join('')}</ul></section>`).join('')
      : '<p class="texto-suave tarefa-vazio">Nenhum lançamento neste mês. Escreva acima, do jeito que falaria.</p>'}`;
}

function abaContas(estado, mes) {
  const contas = situacaoDasContas(estado.financas, mes, hojeIso());
  const pausadas = contasFixas(estado.financas).filter((c) => c.dados?.pausada);
  const total = contas.reduce((t, x) => t + (Number(x.conta.valor) || 0), 0);
  const pagas = contas.filter((x) => x.estado === 'paga').reduce((t, x) => t + (Number(x.conta.valor) || 0), 0);
  return `
    <div class="acoes"><button class="botao botao-primario" type="button" data-acao="fin-conta-nova">Nova conta fixa</button></div>
    <section class="card">
      ${contas.length ? `
        <p class="campo-ajuda">${dinheiro(pagas)} pagos de ${dinheiro(total)} em ${esc(nomeMes(mes).toLowerCase())}</p>
        ${barraProgresso(total ? pagas / total : 0, 'Contas pagas no mês')}
        <ul class="fin-contas">${contas.map(itemConta).join('')}</ul>`
        : '<p class="texto-suave">Nenhuma conta fixa ainda. Aluguel, internet, assinaturas, faculdade: cadastre uma vez e marque "Paguei" todo mês.</p>'}
    </section>
    ${pausadas.length ? `<details class="card"><summary>Pausadas (${pausadas.length})</summary><ul class="lista-simples">${pausadas.map((c) => `
      <li><button class="fin-conta-corpo" type="button" data-acao="fin-conta-editar" data-id="${esc(c.id)}"><span>${esc(c.descricao)}</span></button><span>${dinheiro(c.valor)}</span></li>`).join('')}</ul></details>` : ''}`;
}

function abaCaixinhas(estado) {
  const cx = caixinhas(estado.financas);
  return `
    <div class="acoes"><button class="botao botao-primario" type="button" data-acao="fin-caixinha-nova">Nova caixinha</button></div>
    ${cx.length ? `<ul class="projetos">${cx.map((c) => {
      const pr = progressoCaixinha(c);
      return `
      <li><section class="card fin-caixinha">
        <div class="card-topo"><h2 class="card-titulo">${esc(c.descricao)}</h2>
          <button class="card-link" type="button" data-acao="fin-caixinha-editar" data-id="${esc(c.id)}">Editar</button></div>
        <p class="fin-grande positivo">${dinheiro(pr.guardado)}</p>
        <p class="campo-ajuda">${pr.meta ? `de ${dinheiro(pr.meta)}${pr.fracao >= 1 ? ' · meta batida! 🎉' : ''}` : 'sem meta'}</p>
        ${pr.meta ? barraProgresso(pr.fracao, `Caixinha ${c.descricao}`) : ''}
        <div class="acoes">
          <button class="botao botao-primario botao-pequeno" type="button" data-acao="fin-caixinha-mover" data-id="${esc(c.id)}" data-modo="guardar">Guardar</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fin-caixinha-mover" data-id="${esc(c.id)}" data-modo="tirar"${pr.guardado > 0 ? '' : ' disabled'}>Tirar</button>
        </div>
      </section></li>`;
    }).join('')}</ul>` : '<p class="texto-suave tarefa-vazio">Nenhuma caixinha ainda. Que tal uma para o próximo passeio em Goiânia?</p>'}`;
}

function abaAjustes(prefs) {
  const linha = (tipo, x) => `
    <li class="fin-ajuste">
      <label class="visualmente-oculto" for="fin-nome-${tipo}-${esc(x.id)}">Nome</label>
      <input id="fin-nome-${tipo}-${esc(x.id)}" type="text" maxlength="40" value="${esc(x.nome)}" data-acao-mudar="fin-ajuste" data-tipo="${tipo}" data-id="${esc(x.id)}" data-campo="nome">
      ${tipo === 'categorias' ? `<label class="fin-limite"><span class="campo-ajuda">Limite no mês</span>
        <input type="number" min="0" step="10" inputmode="decimal" placeholder="sem limite" value="${Number(x.limite) || ''}" data-acao-mudar="fin-ajuste" data-tipo="${tipo}" data-id="${esc(x.id)}" data-campo="limite"></label>` : ''}
      ${x.id === 'outros' ? '' : `<button class="botao-icone botao-icone-p" type="button" data-acao="fin-ajuste-remover" data-tipo="${tipo}" data-id="${esc(x.id)}" aria-label="Tirar ${esc(x.nome)}">×</button>`}
    </li>`;
  return `
    <div class="fin-duas">
      <section class="card"><h2 class="card-titulo">Para onde vai (categorias de gasto)</h2>
        <p class="campo-ajuda">Com um limite, a barra fica laranja perto dele e vermelha quando passa.</p>
        <ul class="fin-ajustes">${prefs.categorias.map((c) => linha('categorias', c)).join('')}</ul>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fin-ajuste-novo" data-tipo="categorias">+ Categoria</button></section>
      <section class="card"><h2 class="card-titulo">De onde vem (fontes de dinheiro)</h2>
        <ul class="fin-ajustes">${prefs.origens.map((o) => linha('origens', o)).join('')}</ul>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="fin-ajuste-novo" data-tipo="origens">+ Fonte</button></section>
    </div>
    <section class="card"><h2 class="card-titulo">Planilha</h2>
      <p class="campo-ajuda">Baixa todos os lançamentos num arquivo que o Excel e o Google Planilhas abrem.</p>
      <button class="botao botao-secundario" type="button" data-acao="fin-csv">Baixar planilha (CSV)</button></section>`;
}

export function renderFinancas(estado) {
  const prefs = prefsFinancas(estado);
  const aba = ABAS_FINANCAS.some((a) => a.id === estado.parametro) ? estado.parametro : 'mes';
  const mes = estado.mesFinancas || mesDe(hojeIso());
  const r = resumoDoMes(estado.financas, mes, prefs);
  const sub = `${nomeMes(mes)} · ${r.sobrou < 0 ? 'faltou' : 'sobrou'} ${dinheiro(Math.abs(r.sobrou))}`;
  let corpo;
  if (aba === 'lancamentos') corpo = abaLancamentos(estado, mes, prefs);
  else if (aba === 'contas') corpo = abaContas(estado, mes);
  else if (aba === 'caixinhas') corpo = abaCaixinhas(estado);
  else if (aba === 'ajustes') corpo = abaAjustes(prefs);
  else if (aba === 'recompensas') corpo = abaRecompensas(estado);
  else corpo = abaMes(estado, mes, prefs);
  return `
    ${cabecalho('Finanças', esc(sub))}
    ${campoFinanceiro({ dica: lancamentos(estado.financas).length < 5 })}
    <nav class="segmentado tarefa-abas" aria-label="Partes das finanças">
      ${ABAS_FINANCAS.map((a) => `<a href="#financas/${a.id}" aria-current="${a.id === aba ? 'page' : 'false'}">${esc(a.nome)}</a>`).join('')}
    </nav>
    ${aba === 'mes' || aba === 'lancamentos' || aba === 'contas' ? navegarMes(mes, aba) : ''}
    <div class="tarefa-visao">${corpo}</div>`;
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const opcao = (v, atual, nome) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(nome)}</option>`;
const valorCampo = (v) => (v || v === 0 ? String(v).replace('.', ',') : '');

export function formLancamento(l = {}, prefs) {
  const tipo = l.tipo || 'saida';
  return `
    <form class="formulario" data-form="fin-lancamento" data-id="${esc(l.id || '')}" novalidate>
      <fieldset class="campo"><legend class="visualmente-oculto">Tipo</legend>
        <div class="segmentado">
          <label class="segmentado-opcao"><input type="radio" name="tipo" value="saida" data-acao-mudar="fin-tipo"${tipo === 'saida' ? ' checked' : ''}><span>Gasto</span></label>
          <label class="segmentado-opcao"><input type="radio" name="tipo" value="entrada" data-acao-mudar="fin-tipo"${tipo === 'entrada' ? ' checked' : ''}><span>Entrada</span></label>
        </div></fieldset>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Valor (R$)</span><input name="valor" type="text" inputmode="decimal" required value="${esc(valorCampo(l.valor))}" placeholder="0,00"></label>
        <label class="campo"><span class="campo-rotulo">Dia</span><input name="data" type="date" required value="${esc(l.data || hojeIso())}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Descrição</span><input name="descricao" type="text" maxlength="120" value="${esc(l.descricao || '')}"></label>
      <label class="campo" data-so="saida"${tipo === 'saida' ? '' : ' hidden'}><span class="campo-rotulo">Categoria</span>
        <select name="categoria">${prefs.categorias.map((c) => opcao(c.id, l.categoria || 'outros', c.nome)).join('')}</select></label>
      <div class="cal-form-linha" data-so="entrada"${tipo === 'entrada' ? '' : ' hidden'}>
        <label class="campo"><span class="campo-rotulo">De onde veio</span>
          <select name="origem">${prefs.origens.map((o) => opcao(o.id, l.origem || 'outros', o.nome)).join('')}</select></label>
        <label class="campo"><span class="campo-rotulo">Cliente (opcional)</span><input name="cliente" type="text" maxlength="60" value="${esc(l.dados?.cliente || '')}" placeholder="Ex.: Sensus"></label>
      </div>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${l.id ? 'Salvar' : 'Lançar'}</button>
        ${l.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="fin-excluir" data-id="${esc(l.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function formConta(c = {}, prefs) {
  return `
    <form class="formulario" data-form="fin-conta" data-id="${esc(c.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Conta</span><input name="descricao" type="text" maxlength="80" required value="${esc(c.descricao || '')}" placeholder="Ex.: Aluguel, Internet, Spotify"></label>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Valor (R$)</span><input name="valor" type="text" inputmode="decimal" required value="${esc(valorCampo(c.valor))}"></label>
        <label class="campo"><span class="campo-rotulo">Vence todo dia</span><input name="dia" type="number" min="1" max="31" required value="${esc(c.recorrencia?.dia || '')}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Categoria</span><select name="categoria">${prefs.categorias.map((x) => opcao(x.id, c.categoria || 'casa', x.nome)).join('')}</select></label>
      ${c.id ? `<label class="campo-marcar"><input type="checkbox" name="pausada"${c.dados?.pausada ? ' checked' : ''}><span>Pausada (não aparece nos meses)</span></label>` : ''}
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${c.id ? 'Salvar' : 'Criar conta fixa'}</button>
        ${c.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="fin-excluir" data-id="${esc(c.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function formCaixinha(c = {}) {
  return `
    <form class="formulario" data-form="fin-caixinha" data-id="${esc(c.id || '')}" novalidate>
      <label class="campo"><span class="campo-rotulo">Para quê</span><input name="descricao" type="text" maxlength="80" required value="${esc(c.descricao || '')}" placeholder="Ex.: Passeio em Brasília"></label>
      <label class="campo"><span class="campo-rotulo">Meta (R$, opcional)</span><input name="valor" type="text" inputmode="decimal" value="${esc(valorCampo(c.valor))}"></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${c.id ? 'Salvar' : 'Criar caixinha'}</button>
        ${c.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="fin-excluir" data-id="${esc(c.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function formMover(c, modo) {
  return `
    <form class="formulario" data-form="fin-mover" data-id="${esc(c.id)}" data-modo="${modo}" novalidate>
      <p class="campo-ajuda">${modo === 'guardar' ? 'Quanto você está guardando agora?' : 'Quanto vai tirar da caixinha?'} Guardado: ${dinheiro(progressoCaixinha(c).guardado)}.</p>
      <label class="campo"><span class="campo-rotulo">Valor (R$)</span><input name="valor" type="text" inputmode="decimal" required autofocus></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes"><button class="botao botao-primario" type="submit">${modo === 'guardar' ? 'Guardar' : 'Tirar'}</button></div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Cards do Hoje
// ---------------------------------------------------------------------------

export function cardFinancasHoje(estado) {
  const prefs = prefsFinancas(estado);
  const mes = mesDe(hojeIso());
  const r = resumoDoMes(estado.financas, mes, prefs);
  const maior = r.porCategoria[0];
  return `
    <section class="card" aria-labelledby="fin-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="fin-hoje-titulo">${esc(fmtMesCurto.format(new Date()).replace('.', '').replace(/^./, (c) => c.toUpperCase()))} até agora</h2>
        <a class="card-link" href="#financas">Finanças</a>
      </div>
      <ul class="lista-simples">
        <li><span>Entrou</span><strong class="fin-valor positivo">${dinheiro(r.entrou)}</strong></li>
        <li><span>Saiu</span><strong>${dinheiro(r.saiu)}</strong></li>
        <li><span>${r.sobrou < 0 ? 'Faltou' : 'Sobrou'}</span><strong class="${r.sobrou < 0 ? 'fin-negativo' : ''}">${dinheiro(Math.abs(r.sobrou))}</strong></li>
        ${r.entrou > 0 ? (() => { const l = livreParaGastar(estado.financas, hojeIso()); return `<li><span>Livre por dia</span><strong class="${l.livre < 0 ? 'fin-negativo' : 'fin-valor positivo'}">${l.livre < 0 ? '−' : ''}${dinheiro(Math.abs(l.porDia))}</strong></li>`; })() : ''}
        ${maior ? `<li><span class="campo-ajuda">Mais gasto: ${esc(maior.nome)}</span><span class="campo-ajuda">${dinheiro(maior.total)}</span></li>` : ''}
      </ul>
    </section>`;
}

export function cardContasHoje(estado) {
  const lista = contasDaSemana(estado.financas, hojeIso());
  if (!lista.length) return '';
  return `
    <section class="card" aria-labelledby="contas-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="contas-hoje-titulo">Contas da semana <span class="selo">${lista.length}</span></h2>
        <a class="card-link" href="#financas/contas">Contas</a>
      </div>
      <ul class="fin-contas">${lista.map(itemConta).join('')}</ul>
    </section>`;
}

