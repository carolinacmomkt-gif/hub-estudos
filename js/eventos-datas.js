// Configurações → Calendário: liga e desliga as datas especiais (config "datas_especiais").

import { atualizarEstado } from './estado.js';
import { listar, salvar } from './persistencia.js';
import { PREFS_PADRAO } from './datas-especiais.js';

let fila = Promise.resolve();
function gravar(campos) {
  fila = fila.then(async () => {
    const linha = (await listar('config', { incluirExcluidos: true })).find((c) => c.chave === 'datas_especiais');
    await salvar('config', { ...(linha || {}), excluido_em: null, chave: 'datas_especiais', valor: { ...PREFS_PADRAO, ...(linha?.valor || {}), ...campos } });
    atualizarEstado({ config: await listar('config') });
  }).catch(() => {});
  return fila;
}

// Busca das Configurações: esconde as seções que não batem (sem redesenhar a tela).
function buscarConfig(texto) {
  const q = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let algum = false;
  for (const li of document.querySelectorAll('[data-cfg-secao]')) {
    const bate = !q || q.split(/\s+/).every((p) => li.dataset.palavras.includes(p));
    li.hidden = !bate;
    algum ||= bate;
  }
  const nada = document.querySelector('.cfg-nada');
  if (nada) nada.hidden = algum;
}

export function mudancaDatas(alvo, tipo) {
  const acao = alvo.dataset?.acaoMudar;
  if (acao === 'cfg-busca') { buscarConfig(alvo.value); return true; }
  if (acao !== 'datas-pref' && acao !== 'datas-antecedencia') return false;
  if (tipo !== 'change') return true; // só o "change" grava (o "input" do mesmo toque gravaria de novo)
  if (acao === 'datas-pref') gravar({ [alvo.value]: alvo.checked });
  else gravar({ antecedencia: Math.min(60, Math.max(1, Number(alvo.value) || 15)) });
  return true;
}
