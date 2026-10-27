// Cliques e formulários de Hábitos e rotinas (e do card do Hoje).

import { obterEstado, atualizarEstado } from './estado.js';
import { gravar } from './gravacao.js';
import { SUGESTOES, ehRotina, registroDoDia, valorNoDia } from './dados-habitos.js';
import { formHabito, telaRotina, hojeIso } from './views-habitos.js';
import { celebrar } from './celebracao.js';

let app; // { renderizar, avisoCurto }

export function ligarHabitos(funcoes) {
  app = funcoes;
}

const habito = (id) => (obterEstado().habitos || []).find((h) => h.id === id);
const salvarHabito = (dados) => gravar('habitos', 'habitos', dados);
const diaEscolhido = () => (obterEstado().rota === 'habitos' && obterEstado().diaHabitos) || hojeIso();
const meta = (h) => Math.max(1, Number(h.meta) || 1);

function abrirFolha(titulo, html) {
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();

// Um registro por hábito e por dia: cria, muda o valor ou (com 0) apaga.
async function definirValor(h, dia, valor) {
  const atual = registroDoDia(obterEstado().habitoRegistros, h.id, dia);
  const novo = Math.max(0, Math.round(valor));
  if (atual) await gravar('habito_registros', 'habitoRegistros', { ...atual, valor: novo, excluido_em: novo ? null : new Date().toISOString() });
  else if (novo) await gravar('habito_registros', 'habitoRegistros', { habito_id: h.id, data: dia, valor: novo, dados: {} });
}

async function mudarValor(id, delta, alvo, { marcar = false } = {}) {
  const h = habito(id);
  if (!h) return;
  const dia = diaEscolhido();
  const antes = valorNoDia(obterEstado().habitoRegistros, h, dia);
  const depois = marcar ? (antes >= meta(h) ? 0 : meta(h)) : Math.min(meta(h) * 3, antes + delta);
  const completou = antes < meta(h) && depois >= meta(h);
  alvo?.closest('.habito')?.classList.add(completou ? 'marcando' : 'mexendo');
  navigator.vibrate?.(completou ? 18 : 8);
  await definirValor(h, dia, depois);
  app.renderizar();
}

export function cliqueHabitos(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('hab-')) return false;
  switch (acao) {
    case 'hab-dia':
      atualizarEstado({ diaHabitos: alvo.dataset.valor });
      app.renderizar();
      break;
    case 'hab-marcar':
      mudarValor(id, 0, alvo, { marcar: true });
      break;
    case 'hab-mais':
      mudarValor(id, 1, alvo);
      break;
    case 'hab-menos':
      mudarValor(id, -1, alvo);
      break;
    case 'hab-novo':
      abrirFolha('Novo hábito', formHabito());
      break;
    case 'hab-nova-rotina':
      abrirFolha('Nova rotina', formHabito({}, { rotina: true }));
      break;
    case 'hab-editar': {
      const h = habito(id);
      if (h) abrirFolha(ehRotina(h) ? 'Rotina' : 'Hábito', formHabito(h));
      break;
    }
    case 'hab-sugestao': {
      const s = SUGESTOES[Number(alvo.dataset.valor)];
      if (!s) break;
      salvarHabito({
        nome: s.nome, icone: s.icone, periodo: s.periodo, meta: s.meta || 1, unidade: s.unidade || null,
        frequencia: s.frequencia || { tipo: 'diario' }, ativo: true, ordem: (obterEstado().habitos || []).length, dados: s.passos ? { passos: s.passos } : {},
      }).then(() => {
        app.renderizar();
        app.avisoCurto(`${s.icone} ${s.nome} entrou nos seus hábitos.`);
      });
      break;
    }
    case 'hab-rotina': {
      const h = habito(id);
      if (h) abrirFolha(`${h.icone || ''} ${h.nome}`, telaRotina(h, 0));
      break;
    }
    case 'hab-passo': {
      const h = habito(id);
      if (!h) break;
      const passo = Number(alvo.dataset.passo);
      if (passo < (h.dados?.passos || []).length) {
        document.getElementById('folha-evento-conteudo').innerHTML = telaRotina(h, passo);
        navigator.vibrate?.(10);
        break;
      }
      definirValor(h, diaEscolhido(), meta(h)).then(() => {
        fecharFolha();
        app.renderizar();
        celebrar(h.icone || '✨', 'Rotina feita!', `${h.nome} completa. Bom começo de dia!`);
      });
      break;
    }
    case 'hab-pausar':
    case 'hab-excluir': {
      const h = habito(id);
      if (!h) break;
      const campos = acao === 'hab-pausar' ? { ativo: false } : { excluido_em: new Date().toISOString() };
      salvarHabito({ ...h, ...campos }).then(() => {
        fecharFolha();
        app.renderizar();
        app.avisoCurto(acao === 'hab-pausar' ? `${h.nome} pausado.` : `${h.nome} excluído.`, {
          rotulo: 'Desfazer',
          fn: async () => {
            await salvarHabito({ ...habito(id), ativo: true, excluido_em: null });
            app.renderizar();
          },
        });
      });
      break;
    }
    default:
      return false;
  }
  return true;
}

export function mudancaHabitos(alvo, tipo) {
  if (alvo.dataset?.acaoMudar !== 'hab-freq') return false;
  if (tipo === 'change') {
    const form = alvo.closest('form');
    form.querySelectorAll('[data-freq]').forEach((el) => { el.hidden = el.dataset.freq !== alvo.value; });
  }
  return true;
}

export function enviarHabitos(form) {
  if (form.dataset.form !== 'hab-item') return false;
  const f = new FormData(form);
  const nome = String(f.get('nome') || '').trim();
  const rotina = form.dataset.rotina === '1';
  const passos = rotina ? String(f.get('passos') || '').split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 30) : null;
  const caixa = form.querySelector('[data-erro]');
  const erro = !nome ? 'Dê um nome.' : rotina && !passos.length ? 'Escreva pelo menos um passo.' : null;
  if (erro) {
    caixa.textContent = erro;
    caixa.hidden = false;
    return true;
  }
  const freq = f.get('freq');
  let frequencia = { tipo: 'diario' };
  if (freq === 'dias') {
    const dias = f.getAll('dias').map(Number);
    frequencia = dias.length ? { tipo: 'dias', dias } : { tipo: 'diario' };
  } else if (freq === 'vezes') frequencia = { tipo: 'vezes', vezes: Math.min(7, Math.max(1, Number(f.get('vezes')) || 3)) };
  const atual = form.dataset.id ? habito(form.dataset.id) : null;
  salvarHabito({
    ...(atual || { ativo: true, ordem: (obterEstado().habitos || []).length }),
    nome: nome.slice(0, 60), icone: String(f.get('icone') || '✓').trim().slice(0, 4) || '✓', periodo: f.get('periodo') || 'qualquer',
    meta: rotina ? 1 : Math.max(1, Math.min(999, Number(f.get('meta')) || 1)), unidade: rotina ? null : String(f.get('unidade') || '').trim().slice(0, 20) || null,
    frequencia, dados: { ...(atual?.dados || {}), ...(rotina ? { passos } : {}) },
  }).then(() => {
    fecharFolha();
    app.renderizar();
    if (!atual) app.avisoCurto(rotina ? 'Rotina criada. Toque nela para começar.' : 'Hábito criado.');
  });
  return true;
}
