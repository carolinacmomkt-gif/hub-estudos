// Importar o calendário acadêmico: envia o PDF (ou o texto), pede a leitura para a IA
// (função em segundo plano) e acompanha a linha em importacoes até o resultado chegar.
// O resultado fica em estado.importacao para a Carol revisar; só vira evento ao salvar.

import { obterEstado, atualizarEstado } from './estado.js';
import { rest, enviarArquivo, idDaUsuaria } from './nuvem.js';
import { dispararSegundoPlano } from './funcoes.js';
import { listar, salvar } from './persistencia.js';
import { instanteLocal, chaveValida, origemIdAcademico } from './dados-calendario.js';

const CHAVE_GUARDADA = 'hub.importacao.calendario';
const CHAVE_CURSO = 'hub.importacao.curso';
const INTERVALO_MS = 4000;
const LIMITE_MS = 12 * 60 * 1000;
const MAX_PDF = 20 * 1024 * 1024;
let acompanhando = null;

function guardado(chave, valor) {
  try {
    if (valor === undefined) return localStorage.getItem(chave);
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento
  }
  return null;
}

function mudar(importacao) {
  atualizarEstado({ importacao });
  window.dispatchEvent(new CustomEvent('hub:importacao'));
}

export function cursoGuardado() {
  return guardado(CHAVE_CURSO) || '';
}

// Prepara a lista de revisão: marca o que já existe no calendário (vai ser atualizado).
async function prepararRevisao(id, resultado) {
  const existentes = new Set((await listar('eventos')).filter((e) => e.origem === 'academico').map((e) => e.origem_id));
  const eventos = (resultado?.eventos || []).map((e) => {
    const existe = existentes.has(origemIdAcademico(e));
    return { ...e, existe, selecionado: !existe };
  });
  // Se tudo já existia, deixa marcado: salvar de novo só atualiza.
  if (eventos.length && eventos.every((e) => !e.selecionado)) eventos.forEach((e) => { e.selecionado = true; });
  return { id, status: 'pronto', periodo: resultado?.periodo || '', avisos: resultado?.avisos || '', eventos };
}

async function acompanhar(id) {
  if (acompanhando === id) return;
  acompanhando = id;
  const inicio = Date.now();
  try {
    while (acompanhando === id) {
      let linha = null;
      try {
        [linha] = (await rest(`importacoes?select=id,status,resultado,erro&id=eq.${encodeURIComponent(id)}`)) || [];
      } catch {
        // sem internet por um instante: tenta de novo na próxima volta
      }
      if (acompanhando !== id) return;
      if (linha === undefined) {
        guardado(CHAVE_GUARDADA, null);
        mudar(null);
        return;
      }
      if (linha?.status === 'pronto') {
        mudar(await prepararRevisao(id, linha.resultado));
        return;
      }
      if (linha?.status === 'erro') {
        guardado(CHAVE_GUARDADA, null);
        mudar({ status: 'erro', erro: linha.erro, curso: cursoGuardado() });
        return;
      }
      if (Date.now() - inicio > LIMITE_MS) {
        guardado(CHAVE_GUARDADA, null);
        mudar({ status: 'erro', erro: 'A leitura passou de 12 minutos e foi interrompida. Tente de novo (um PDF menor ajuda).', curso: cursoGuardado() });
        return;
      }
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
  } finally {
    if (acompanhando === id) acompanhando = null;
  }
}

// Ao abrir a tela de importação: se ficou uma leitura em andamento, volta a acompanhar.
export function retomarImportacao() {
  if (obterEstado().importacao) return;
  const id = guardado(CHAVE_GUARDADA);
  if (!id) return;
  atualizarEstado({ importacao: { id, status: 'lendo' } });
  acompanhar(id);
}

export async function iniciarImportacao({ arquivo, texto, curso }) {
  if (arquivo && arquivo.size > MAX_PDF) return 'O PDF passa de 20 MB. Mande só as páginas do semestre.';
  if (arquivo && !/pdf$/i.test(arquivo.type || arquivo.name)) return 'Escolha um arquivo em PDF.';
  if (!arquivo && !texto) return 'Escolha o PDF ou cole o texto do calendário.';
  const usuaria = idDaUsuaria();
  if (!usuaria) return 'Entre no app de novo para continuar.';

  guardado(CHAVE_CURSO, curso || null);
  const id = crypto.randomUUID();
  mudar({ id, status: 'enviando' });
  try {
    let caminho = null;
    if (arquivo) {
      caminho = `${usuaria}/importacoes/${id}.pdf`;
      await enviarArquivo(caminho, arquivo);
    }
    await rest('importacoes', {
      metodo: 'POST',
      corpo: { id, user_id: usuaria, status: 'lendo', arquivo: caminho, texto: arquivo ? null : texto, curso: curso || null },
      prefer: 'return=minimal',
    });
    const r = await dispararSegundoPlano('calendario-ler-background', { id });
    if (!r.ok) throw new Error(r.erro);
  } catch (erro) {
    const semTabela = erro.codigo === 'PGRST205' || (erro.status === 404 && /importacoes|schema cache/i.test(erro.message));
    mudar({ status: 'erro', erro: semTabela ? 'Falta rodar a migração 003-calendario.sql no SQL Editor do Supabase. Depois tente de novo.' : (erro.message || 'Não deu certo agora.'), curso });
    return null;
  }
  guardado(CHAVE_GUARDADA, id);
  mudar({ id, status: 'lendo' });
  acompanhar(id);
  return null;
}

export function mudarItemImportado(indice, campo, valor) {
  const imp = obterEstado().importacao;
  const item = imp?.eventos?.[indice];
  if (!item) return;
  item[campo] = valor;
}

export function marcarTodosImportados(valor) {
  const imp = obterEstado().importacao;
  imp?.eventos?.forEach((e) => { e.selecionado = valor; });
  mudar(imp);
}

export async function descartarImportacao() {
  const imp = obterEstado().importacao;
  acompanhando = null;
  guardado(CHAVE_GUARDADA, null);
  mudar(null);
  if (imp?.id) await rest(`importacoes?id=eq.${encodeURIComponent(imp.id)}`, { metodo: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
}

// Cria (ou atualiza) os eventos marcados. Devolve { salvos, primeiro } ou { erro }.
export async function salvarImportacao() {
  const imp = obterEstado().importacao;
  const marcados = (imp?.eventos || []).filter((e) => e.selecionado);
  const invalido = marcados.find((e) => !String(e.titulo).trim() || !chaveValida(e.inicio) || (e.fim && (!chaveValida(e.fim) || e.fim < e.inicio)));
  if (invalido) return { erro: `Confira a data ou o título de "${invalido.titulo || 'sem título'}".` };

  const existentes = new Map((await listar('eventos', { incluirExcluidos: true }))
    .filter((e) => e.origem === 'academico').map((e) => [e.origem_id, e]));
  for (const item of marcados) {
    const origemId = origemIdAcademico(item);
    const atual = existentes.get(origemId);
    await salvar('eventos', {
      ...(atual || {}),
      tipo: item.tipo,
      titulo: String(item.titulo).trim().slice(0, 140),
      descricao: item.observacao || null,
      inicio: instanteLocal(item.inicio),
      fim: item.fim && item.fim > item.inicio ? instanteLocal(item.fim) : null,
      dia_inteiro: true,
      status: null,
      origem: 'academico',
      origem_id: origemId,
      disciplina_id: atual?.disciplina_id ?? null,
      excluido_em: null,
    });
  }
  const primeiro = marcados.map((e) => e.inicio).sort()[0] || null;
  await descartarImportacao();
  return { salvos: marcados.length, primeiro };
}
