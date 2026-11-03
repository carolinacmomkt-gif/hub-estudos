// Aba Projetos: Novo projeto (cria o projeto, as tarefas e as datas do Calendário), números lançados
// por dia, tarefas por fase, itens das seções e aprendizados. As tarefas usam o mesmo "tarefa-coluna"
// do quadro do projeto (eventos-portfolio.js).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { iso } from './dados-tarefas.js';
import { instanteLocal } from './dados-calendario.js';
import { tipoDe, metodoDe, respostasPadrao, CAMPOS } from './modelos-projeto.js';
import { montarPlano, itensIniciais } from './dados-projetos.js';
import { rascunhoNovo, previaHtml } from './views-projetos.js';
import { perguntarTexto } from './confirmar.js';

let app;
export function ligarProjetos(funcoes) { app = funcoes; }

const projeto = (id) => (obterEstado().projetos || []).find((p) => p.id === id && !p.excluido_em);
const salvarProjeto = (p) => gravar('projetos', 'projetos', p);
const novoId = () => crypto.randomUUID();

// O rascunho do Novo projeto vive no estado (some ao recarregar, de propósito).
function baseDaRota() {
  const m = location.hash.match(/^#projetos\/novo:?(.*)$/);
  return m ? m[1] : '';
}
function rascunho() { return rascunhoNovo(obterEstado(), baseDaRota()); }
function mudarRascunho(campos, { redesenhar = true } = {}) {
  atualizarEstado({ projetoNovo: { ...rascunho(), ...campos } });
  if (redesenhar) app.renderizar();
}
function atualizarPrevia() {
  const caixa = document.querySelector('[data-pj-previa]');
  if (caixa) caixa.innerHTML = previaHtml(rascunho());
}

// Mexe num projeto com painel (lendo a versão mais nova da memória).
async function mudarDados(id, fn, { redesenhar = true } = {}) {
  const p = projeto(id);
  if (!p) return null;
  const dados = structuredClone(p.dados || {});
  fn(dados);
  const salvo = await salvarProjeto({ ...p, dados });
  if (redesenhar) app.renderizar();
  return salvo;
}

export function cliqueProjetos(alvo) {
  const { acao, id, valor, secao } = alvo.dataset;
  switch (acao) {
    case 'pj-tipo':
      // Na lista é um link: o estado muda e o link leva para o Novo projeto.
      mudarRascunho({ tipo: valor, metodo: '', respostas: {}, desmarcadas: [] }, { redesenhar: alvo.tagName !== 'A' });
      return true;
    case 'pj-metodo': {
      const r = rascunho();
      const t = tipoDe(r.tipo);
      mudarRascunho({ metodo: valor, desmarcadas: [], area: r.area || t?.area || 'pessoal' });
      requestAnimationFrame(() => document.querySelector('[data-form="pj-novo"] [name="titulo"]')?.focus());
      return true;
    }
    case 'pj-fase':
      atualizarEstado({ pjFase: { ...(obterEstado().pjFase || {}), [id]: valor } });
      app.renderizar();
      return true;
    case 'pj-extra':
      perguntarTexto('Nome do número (ex.: Inscritos na lista)', { maximo: 60 }).then((nome) => {
        if (!nome?.trim()) return;
        perguntarTexto('Meta (deixe vazio se não tiver)', { maximo: 12 }).then((meta) => {
          const m = Number(String(meta || '').replace(/\D/g, '')) || null;
          mudarDados(id, (d) => { d.extras = [...(d.extras || []), { id: `x-${Date.now().toString(36)}`, nome: nome.trim(), meta: m }]; });
        });
      });
      return true;
    case 'pj-item-feito':
      mudarDados(id, (d) => {
        d.itens = d.itens || {};
        d.itens[secao] = (d.itens[secao] || []).map((x) => (x.id === valor ? { ...x, feito: !x.feito } : x));
      });
      return true;
    case 'pj-item-tirar': {
      const item = (projeto(id)?.dados?.itens?.[secao] || []).find((x) => x.id === valor);
      if (!item) return true;
      mudarDados(id, (d) => { d.itens[secao] = (d.itens[secao] || []).filter((x) => x.id !== valor); }).then(() => {
        app.avisoCurto(`"${item.nome}" saiu.`, { rotulo: 'Desfazer', fn: () => mudarDados(id, (d) => { d.itens[secao] = [...(d.itens[secao] || []), item]; }) });
      });
      return true;
    }
    default:
      return false;
  }
}

export function mudancaProjetos(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (!acao?.startsWith('pj-')) return false;
  if (acao === 'pj-campo') {
    const r = rascunho();
    const nome = alvo.name;
    if (['titulo', 'chave', 'area'].includes(nome)) mudarRascunho({ [nome]: alvo.value }, { redesenhar: false });
    else if (CAMPOS[nome]) mudarRascunho({ respostas: { ...r.respostas, [nome]: CAMPOS[nome].tipo === 'numero' ? alvo.value : alvo.value } }, { redesenhar: false });
    if (nome !== 'titulo' && nome !== 'area') atualizarPrevia();
    return true;
  }
  if (tipo !== 'change') return true;
  if (acao === 'pj-desmarcar') {
    const r = rascunho();
    const fora = new Set(r.desmarcadas || []);
    if (alvo.checked) fora.delete(alvo.value); else fora.add(alvo.value);
    mudarRascunho({ desmarcadas: [...fora] }, { redesenhar: false });
    atualizarPrevia();
    return true;
  }
  if (acao === 'pj-item-campo') {
    const { id, secao, item, campo } = alvo.dataset;
    const valor = campo === 'palavras' ? Math.max(0, Number(alvo.value) || 0) : alvo.value;
    mudarDados(id, (d) => { d.itens[secao] = (d.itens[secao] || []).map((x) => (x.id === item ? { ...x, [campo]: valor } : x)); });
    return true;
  }
  if (acao === 'pj-aprendizados') {
    mudarDados(alvo.dataset.id, (d) => { d.aprendizados = alvo.value.trim(); }, { redesenhar: false });
    app.avisoCurto('Aprendizados guardados.');
    return true;
  }
  return true;
}

export function enviarProjetos(form) {
  switch (form.dataset.form) {
    case 'pj-novo':
      criar(form);
      return true;
    case 'pj-numeros': {
      const f = new FormData(form);
      const dia = String(f.get('dia') || iso(new Date()));
      const lancados = [...f.entries()].filter(([k, v]) => k.startsWith('k:') && String(v).trim() !== '').map(([k, v]) => [k.slice(2), Number(v) || 0]);
      if (!lancados.length) return true;
      mudarDados(form.dataset.id, (d) => {
        d.numeros = d.numeros || {};
        for (const [k, v] of lancados) d.numeros[k] = { ...(d.numeros[k] || {}), [dia]: (Number(d.numeros[k]?.[dia]) || 0) + v };
      }).then(() => app.avisoCurto('Números lançados.'));
      return true;
    }
    case 'pj-tarefa': {
      const f = new FormData(form);
      const titulo = String(f.get('titulo') || '').trim();
      if (!titulo) return true;
      const p = projeto(form.dataset.id);
      if (!p) return true;
      gravar('tarefas', 'tarefas', { titulo, projeto_id: p.id, area: p.area || 'pessoal', data: f.get('data') || null, prioridade: 0, ordem: Date.now() % 1e6, dados: { fase: form.dataset.fase, origem: 'projeto' } })
        .then(() => { app.renderizar(); document.querySelector('[data-form="pj-tarefa"] [name="titulo"]')?.focus(); });
      return true;
    }
    case 'pj-item': {
      const nome = String(new FormData(form).get('nome') || '').trim();
      if (!nome) return true;
      const { id, secao } = form.dataset;
      const etapa = { pessoas: 'conversa', propostas: 'proposta', modulos: 'roteiro', capitulos: 'rascunho' }[secao];
      mudarDados(id, (d) => {
        d.itens = d.itens || {};
        d.itens[secao] = [...(d.itens[secao] || []), { id: novoId(), nome, ...(etapa ? { etapa } : {}), ...(secao === 'capitulos' ? { palavras: 0 } : {}), ...(secao === 'materiais' || secao === 'encontros' ? { feito: false } : {}) }];
      }).then(() => document.querySelector(`[data-form="pj-item"][data-secao="${secao}"] [name="nome"]`)?.focus());
      return true;
    }
    default:
      return false;
  }
}

async function criar(form) {
  const r = rascunho();
  const t = tipoDe(r.tipo);
  const m = metodoDe(r.tipo, r.metodo);
  const erro = form.querySelector('[data-erro]');
  const titulo = String(form.elements.titulo?.value || r.titulo || '').trim();
  const chave = form.elements.chave?.value || r.chave;
  const falta = !titulo ? 'Dê um nome ao projeto.' : !chave ? `Escolha a data: ${m?.chave?.toLowerCase()}.` : '';
  if (falta || !t || !m) {
    erro.textContent = falta || 'Escolha o tipo e o método.';
    erro.hidden = false;
    return;
  }
  const hoje = iso(new Date());
  const respostas = { ...respostasPadrao(t.id), ...r.respostas };
  const plano = montarPlano({ tipo: t.id, metodo: m.id, respostas, chave, hoje });
  const fora = new Set(r.desmarcadas || []);
  const botao = form.querySelector('[type="submit"]');
  if (botao) botao.disabled = true;
  const area = form.elements.area?.value || r.area || t.area;
  const base = r.base ? projeto(r.base) : null;
  const dados = {
    ...(base?.dados || {}),
    modelo: { tipo: t.id, metodo: m.id, versao: 1 },
    chave,
    respostas,
    fases: plano.fases.map(({ id, nome, inicio, fim }) => ({ id, nome, inicio, fim })),
    numeros: base?.dados?.numeros || {},
    extras: base?.dados?.extras || [],
    itens: itensIniciais(t.id, respostas),
    aprendizados: base?.dados?.aprendizados || '',
  };
  const p = await salvarProjeto({ ...(base || { status: 'ativo', cor: '1' }), titulo, area, prazo: plano.fim, dados });
  const tarefas = plano.fases.flatMap((fz) => fz.tarefas.filter((x) => !fora.has(x.chave)).map((x) => ({ ...x, fase: fz.id })));
  let ordem = 0;
  for (const x of tarefas) {
    ordem += 1;
    await gravar('tarefas', 'tarefas', { titulo: x.titulo, projeto_id: p.id, area, data: x.data, prioridade: 0, ordem, dados: { fase: x.fase, origem: 'projeto', ...(x.marco ? { marco: x.marco } : {}) } });
  }
  // As datas principais (marcos) vão para o Calendário como eventos do dia inteiro.
  const eventos = [];
  for (const x of tarefas.filter((y) => y.marco)) {
    const ev = await gravar('eventos', 'eventos', { titulo: `${x.marco} · ${titulo}`, tipo: 'pessoal', inicio: instanteLocal(x.data, ''), fim: null, dia_inteiro: true, origem: 'manual', descricao: `Projeto: ${titulo}`, disciplina_id: null, status: null, link: `#projetos/${p.id}` });
    if (ev?.id) eventos.push(ev.id);
  }
  if (eventos.length) await salvarProjeto({ ...projeto(p.id), dados: { ...projeto(p.id).dados, eventos } });
  atualizarEstado({ projetoNovo: null });
  location.hash = `#projetos/${p.id}`;
  app.avisoCurto(`Projeto criado com ${tarefas.length} ${tarefas.length === 1 ? 'tarefa' : 'tarefas'}${eventos.length ? ` e ${eventos.length} ${eventos.length === 1 ? 'data' : 'datas'} no Calendário` : ''}.`);
}

