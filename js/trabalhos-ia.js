// Trabalhos longos da IA (gerar questões, ler o PDF de um artigo), feitos em segundo plano
// pela função ia-background. O pedido vira uma linha em importacoes; o app acompanha a linha
// até ficar pronta. Dá para sair da tela: o trabalho continua e o resultado fica guardado.

import { obterEstado, atualizarEstado } from './estado.js';
import { rest, enviarArquivo, idDaUsuaria } from './nuvem.js';
import { dispararSegundoPlano } from './funcoes.js';

const CHAVE = 'hub.trabalhos-ia';
const INTERVALO_MS = 4000;
const LIMITE_MS = 14 * 60 * 1000;
const acompanhando = new Set();

function guardados() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}');
  } catch {
    return {};
  }
}

function guardar(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // vale só nesta sessão
  }
}

export function trabalho(id) {
  const t = (obterEstado().trabalhos || {})[id];
  return t ? { id, ...t } : null;
}

function mudar(id, campos) {
  const todos = { ...(obterEstado().trabalhos || {}) };
  todos[id] = { ...(todos[id] || {}), ...campos };
  atualizarEstado({ trabalhos: todos });
  window.dispatchEvent(new CustomEvent('hub:trabalho', { detail: { id, ...todos[id] } }));
}

// tipo: 'questoes' | 'artigo'. pedido: objeto (vai como JSON). arquivo: Blob opcional (imagem ou PDF).
// caminho: arquivo que já está no Storage (ex.: o PDF salvo na Biblioteca).
export async function iniciarTrabalho({ tipo, pedido = {}, arquivo = null, caminho = null, extensao = 'bin', rotulo = '', ligado = null }) {
  const usuaria = idDaUsuaria();
  if (!usuaria) throw new Error('Entre no app para usar a IA.');
  if (!navigator.onLine) throw new Error('Sem internet agora. A IA precisa de conexão.');
  const id = crypto.randomUUID();
  mudar(id, { tipo, status: 'enviando', rotulo, ligado });
  try {
    let arquivoNoStorage = caminho;
    if (arquivo) {
      arquivoNoStorage = `${usuaria}/ia/${id}.${extensao}`;
      await enviarArquivo(arquivoNoStorage, arquivo);
    }
    await rest('importacoes', {
      metodo: 'POST',
      corpo: { id, user_id: usuaria, tipo, status: 'lendo', arquivo: arquivoNoStorage, texto: JSON.stringify(pedido) },
      prefer: 'return=minimal',
    });
    const r = await dispararSegundoPlano('ia-background', { id });
    if (!r.ok) throw new Error(r.erro);
  } catch (erro) {
    const semTabela = erro.codigo === 'PGRST205' || erro.codigo === '23514';
    const mensagem = semTabela ? 'Falta rodar as migrações 003 e 007 no SQL Editor do Supabase.' : (erro.message || 'Não deu certo agora.');
    mudar(id, { status: 'erro', erro: mensagem });
    throw new Error(mensagem);
  }
  guardar({ ...guardados(), [id]: { tipo, rotulo, ligado } });
  mudar(id, { status: 'lendo' });
  acompanhar(id);
  return id;
}

async function acompanhar(id) {
  if (acompanhando.has(id)) return;
  acompanhando.add(id);
  const inicio = Date.now();
  try {
    for (;;) {
      let linha;
      try {
        [linha] = (await rest(`importacoes?select=id,status,resultado,erro&id=eq.${encodeURIComponent(id)}`)) || [];
      } catch {
        linha = null; // sem internet por um instante: tenta de novo
      }
      if (linha === undefined) {
        mudar(id, { status: 'erro', erro: 'O pedido não foi encontrado. Tente de novo.' });
        break;
      }
      if (linha?.status === 'pronto') {
        mudar(id, { status: 'pronto', resultado: linha.resultado });
        break;
      }
      if (linha?.status === 'erro') {
        mudar(id, { status: 'erro', erro: linha.erro });
        break;
      }
      if (Date.now() - inicio > LIMITE_MS) {
        mudar(id, { status: 'erro', erro: 'A IA passou de 14 minutos e o pedido foi interrompido. Tente de novo com menos itens.' });
        break;
      }
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
  } finally {
    acompanhando.delete(id);
  }
}

// Ao abrir o app: volta a acompanhar o que ficou em andamento.
export function retomarTrabalhos() {
  for (const [id, info] of Object.entries(guardados())) {
    if (trabalho(id)) continue;
    mudar(id, { ...info, status: 'lendo' });
    acompanhar(id);
  }
}

// Depois de usar o resultado: apaga o pedido (da nuvem e do aparelho).
export async function encerrarTrabalho(id) {
  const lista = guardados();
  delete lista[id];
  guardar(lista);
  const todos = { ...(obterEstado().trabalhos || {}) };
  delete todos[id];
  atualizarEstado({ trabalhos: todos });
  await rest(`importacoes?id=eq.${encodeURIComponent(id)}`, { metodo: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
}

export function trabalhosDoTipo(tipo) {
  return Object.entries(obterEstado().trabalhos || {}).filter(([, t]) => t.tipo === tipo).map(([id, t]) => ({ id, ...t }));
}
