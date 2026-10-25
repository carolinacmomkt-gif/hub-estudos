// Gravação das telas de Biblioteca, Questões, Substack e Estudos.
// Salva no aparelho (e na fila da nuvem) e já põe a versão nova no estado em memória,
// para a tela redesenhada logo depois não mostrar a cópia antiga.

import { obterEstado, atualizarEstado } from './estado.js';
import { salvar } from './persistencia.js';

export function colocarNaMemoria(chave, linha) {
  const lista = obterEstado()[chave] || [];
  const i = lista.findIndex((x) => x.id === linha.id);
  atualizarEstado({ [chave]: i >= 0 ? lista.map((x, k) => (k === i ? linha : x)) : [...lista, linha] });
}

export async function gravar(tabela, chave, dados) {
  const salvo = await salvar(tabela, dados);
  colocarNaMemoria(chave, salvo);
  return salvo;
}

// Gravador com atraso (para campos de texto): junta as mudanças e salva depois de uma pausa.
// depois(salvo): roda depois de cada gravação (ex.: atualizar o evento do Calendário).
export function criarGravador(tabela, chave, { atraso = 700, depois = null } = {}) {
  const ultimas = new Map();
  let pendentes = new Map(); // id → { base, campos }
  let tempo = null;

  function atual(base) {
    const salva = ultimas.get(base.id);
    return salva && Date.parse(salva.atualizado_em) >= Date.parse(base.atualizado_em || 0) ? salva : base;
  }

  // A versão que vale agora: a última salva com o que ainda está esperando para salvar.
  function vigente(base) {
    return { ...atual(base), ...(pendentes.get(base.id)?.campos || {}) };
  }

  async function agora() {
    clearTimeout(tempo);
    tempo = null;
    const lote = pendentes;
    pendentes = new Map();
    let ultimo = null;
    for (const [, { base, campos }] of lote) {
      ultimo = await salvar(tabela, { ...atual(base), ...campos });
      ultimas.set(ultimo.id, ultimo);
      colocarNaMemoria(chave, ultimo);
      if (depois) await depois(ultimo);
    }
    return ultimo;
  }

  function adiar(base, campos) {
    const p = pendentes.get(base.id);
    pendentes.set(base.id, { base: p?.base || base, campos: { ...(p?.campos || {}), ...campos } });
    clearTimeout(tempo);
    tempo = setTimeout(agora, atraso);
  }

  async function ja(base, campos) {
    adiar(base, campos);
    await agora();
    return ultimas.get(base.id);
  }

  return { adiar, ja, agora, vigente };
}
