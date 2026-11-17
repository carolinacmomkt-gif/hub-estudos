// Cor de destaque (Configurações → Geral → Aparência): aplica na hora, guarda no aparelho para a
// próxima abertura já vir colorida (tema-inicial.js) e em config "aparencia" para valer nos outros
// aparelhos. A conta das cores fica em dados-destaque.js.

import { cssDoDestaque, destaqueEscolhido } from './dados-destaque.js';
import { listar, salvar } from './persistencia.js';

const CHAVE = 'hub.destaque';
const CHAVE_CSS = 'hub.destaque.css';

export function destaqueAtual() {
  try {
    return destaqueEscolhido(localStorage.getItem(CHAVE)) || null;
  } catch {
    return null;
  }
}

function aplicar(cor) {
  const css = cor ? cssDoDestaque(cor) : '';
  let estilo = document.getElementById('estilo-destaque');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'estilo-destaque';
    document.head.appendChild(estilo);
  }
  estilo.textContent = css;
  try {
    if (cor) {
      localStorage.setItem(CHAVE, cor);
      localStorage.setItem(CHAVE_CSS, css);
    } else {
      localStorage.removeItem(CHAVE);
      localStorage.removeItem(CHAVE_CSS);
    }
  } catch { /* sem armazenamento: vale só nesta sessão */ }
}

export async function definirDestaque(valor) {
  const cor = destaqueEscolhido(valor);
  aplicar(cor);
  const atual = (await listar('config')).find((c) => c.chave === 'aparencia' && !c.excluido_em);
  await salvar('config', { ...(atual || {}), chave: 'aparencia', valor: { ...(atual?.valor || {}), destaque: cor } });
}

// Chamada a cada redesenho: se outro aparelho mudou a cor, aplica aqui também.
export function acompanharDestaque(config) {
  const linha = (config || []).find((c) => c.chave === 'aparencia' && !c.excluido_em);
  if (!linha) return;
  const cor = destaqueEscolhido(linha.valor?.destaque);
  if (cor !== destaqueAtual()) aplicar(cor);
}
