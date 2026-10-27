// Cliques e formulários de Finanças (e dos cards do Hoje).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { listar, salvar } from './persistencia.js';
import { lerLancamento, lerValor, mesDe, paraCSV, progressoCaixinha, parcelar, fatura, sugestoesDeContaFixa } from './dados-financas.js';
import {
  prefsFinancas, formLancamento, formConta, formCaixinha, formMover, formCartao, formEntradaFixa, textoPreviaFin, hojeIso, valoresOcultos, ocultarValores, dinheiro,
} from './views-financas.js';
import { flutuar } from './celebracao.js';
import { pontosDoLancamento, PONTOS } from './dados-recompensas.js';
import { diaNoMes } from './dados-financas.js';

let app; // { renderizar, avisoCurto }

export function ligarFinancas(funcoes) {
  app = funcoes;
}

const linha = (id) => (obterEstado().financas || []).find((l) => l.id === id);
const salvarLinha = (dados) => gravar('financas', 'financas', dados);
const prefs = () => prefsFinancas(obterEstado());

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
  folha.querySelector('input[name="valor"], input[name="descricao"]')?.focus();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();

function erro(form, texto) {
  const caixa = form.querySelector('[data-erro]');
  caixa.textContent = texto;
  caixa.hidden = false;
  return true;
}

async function mudarAjustes(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'financas');
  const valor = { categorias: [], origens: [], ...(atual?.valor || {}) };
  fn(valor);
  const salvo = await salvar('config', { ...(atual || {}), chave: 'financas', valor });
  atualizarEstado({ config: await listar('config') });
  return salvo;
}

function mexerNaLista(valor, tipo, id, campos) {
  const lista = valor[tipo] || (valor[tipo] = []);
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = { ...lista[i], ...campos };
  else lista.push({ id, ...campos });
}

// Grava uma compra: à vista ou dividida em parcelas mensais (todas com o mesmo grupo).
async function gravarCompra(base, parcelas) {
  if (parcelas > 1 && base.tipo === 'saida') {
    const grupo = `pc-${Date.now().toString(36)}`;
    let primeira = null;
    for (const p of parcelar(base, parcelas, grupo)) {
      const salvo = await salvarLinha(p);
      primeira = primeira || salvo;
    }
    return primeira;
  }
  return salvarLinha(base);
}

let buscaTempo = null;

function baixar(nome, texto) {
  const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function excluir(id) {
  const l = linha(id);
  if (!l) return;
  await salvarLinha({ ...l, excluido_em: new Date().toISOString() });
  fecharFolha();
  app.renderizar();
  app.avisoCurto(l.tipo === 'conta' ? 'Conta fixa excluída.' : l.tipo === 'caixinha' ? 'Caixinha excluída.' : 'Lançamento excluído.', {
    rotulo: 'Desfazer',
    fn: async () => {
      await salvarLinha({ ...linha(id), excluido_em: null });
      app.renderizar();
    },
  });
}

export function cliqueFinancas(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('fin-')) return false;
  switch (acao) {
    case 'fin-mes':
      atualizarEstado({ mesFinancas: alvo.dataset.valor });
      app.renderizar();
      return true;
    case 'fin-ocultar':
      ocultarValores(!valoresOcultos());
      app.renderizar();
      return true;
    case 'fin-filtro':
      atualizarEstado({ filtroFinancas: alvo.dataset.valor || '' });
      app.renderizar();
      return true;
    case 'fin-novo':
      abrirFolha('Novo lançamento', formLancamento({}, prefs()));
      return true;
    case 'fin-abrir': {
      const l = linha(id);
      if (l) abrirFolha(l.tipo === 'entrada' ? 'Entrada' : 'Gasto', formLancamento(l, prefs()));
      return true;
    }
    case 'fin-excluir':
      excluir(id);
      return true;
    case 'fin-conta-nova':
      abrirFolha('Nova conta fixa', formConta({}, prefs()));
      return true;
    case 'fin-conta-editar': {
      const c = linha(id);
      if (c) abrirFolha('Conta fixa', formConta(c, prefs()));
      return true;
    }
    case 'fin-conta-pagar': {
      const c = linha(id);
      if (!c) return true;
      const mes = alvo.dataset.mes || mesDe(hojeIso());
      const emDia = hojeIso() <= diaNoMes(mes, Number(c.recorrencia?.dia) || 1);
      if (emDia) flutuar(alvo, `+${PONTOS.contaEmDia}`);
      alvo.disabled = true;
      salvarLinha({
        tipo: 'saida', valor: c.valor, data: hojeIso(), descricao: c.descricao, categoria: c.categoria || 'outros',
        pago: true, dados: { conta_id: c.id, mes },
      }).then(() => {
        app.renderizar();
        app.avisoCurto(emDia ? `${c.descricao} paga em dia. +${PONTOS.contaEmDia} pontos.` : `${c.descricao} paga.`);
      });
      return true;
    }
    case 'fin-conta-desfazer': {
      const l = linha(id);
      if (l) salvarLinha({ ...l, excluido_em: new Date().toISOString() }).then(() => app.renderizar());
      return true;
    }
    case 'fin-caixinha-nova':
      abrirFolha('Nova caixinha', formCaixinha());
      return true;
    case 'fin-caixinha-editar': {
      const c = linha(id);
      if (c) abrirFolha('Caixinha', formCaixinha(c));
      return true;
    }
    case 'fin-caixinha-mover': {
      const c = linha(id);
      if (c) abrirFolha(alvo.dataset.modo === 'guardar' ? `Guardar em: ${c.descricao}` : `Tirar de: ${c.descricao}`, formMover(c, alvo.dataset.modo));
      return true;
    }
    case 'fin-ajuste-novo': {
      const tipo = alvo.dataset.tipo;
      const nome = window.prompt(tipo === 'categorias' ? 'Nome da nova categoria de gasto:' : 'Nome da nova fonte de dinheiro:');
      if (nome?.trim()) {
        mudarAjustes((v) => mexerNaLista(v, tipo, `p-${Date.now().toString(36)}`, { nome: nome.trim().slice(0, 40), palavras: [] }))
          .then(() => app.renderizar());
      }
      return true;
    }
    case 'fin-ajuste-remover': {
      const tipo = alvo.dataset.tipo;
      if (!window.confirm('Tirar da lista? Os lançamentos antigos continuam, aparecendo como "Outros".')) return true;
      mudarAjustes((v) => mexerNaLista(v, tipo, id, { removida: true })).then(() => app.renderizar());
      return true;
    }
    case 'fin-cartao-novo':
      abrirFolha('Novo cartão', formCartao());
      return true;
    case 'fin-cartao-editar': {
      const c = linha(id);
      if (c) abrirFolha('Cartão', formCartao(c));
      return true;
    }
    case 'fin-entrada-nova':
      abrirFolha('Nova entrada fixa', formEntradaFixa({}, prefs()));
      return true;
    case 'fin-entrada-editar': {
      const e = linha(id);
      if (e) abrirFolha('Entrada fixa', formEntradaFixa(e, prefs()));
      return true;
    }
    case 'fin-entrada-receber': {
      const e = linha(id);
      if (!e) return true;
      alvo.disabled = true;
      salvarLinha({
        tipo: 'entrada', valor: e.valor, data: hojeIso(), descricao: e.descricao, origem: e.origem || 'outros', pago: true,
        dados: { receita_id: e.id, mes: alvo.dataset.mes || mesDe(hojeIso()) },
      }).then(() => {
        app.renderizar();
        app.avisoCurto(`${e.descricao}: recebido.`);
      });
      return true;
    }
    case 'fin-entrada-desfazer':
    case 'fin-fatura-desfazer': {
      const alvoLinha = acao === 'fin-fatura-desfazer'
        ? (obterEstado().financas || []).find((l) => !l.excluido_em && l.tipo === 'pagamento' && l.dados?.cartao_id === id && l.dados?.mes === alvo.dataset.mes)
        : linha(id);
      if (alvoLinha) salvarLinha({ ...alvoLinha, excluido_em: new Date().toISOString() }).then(() => app.renderizar());
      return true;
    }
    case 'fin-fatura-pagar': {
      const c = linha(id);
      if (!c) return true;
      const f = fatura(obterEstado().financas, c, alvo.dataset.mes);
      const emDia = hojeIso() <= f.vencimento;
      if (emDia) flutuar(alvo, `+${PONTOS.contaEmDia}`);
      alvo.disabled = true;
      // O pagamento da fatura não é um gasto novo: as compras já contaram no dia em que foram feitas.
      salvarLinha({ tipo: 'pagamento', valor: f.total, data: hojeIso(), descricao: `Fatura ${c.descricao}`, pago: true, dados: { cartao_id: c.id, mes: f.mes } })
        .then(() => {
          app.renderizar();
          app.avisoCurto(`Fatura do ${c.descricao} paga${emDia ? ` em dia. +${PONTOS.contaEmDia} pontos` : ''}.`);
        });
      return true;
    }
    case 'fin-sugestao-aceitar': {
      const g = sugestoesDeContaFixa(obterEstado().financas, hojeIso(), prefs().ignoradas).find((x) => x.chave === alvo.dataset.chave);
      if (g) abrirFolha('Nova conta fixa', formConta({ descricao: g.descricao, valor: g.valor, recorrencia: { dia: g.dia }, categoria: g.categoria }, prefs()));
      return true;
    }
    case 'fin-sugestao-ignorar':
      mudarAjustes((v) => { v.ignoradas = [...new Set([...(v.ignoradas || []), alvo.dataset.chave])]; }).then(() => app.renderizar());
      return true;
    case 'fin-parcelas-cancelar': {
      const grupo = alvo.dataset.grupo;
      const futuras = (obterEstado().financas || []).filter((l) => !l.excluido_em && l.dados?.parcela?.grupo === grupo && mesDe(l.data) > mesDe(hojeIso()));
      if (!futuras.length || !window.confirm(`Tirar as ${futuras.length} parcelas que ainda vão vir? (Use quando quitar antes ou cancelar a compra. As já lançadas continuam.)`)) return true;
      Promise.all(futuras.map((l) => salvarLinha({ ...l, excluido_em: new Date().toISOString() }))).then(() => {
        app.renderizar();
        app.avisoCurto('Parcelas futuras retiradas.', {
          rotulo: 'Desfazer',
          fn: async () => {
            for (const l of futuras) await salvarLinha({ ...l, excluido_em: null });
            app.renderizar();
          },
        });
      });
      return true;
    }
    case 'fin-csv':
      baixar(`financas-${hojeIso()}.csv`, paraCSV(obterEstado().financas, prefs()));
      return true;
    default:
      return false;
  }
}

export function mudancaFinancas(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'fin-previa') {
    const previa = alvo.closest('form')?.querySelector('[data-previa]');
    if (previa) previa.textContent = textoPreviaFin(alvo.value, prefs());
    return true;
  }
  if (acao === 'fin-busca') {
    clearTimeout(buscaTempo);
    buscaTempo = setTimeout(() => {
      atualizarEstado({ buscaFinancas: alvo.value });
      app.renderizar();
    }, 250);
    return true;
  }
  if (acao === 'fin-tipo') {
    const form = alvo.closest('form');
    form.querySelectorAll('[data-so]').forEach((el) => { el.hidden = el.dataset.so !== alvo.value; });
    return true;
  }
  if (acao === 'fin-ajuste') {
    if (tipo !== 'change') return true;
    const { tipo: lista, id, campo } = alvo.dataset;
    const valor = campo === 'limite' ? (Number(alvo.value) > 0 ? Number(alvo.value) : null) : alvo.value.trim().slice(0, 40);
    if (campo === 'nome' && !valor) return true;
    mudarAjustes((v) => mexerNaLista(v, lista, id, { [campo]: valor })).then(() => app.avisoCurto('Salvo.'));
    return true;
  }
  return false;
}

export function enviarFinancas(form) {
  const tipoForm = form.dataset.form;
  if (!tipoForm?.startsWith('fin-')) return false;
  const f = new FormData(form);
  if (tipoForm === 'fin-rapido') {
    const campo = form.querySelector('[name="texto"]');
    const r = lerLancamento(campo.value, hojeIso(), prefs());
    if (!Number.isFinite(r.valor) || r.valor <= 0) {
      form.querySelector('[data-previa]').textContent = 'Falta o valor (ex.: "mercado 120").';
      return true;
    }
    const ganho = pontosDoLancamento(obterEstado().financas, r.data);
    if (ganho) flutuar(form.querySelector('[type="submit"]'), `+${ganho}`);
    gravarCompra({
      tipo: r.tipo, valor: r.valor, data: r.data, descricao: r.descricao, categoria: r.categoria, origem: r.origem,
      conta: r.conta, pago: true, dados: r.cliente ? { cliente: r.cliente } : {},
    }, r.parcelas).then((salvo) => {
      campo.value = '';
      form.querySelector('[data-previa]').textContent = '';
      app.renderizar();
      document.getElementById(campo.id)?.focus();
      const grupo = salvo.dados?.parcela?.grupo;
      app.avisoCurto(grupo ? `Compra de ${dinheiro(r.valor)} em ${r.parcelas}x lançada.` : `${r.tipo === 'entrada' ? 'Entrada' : 'Gasto'} de ${dinheiro(r.valor)} lançado.`, {
        rotulo: 'Desfazer',
        fn: async () => {
          const todas = grupo ? (obterEstado().financas || []).filter((l) => l.dados?.parcela?.grupo === grupo) : [linha(salvo.id)];
          for (const l of todas) await salvarLinha({ ...l, excluido_em: new Date().toISOString() });
          app.renderizar();
        },
      });
    });
    return true;
  }
  if (tipoForm === 'fin-lancamento') {
    const valor = lerValor(f.get('valor'));
    if (!Number.isFinite(valor) || valor <= 0) return erro(form, 'Escreva um valor maior que zero.');
    const tipo = f.get('tipo') === 'entrada' ? 'entrada' : 'saida';
    const atual = form.dataset.id ? linha(form.dataset.id) : null;
    const cliente = String(f.get('cliente') || '').trim();
    const parcelas = atual ? 1 : Math.min(48, Math.max(1, Number(f.get('parcelas')) || 1));
    gravarCompra({
      ...(atual || { pago: true }), tipo, valor, data: f.get('data') || hojeIso(), descricao: String(f.get('descricao') || '').trim(),
      categoria: tipo === 'saida' ? f.get('categoria') : null, origem: tipo === 'entrada' ? f.get('origem') : null, conta: f.get('conta') || null,
      dados: { ...(atual?.dados || {}), cliente: tipo === 'entrada' && cliente ? cliente : undefined },
    }, parcelas).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipoForm === 'fin-conta') {
    const valor = lerValor(f.get('valor'));
    const dia = Math.min(31, Math.max(1, Number(f.get('dia')) || 0));
    const descricao = String(f.get('descricao') || '').trim();
    if (!descricao) return erro(form, 'Dê um nome à conta.');
    if (!Number.isFinite(valor) || valor <= 0) return erro(form, 'Escreva o valor da conta.');
    if (!Number(f.get('dia'))) return erro(form, 'Em que dia do mês ela vence?');
    const atual = form.dataset.id ? linha(form.dataset.id) : null;
    salvarLinha({
      ...(atual || {}), tipo: 'conta', valor, descricao, categoria: f.get('categoria'), data: atual?.data || hojeIso(),
      recorrencia: { dia }, pago: false, dados: { ...(atual?.dados || {}), pausada: f.get('pausada') === 'on' },
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipoForm === 'fin-cartao') {
    const descricao = String(f.get('descricao') || '').trim();
    const fechamento = Math.min(31, Math.max(1, Number(f.get('fechamento')) || 0));
    const vencimento = Math.min(31, Math.max(1, Number(f.get('vencimento')) || 0));
    if (!descricao) return erro(form, 'Dê um nome ao cartão.');
    if (!Number(f.get('fechamento')) || !Number(f.get('vencimento'))) return erro(form, 'Preencha o dia de fechamento e o de vencimento.');
    const limite = f.get('valor') ? lerValor(f.get('valor')) : 0;
    const atual = form.dataset.id ? linha(form.dataset.id) : null;
    salvarLinha({
      ...(atual || {}), tipo: 'cartao', descricao: descricao.slice(0, 40), valor: Number.isFinite(limite) ? limite : 0, data: atual?.data || hojeIso(), pago: false,
      dados: { ...(atual?.dados || {}), fechamento, vencimento },
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipoForm === 'fin-entrada') {
    const descricao = String(f.get('descricao') || '').trim();
    const valor = lerValor(f.get('valor'));
    if (!descricao) return erro(form, 'Dê um nome à entrada.');
    if (!Number.isFinite(valor) || valor <= 0) return erro(form, 'Escreva o valor.');
    if (!Number(f.get('dia'))) return erro(form, 'Em que dia do mês ela entra?');
    const atual = form.dataset.id ? linha(form.dataset.id) : null;
    salvarLinha({
      ...(atual || {}), tipo: 'receita', descricao, valor, origem: f.get('origem') || 'outros', data: atual?.data || hojeIso(), pago: false,
      recorrencia: { dia: Math.min(31, Math.max(1, Number(f.get('dia')))) }, dados: { ...(atual?.dados || {}), pausada: f.get('pausada') === 'on' },
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipoForm === 'fin-caixinha') {
    const descricao = String(f.get('descricao') || '').trim();
    if (!descricao) return erro(form, 'Para que é essa caixinha?');
    const meta = f.get('valor') ? lerValor(f.get('valor')) : 0;
    const atual = form.dataset.id ? linha(form.dataset.id) : null;
    salvarLinha({
      ...(atual || {}), tipo: 'caixinha', descricao, valor: Number.isFinite(meta) ? meta : 0,
      data: atual?.data || hojeIso(), pago: false,
      dados: { guardado: 0, historico: [], ...(atual?.dados || {}), prazo: f.get('prazo') || null, reserva: f.get('reserva') === 'on' },
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipoForm === 'fin-mover') {
    const c = linha(form.dataset.id);
    const valor = lerValor(f.get('valor'));
    if (!c) return true;
    if (!Number.isFinite(valor) || valor <= 0) return erro(form, 'Escreva um valor maior que zero.');
    const guardado = progressoCaixinha(c).guardado;
    const tirar = form.dataset.modo === 'tirar';
    if (tirar && valor > guardado) return erro(form, `A caixinha tem ${dinheiro(guardado)}.`);
    const novo = Math.round((guardado + (tirar ? -valor : valor)) * 100) / 100;
    const historico = [...(c.dados?.historico || []), { data: hojeIso(), valor: tirar ? -valor : valor }].slice(-200);
    const ganho = tirar ? 0 : Math.floor(valor / 10) * PONTOS.porDezGuardados;
    if (ganho) flutuar(form.querySelector('[type="submit"]'), `+${ganho}`);
    salvarLinha({ ...c, dados: { ...(c.dados || {}), guardado: novo, historico } }).then(() => {
      fecharFolha();
      app.renderizar();
      const pr = progressoCaixinha({ ...c, dados: { guardado: novo } });
      app.avisoCurto(!tirar && pr.meta && pr.fracao >= 1 ? `Meta de "${c.descricao}" batida! 🎉` : tirar ? 'Tirado da caixinha.' : 'Guardado!');
    });
    return true;
  }
  return false;
}
