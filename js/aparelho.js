// Quem é este aparelho, para o "Continuar em outro aparelho": um código sorteado na primeira vez
// (fica só neste navegador) e o tipo (celular, tablet ou computador), que dá o nome nas mensagens.

import { aparelhoDoInicio } from './inicio-layout.js';

const CHAVE = 'hub.aparelho-id';
let id = null;

export function idDoAparelho() {
  if (id) return id;
  try {
    id = localStorage.getItem(CHAVE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAVE, id);
    }
  } catch {
    id = id || crypto.randomUUID(); // sem armazenamento: vale enquanto a aba estiver aberta
  }
  return id;
}

export const tipoDoAparelho = () => aparelhoDoInicio();

// "no computador", "no tablet"… e "no outro computador" quando os dois são do mesmo tipo.
export function noAparelho(tipo) {
  const nome = ['celular', 'tablet', 'computador'].includes(tipo) ? tipo : 'aparelho';
  return tipo === tipoDoAparelho() ? `no outro ${nome}` : `no ${nome}`;
}
