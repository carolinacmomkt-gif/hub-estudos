// Cliques e formulários de Estudos gerais (trilhas e temas).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { renderFormArea } from './views-estudos.js';
import { areaPeloId, areasAtivas, novoItem, conteudoDaArea } from './dados-estudos.js';
import { criarSimulado } from './eventos-questoes.js';
import { sortear } from './dados-questoes.js';
import { confirmar } from './confirmar.js';

let app; // { renderizar, avisoCurto }

export function ligarEstudos(funcoes) {
  app = funcoes;
}

const aberta = () => areaPeloId(obterEstado(), obterEstado().parametro);

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  document.getElementById('folha-evento').showModal();
  document.querySelector('#folha-evento-conteudo [name="nome"]')?.focus();
}

async function mudarItens(fn) {
  const a = aberta();
  if (!a) return;
  await gravar('areas', 'areas', { ...a, itens: fn([...(Array.isArray(a.itens) ? a.itens : [])]) });
  app.renderizar();
}

export function cliqueEstudos(alvo) {
  const acao = alvo.dataset.acao;
  if (!acao?.startsWith('est-')) return false;
  const a = aberta();
  switch (acao) {
    case 'est-nova':
      abrirFolha('Nova trilha ou tema', renderFormArea());
      break;
    case 'est-editar':
      if (a) abrirFolha(`Editar: ${a.nome}`, renderFormArea(a));
      break;
    case 'est-excluir':
      if (a) confirmar(`Excluir "${a.nome}"? As leituras, cadernos e questões continuam, só deixam de estar ligados.`).then((ok) => { if (!ok) return;
        gravar('areas', 'areas', { ...a, excluido_em: new Date().toISOString() }).then(() => {
          location.hash = '#estudos';
          app.avisoCurto('Excluído.');
        });
      });
      break;
    case 'est-item-mover': {
      const passo = Number(alvo.dataset.passo);
      mudarItens((itens) => {
        const i = itens.findIndex((x) => x.id === alvo.dataset.id);
        const j = i + passo;
        if (i < 0 || j < 0 || j >= itens.length) return itens;
        [itens[i], itens[j]] = [itens[j], itens[i]];
        return itens;
      });
      break;
    }
    case 'est-item-tirar':
      mudarItens((itens) => itens.filter((x) => x.id !== alvo.dataset.id));
      break;
    case 'est-questoes':
      if (a) {
        atualizarEstado({ questoesPreset: { fonte: 'tema', tema: a.nome + (a.descricao ? `: ${a.descricao}` : ''), area: a.id }, qFonte: 'tema' });
        location.hash = '#questoes/gerar';
      }
      break;
    case 'est-simulado':
      if (a) {
        const todas = conteudoDaArea(obterEstado(), a.id).questoes;
        const objetivas = todas.filter((q) => q.tipo !== 'dissertativa');
        const modo = objetivas.length ? 'prova' : 'fixacao';
        criarSimulado({ modo, ids: sortear(objetivas.length ? objetivas : todas, 10).map((q) => q.id), titulo: `Simulado · ${a.nome}`, area_id: a.id });
      }
      break;
    case 'est-leitura':
      if (a) {
        atualizarEstado({ bibPreenchido: { area: a.id } });
        location.hash = '#biblioteca/novo';
      }
      break;
    case 'est-ver-questoes':
      if (a) {
        atualizarEstado({ qFiltros: { area: a.id }, qVisao: 'banco' });
        location.hash = '#questoes';
      }
      break;
    default:
      return false;
  }
  return true;
}

export function mudancaEstudos(alvo, tipo) {
  if (!alvo.dataset?.estItem) return false;
  if (tipo === 'change') {
    mudarItens((itens) => itens.map((x) => (x.id === alvo.dataset.estItem ? { ...x, feito: alvo.checked } : x)))
      .then(() => {
        const a = aberta();
        if (a?.itens?.length && a.itens.every((x) => x.feito)) app.avisoCurto('Trilha concluída. Parabéns!');
      });
  }
  return true;
}

async function salvarArea(form) {
  const el = form.elements;
  const nome = el.nome.value.trim();
  if (!nome) {
    const erro = form.querySelector('[data-erro]');
    erro.textContent = 'Dê um nome.';
    erro.hidden = false;
    return;
  }
  const atual = form.dataset.id ? areaPeloId(obterEstado(), form.dataset.id) : null;
  const itens = atual ? atual.itens : (el.itens?.value || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 200).map(novoItem);
  const salvo = await gravar('areas', 'areas', {
    ...(atual || { ordem: areasAtivas(obterEstado()).length }),
    nome: nome.slice(0, 100),
    tipo: el.tipo.value === 'tema' ? 'tema' : 'trilha',
    descricao: el.descricao.value.trim() || null,
    cor: el.cor.value || '1',
    itens: itens || [],
    meta: { texto: el.meta.value.trim(), ate: el.ate.value || null },
  });
  document.getElementById('folha-evento').close();
  if (atual) app.renderizar();
  else location.hash = `#estudos/${salvo.id}`;
}

async function adicionarItem(form) {
  const texto = form.elements.texto.value.trim();
  if (!texto) return;
  await mudarItens((itens) => [...itens, novoItem(texto)]);
  document.querySelector('[data-form="est-item"] [name="texto"]')?.focus();
}

export function enviarEstudos(form) {
  if (form.dataset.form === 'est-area') salvarArea(form);
  else if (form.dataset.form === 'est-item') adicionarItem(form);
  else return false;
  return true;
}
