// Recompensas: criar, editar, resgatar (com o gasto em Finanças, se a Carol quiser) e a
// comemoração quando ela sobe de nível ou desbloqueia uma conquista.

import { obterEstado, atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { gravar } from './gravacao.js';
import { RECOMPENSAS_PADRAO, recompensasDe, situacaoGamificacao } from './dados-recompensas.js';
import { lerValor } from './dados-financas.js';
import { dadosGamificacao, formRecompensa, formResgate } from './views-recompensas.js';
import { celebrar } from './celebracao.js';

let app; // { renderizar, avisoCurto }
const CHAVE_VISTO = 'bussola.conquistas.vistas';
// Logo depois de abrir, os dados ainda estão chegando da nuvem: nesse tempo só anota, sem comemorar.
const ABERTO_EM = Date.now();

export function ligarRecompensas(funcoes) {
  app = funcoes;
}

function abrirFolha(titulo, html) {
  document.getElementById('folha-evento-titulo').textContent = titulo;
  document.getElementById('folha-evento-conteudo').innerHTML = html;
  const folha = document.getElementById('folha-evento');
  if (!folha.open) folha.showModal();
}
const fecharFolha = () => document.getElementById('folha-evento')?.close();
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function mudar(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'recompensas');
  const v = atual?.valor || {};
  const valor = { itens: Array.isArray(v.itens) ? v.itens : RECOMPENSAS_PADRAO.map((r) => ({ ...r })), resgates: Array.isArray(v.resgates) ? v.resgates : [] };
  fn(valor);
  valor.resgates = valor.resgates.slice(-500);
  await salvar('config', { ...(atual || {}), chave: 'recompensas', valor });
  atualizarEstado({ config: await listar('config') });
}

const item = (id) => recompensasDe(obterEstado().config).itens.find((r) => r.id === id);

export function cliqueRecompensas(alvo) {
  const { acao, id } = alvo.dataset;
  if (!acao?.startsWith('rec-')) return false;
  if (acao === 'rec-nova') abrirFolha('Nova recompensa', formRecompensa());
  else if (acao === 'rec-editar') {
    const r = item(id);
    if (r) abrirFolha('Recompensa', formRecompensa(r));
  } else if (acao === 'rec-excluir') {
    mudar((v) => { v.itens = v.itens.filter((r) => r.id !== id); }).then(() => {
      fecharFolha();
      app.renderizar();
    });
  } else if (acao === 'rec-resgatar') {
    const r = item(id);
    const g = situacaoGamificacao(dadosGamificacao(obterEstado()));
    if (r && g.saldo >= r.custo) abrirFolha('Resgatar', formResgate(r, g.saldo));
  } else return false;
  return true;
}

export function enviarRecompensas(form) {
  const tipo = form.dataset.form;
  if (tipo === 'rec-item') {
    const f = new FormData(form);
    const nome = String(f.get('nome') || '').trim();
    const custo = Math.round(Number(f.get('custo')) || 0);
    const caixa = form.querySelector('[data-erro]');
    if (!nome || custo < 10) {
      caixa.textContent = !nome ? 'Escreva a recompensa.' : 'Escolha pelo menos 10 pontos.';
      caixa.hidden = false;
      return true;
    }
    const id = form.dataset.id || `r-${Date.now().toString(36)}`;
    const dados = { id, nome: nome.slice(0, 60), custo, emoji: String(f.get('emoji') || '🎁').trim().slice(0, 4) || '🎁', valor: Number(f.get('valor')) || 0 };
    mudar((v) => {
      const i = v.itens.findIndex((r) => r.id === id);
      if (i >= 0) v.itens[i] = { ...v.itens[i], ...dados };
      else v.itens.push(dados);
    }).then(() => {
      fecharFolha();
      app.renderizar();
    });
    return true;
  }
  if (tipo === 'rec-resgate') {
    const r = item(form.dataset.id);
    const g = situacaoGamificacao(dadosGamificacao(obterEstado()));
    if (!r || g.saldo < r.custo) return true;
    const f = new FormData(form);
    const valor = lerValor(f.get('valor') || '');
    const lancar = f.get('lancar') === 'on' && Number.isFinite(valor) && valor > 0;
    mudar((v) => { v.resgates.push({ id: `g-${Date.now().toString(36)}`, recompensa_id: r.id, nome: r.nome, emoji: r.emoji, pontos: r.custo, data: new Date().toISOString() }); })
      .then(() => (lancar ? gravar('financas', 'financas', { tipo: 'saida', valor, data: hoje(), descricao: r.nome, categoria: 'lazer', pago: true, dados: { recompensa: true } }) : null))
      .then(() => {
        fecharFolha();
        app.renderizar();
        celebrar(r.emoji || '🎁', 'Aproveite!', `${r.nome} resgatado. Você merece.`);
      });
    return true;
  }
  return false;
}

// Depois que os dados mudam: subiu de nível ou ganhou conquista nova? Comemora uma vez.
// Na primeira vez em um aparelho, só anota o que já existe (sem comemorar tudo de uma vez).
export function conferirConquistas() {
  const g = situacaoGamificacao(dadosGamificacao(obterEstado()));
  const feitas = g.conquistas.filter((c) => c.feita).map((c) => c.id);
  let visto = null;
  try {
    visto = JSON.parse(localStorage.getItem(CHAVE_VISTO) || 'null');
  } catch {
    visto = null;
  }
  const guardar = () => {
    try {
      localStorage.setItem(CHAVE_VISTO, JSON.stringify({ nivel: g.nivel.nivel, conquistas: feitas }));
    } catch {
      // sem armazenamento: comemora de novo em outra vez, sem problema
    }
  };
  if (!visto || Date.now() - ABERTO_EM < 15000) {
    guardar();
    return;
  }
  const nova = g.conquistas.find((c) => c.feita && !visto.conquistas.includes(c.id));
  if (g.nivel.nivel > visto.nivel) celebrar('⭐', `Nível ${g.nivel.nivel}!`, `Agora você é ${g.nivel.titulo}. ${g.saldo} pontos para gastar.`);
  else if (nova) celebrar(nova.emoji, `Conquista: ${nova.nome}`, nova.texto);
  if (g.nivel.nivel !== visto.nivel || nova || feitas.length !== visto.conquistas.length) guardar();
}
