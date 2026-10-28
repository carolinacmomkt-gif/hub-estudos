// Estado do app em memória. Os dados reais vêm da persistencia.js (aparelho + Supabase).

import { gerarDadosExemplo } from './dados-exemplo.js';

const estado = {
  rota: 'inicio',
  dados: gerarDadosExemplo(), // até a Etapa 4 trazer os dados reais da faculdade
  usandoExemplo: true,
  caixa: [],
  demandas: [], // Caixa de demandas (Trello, Notion e mensagens compartilhadas) // caixa de entrada (dados reais, do aparelho/Supabase)
  conexoes: [], // situação do AVA e do Lyceum
  sinc: {}, // situação da sincronização
  email: null,
};

const ouvintes = new Set();

export function obterEstado() {
  return estado;
}

export function atualizarEstado(parcial) {
  Object.assign(estado, parcial);
  ouvintes.forEach((ouvinte) => ouvinte(estado));
}

export function aoMudarEstado(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
