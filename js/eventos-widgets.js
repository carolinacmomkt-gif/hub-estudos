// Configurações → Widgets do iPhone: montar, editar e excluir widgets (config "widgets"),
// com a prévia mudando enquanto ela escolhe área e cores.

import { obterEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { widgetsDaConfig, parametroDoNome, AREAS_WIDGET, PALETAS_WIDGET, MODOS_WIDGET } from './dados-widgets.js';
import { formWidget, widgetDoForm, previaWidget } from './views-widgets.js';

let app; // { renderizar, avisoCurto }

export function ligarWidgets(funcoes) {
  app = funcoes;
}

async function mudar(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'widgets');
  const itens = widgetsDaConfig(atual ? [atual] : []);
  const novos = fn([...itens]);
  await salvar('config', { ...(atual || {}), chave: 'widgets', valor: { itens: novos }, excluido_em: null });
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}

// Nome sem repetir o parâmetro de outro widget ("financas", "financas-2"...).
function parametroLivre(nome, itens, original) {
  const base = parametroDoNome(nome) || 'widget';
  let p = base;
  for (let i = 2; itens.some((w) => w.parametro === p && w.parametro !== original); i += 1) p = `${base}-${i}`;
  return p;
}

async function salvarWidget(form) {
  const w = widgetDoForm(form);
  const erro = form.querySelector('[data-erro]');
  if (!w.nome) {
    erro.textContent = 'Dê um nome ao widget (ele vira o Parâmetro).';
    erro.hidden = false;
    form.elements.nome.focus();
    return;
  }
  const original = form.dataset.original || '';
  let parametro = '';
  await mudar((itens) => {
    parametro = parametroLivre(w.nome, itens, original);
    const item = {
      parametro, nome: w.nome,
      area: AREAS_WIDGET.some((a) => a.id === w.area) ? w.area : 'hoje',
      paleta: w.paleta === 'propria' || PALETAS_WIDGET.some((p) => p.id === w.paleta) ? w.paleta : 'bussola',
      modo: MODOS_WIDGET.some((m) => m.id === w.modo) ? w.modo : 'auto',
      ...(w.paleta === 'propria' ? { cores: w.cores } : {}),
    };
    const i = itens.findIndex((x) => x.parametro === original);
    if (i >= 0) itens[i] = item; else itens.push(item);
    return itens;
  });
  document.getElementById('folha-evento')?.close();
  app.renderizar();
  app.avisoCurto(`Widget salvo. No iPhone, use o Parâmetro "${parametro}".`);
}

async function excluirWidget(parametro) {
  const antes = widgetsDaConfig(obterEstado().config);
  const w = antes.find((x) => x.parametro === parametro);
  if (!w) return;
  await mudar((itens) => itens.filter((x) => x.parametro !== parametro));
  app.renderizar();
  app.avisoCurto(`"${w.nome}" excluído.`, { rotulo: 'Desfazer', fn: async () => { await mudar(() => antes); app.renderizar(); } });
}

export function cliqueWidgets(alvo) {
  const { acao, parametro } = alvo.dataset;
  if (!['widget-novo', 'widget-editar', 'widget-excluir', 'widget-copiar-parametro'].includes(acao)) return false;
  if (acao === 'widget-novo') abrirFolha('Novo widget', formWidget());
  else if (acao === 'widget-editar') {
    const w = widgetsDaConfig(obterEstado().config).find((x) => x.parametro === parametro);
    if (w) abrirFolha('Editar o widget', formWidget(w));
  } else if (acao === 'widget-excluir') excluirWidget(parametro);
  else navigator.clipboard?.writeText(parametro).then(() => app.avisoCurto('Parâmetro copiado.')).catch(() => app.avisoCurto('Segure o texto para copiar.'));
  return true;
}

export function mudancaWidgets(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'widget-previa') return false;
  const form = alvo.closest('form');
  const w = widgetDoForm(form);
  form.querySelector('[data-widget-previa]').innerHTML = previaWidget(w, 'claro', { medio: true }) + previaWidget(w, 'escuro', { medio: true });
  form.querySelector('[data-widget-parametro]').textContent = parametroDoNome(w.nome) || '…';
  form.querySelector('[data-widget-proprias]').hidden = w.paleta !== 'propria';
  form.querySelector('[data-widget-area-desc]').textContent = AREAS_WIDGET.find((a) => a.id === w.area)?.descricao || '';
  return tipo === 'input' || tipo === 'change';
}

export function enviarWidgets(form) {
  if (form.dataset.form !== 'widget') return false;
  salvarWidget(form);
  return true;
}
