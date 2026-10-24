// Sincronização da faculdade pelo app: ao abrir (se faz mais de 1h) e no "Sincronizar agora".
// Ordem: Lyceum primeiro (traz os nomes oficiais das disciplinas), depois o AVA em partes
// (geral + até 3 disciplinas por vez), e no fim baixa tudo para o aparelho.

import { sincronizarServico } from './funcoes.js';
import { sincronizar as sincronizarDados, listar } from './persistencia.js';

const UMA_HORA = 60 * 60 * 1000;
let emAndamento = null;
const situacao = { estado: 'ocioso', passo: '', erros: [] };

function avisar(campos) {
  Object.assign(situacao, campos);
  window.dispatchEvent(new CustomEvent('hub:faculdade', { detail: { ...situacao } }));
}

export function situacaoFaculdade() {
  return { ...situacao };
}

function precisa(conexao, forcar) {
  if (conexao?.status !== 'conectado') return false;
  if (forcar || !conexao.ultima_sincronizacao) return true;
  return Date.now() - new Date(conexao.ultima_sincronizacao).getTime() > UMA_HORA;
}

export function sincronizarFaculdade({ forcar = false } = {}) {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    if (!navigator.onLine) return situacaoFaculdade();
    const conexoes = await listar('conexoes');
    const lyceum = conexoes.find((c) => c.servico === 'lyceum');
    const ava = conexoes.find((c) => c.servico === 'ava');
    const fazerLyceum = precisa(lyceum, forcar);
    const fazerAva = precisa(ava, forcar);
    if (!fazerLyceum && !fazerAva) return situacaoFaculdade();

    const erros = [];
    try {
      if (fazerLyceum) {
        avisar({ estado: 'sincronizando', passo: 'Lendo o Lyceum…', erros: [] });
        const r = await sincronizarServico({ servico: 'lyceum' });
        if (!r.ok) erros.push(r.erro);
      }
      if (fazerAva) {
        avisar({ estado: 'sincronizando', passo: 'Lendo o AVA…', erros });
        const geral = await sincronizarServico({ servico: 'ava', parte: 'geral' });
        if (!geral.ok) {
          erros.push(geral.erro);
        } else {
          const cursos = geral.cursos || [];
          for (let i = 0; i < cursos.length; i += 3) {
            avisar({ passo: `Materiais e notas do AVA (${Math.min(i + 3, cursos.length)} de ${cursos.length})…` });
            const parte = await sincronizarServico({ servico: 'ava', parte: 'cursos', cursos: cursos.slice(i, i + 3) });
            if (!parte.ok) {
              erros.push(parte.erro);
              break;
            }
          }
        }
      }
      avisar({ passo: 'Trazendo para o aparelho…' });
      await sincronizarDados();
      avisar({ estado: erros.length ? 'erro' : 'ok', passo: '', erros, ultima: new Date().toISOString() });
    } catch (erro) {
      avisar({ estado: 'erro', passo: '', erros: [...erros, erro.message] });
    }
    return situacaoFaculdade();
  })().finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}
