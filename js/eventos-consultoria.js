// Consultoria (Sensus): formulários na folha, etapas do funil, entregas feitas e excluir com Desfazer.

import { obterEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { confirmar } from './confirmar.js';
import { formConsultoria } from './views-consultoria.js';

let app;
export function ligarConsultoria(funcoes) { app = funcoes; }

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const cliente = (id) => (obterEstado().clientesConsultoria || []).find((c) => c.id === id);
const item = (id) => (obterEstado().consultoria || []).find((c) => c.id === id);
const salvarCliente = (d) => gravar('clientes', 'clientesConsultoria', d);
const salvarItem = (d) => gravar('consultoria', 'consultoria', d);

function abrirFolha(titulo, html) {
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  document.getElementById('folha-evento').showModal();
  document.querySelector('#folha-evento-conteudo input[name="nome"], #folha-evento-conteudo input[name="titulo"]')?.focus();
}
const fecharFolha = () => document.getElementById('folha-evento').close();
const TITULOS = { cliente: 'Cliente da consultoria', proposta: 'Proposta', entrega: 'Entrega ou encontro', encontro: 'Entrega ou encontro' };

// Proposta fechada sem cliente: vira cliente ativo (com o valor da proposta por mês).
async function fecharProposta(p) {
  if (p.cliente_id || !p.dados?.prospect) return;
  const novo = await salvarCliente({ nome: p.dados.prospect, status: 'ativo', inicio: new Date().toISOString().slice(0, 10), valor_mensal: p.valor || null, dados: { origem: 'proposta', proposta_id: p.id } });
  await salvarItem({ ...p, cliente_id: novo.id });
  app.avisoCurto(`${p.dados.prospect} virou cliente ativo.`);
}

export function cliqueConsultoria(alvo) {
  const { acao, id, valor, tipo } = alvo.dataset;
  if (!acao?.startsWith('cons-')) return false;
  const clientes = vivos(obterEstado().clientesConsultoria);
  switch (acao) {
    case 'cons-novo':
      abrirFolha(TITULOS[valor], formConsultoria(valor, {}, clientes));
      return true;
    case 'cons-editar': {
      if (tipo === 'cliente') { const c = cliente(id); if (c) abrirFolha(TITULOS.cliente, formConsultoria('cliente', c, clientes)); return true; }
      const i = item(id);
      if (i) abrirFolha(TITULOS[i.tipo] || 'Consultoria', formConsultoria(i.tipo === 'proposta' ? 'proposta' : 'entrega', i, clientes));
      return true;
    }
    case 'cons-etapa': {
      const p = item(id);
      if (!p) return true;
      const novo = { ...p, dados: { ...(p.dados || {}), etapa: valor } };
      salvarItem(novo).then(async () => { if (valor === 'fechada') await fecharProposta(novo); app.renderizar(); });
      return true;
    }
    case 'cons-feito': {
      const e = item(id);
      if (!e) return true;
      salvarItem({ ...e, dados: { ...(e.dados || {}), feito: true, feito_em: new Date().toISOString() } }).then(() => {
        app.renderizar();
        app.avisoCurto('Feito!', { rotulo: 'Desfazer', fn: async () => { const a = item(id); if (a) { await salvarItem({ ...a, dados: { ...(a.dados || {}), feito: false } }); app.renderizar(); } } });
      });
      return true;
    }
    case 'cons-excluir': {
      const ehCliente = tipo === 'cliente';
      const alvoItem = ehCliente ? cliente(id) : item(id);
      if (!alvoItem) return true;
      confirmar(`Excluir "${alvoItem.nome || alvoItem.titulo}"? Vai para a lixeira; dá para desfazer logo em seguida.`, { botao: 'Excluir', perigo: true }).then(async (ok) => {
        if (!ok) return;
        const salvarX = ehCliente ? salvarCliente : salvarItem;
        await salvarX({ ...alvoItem, excluido_em: new Date().toISOString() });
        fecharFolha();
        app.renderizar();
        app.avisoCurto('Excluído.', { rotulo: 'Desfazer', fn: async () => { await salvarX({ ...alvoItem, excluido_em: null }); app.renderizar(); } });
      });
      return true;
    }
    default:
      return false;
  }
}

export function enviarConsultoria(form) {
  const tipoForm = form.dataset.form;
  if (tipoForm !== 'cons-cliente' && tipoForm !== 'cons-item') return false;
  const f = new FormData(form);
  const erro = form.querySelector('[data-erro]');
  const falhar = (t) => { erro.textContent = t; erro.hidden = false; return true; };
  const id = form.dataset.id;
  if (tipoForm === 'cons-cliente') {
    const nome = String(f.get('nome') || '').trim();
    if (!nome) return falhar('Escreva o nome.');
    const base = id ? cliente(id) : { dados: {} };
    salvarCliente({ ...base, nome, status: f.get('status') || 'ativo', valor_mensal: f.get('valor_mensal') ? Number(f.get('valor_mensal')) : null, inicio: f.get('inicio') || null, notas: String(f.get('notas') || '').trim() || null })
      .then(() => { fecharFolha(); app.renderizar(); });
    return true;
  }
  const titulo = String(f.get('titulo') || '').trim();
  if (!titulo) return falhar('Escreva o que é.');
  const data = String(f.get('data') || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return falhar('Escolha o dia.');
  const proposta = form.dataset.tipo === 'proposta';
  const base = id ? item(id) : { dados: {} };
  const novo = {
    ...base,
    tipo: proposta ? 'proposta' : (f.get('tipo') === 'encontro' ? 'encontro' : 'entrega'),
    titulo, data, cliente_id: f.get('cliente_id') || null, texto: String(f.get('texto') || '').trim() || null,
    valor: proposta && f.get('valor') ? Number(f.get('valor')) : base.valor ?? null,
    dados: { ...(base.dados || {}), ...(proposta ? { etapa: f.get('etapa') || 'enviada', prospect: String(f.get('prospect') || '').trim() || null } : { hora: f.get('hora') || null }) },
  };
  salvarItem(novo).then(async (salvo) => {
    if (proposta && novo.dados.etapa === 'fechada' && base.dados?.etapa !== 'fechada') await fecharProposta({ ...novo, id: salvo?.id || novo.id });
    fecharFolha();
    app.renderizar();
  });
  return true;
}
