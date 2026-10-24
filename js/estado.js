// Estado do app em memória. Na Etapa 2 ele passa a ser preenchido pela persistencia.js.

import { gerarDadosExemplo } from './dados-exemplo.js';

const estado = {
  rota: 'inicio',
  dados: gerarDadosExemplo(),
  usandoExemplo: true,
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
