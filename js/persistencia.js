// Dados no aparelho (IndexedDB) + sincronização com o Supabase.
//
// - Tudo é salvo primeiro no aparelho: o app abre rápido e funciona sem internet.
// - Cada mudança entra numa fila; quando há internet e login, a fila sobe para o Supabase.
// - Depois o app baixa o que mudou no Supabase (pelo atualizado_em, que o banco preenche).
// - Conflito entre aparelhos: vale a última mudança enviada.
// - Excluir = marcar excluido_em (some das listas, mas dá para recuperar).

import { rest, sessaoAtual, nuvemConfigurada, ErroNuvem } from './nuvem.js';

const NOME_BANCO = 'hub-estudos';
// Aumente sempre que TABELAS ganhar uma tabela nova (o aparelho só cria lojas novas numa versão nova).
// Se mesmo assim faltar alguma, abrir() sobe a versão sozinho.
const VERSAO_BANCO = 5;
const LOTE = 500;

export const TABELAS = [
  'areas', 'disciplinas', 'materiais', 'eventos', 'notas_ava', 'notas_lyceum', 'frequencias',
  'avisos', 'artigos', 'pastas', 'cadernos', 'secoes', 'paginas', 'questoes', 'respostas',
  'revisoes', 'pautas_substack', 'caixa_entrada', 'config', 'conexoes', 'videos', 'simulados', 'sessoes_foco',
  'projetos', 'tarefas', 'habitos', 'habito_registros', 'diario', 'saude', 'clientes', 'consultoria', 'financas', 'casa', 'metas', 'lazer',
];
const SOMENTE_LEITURA = new Set(['conexoes']); // quem escreve são as funções da Netlify
// config tem uma linha por chave ("inicio", "avisos"…). Dois aparelhos podem criar a mesma chave
// antes de se verem: o envio junta pela chave em vez de dar erro de duplicidade.
const CHAVE_DE_CONFLITO = { config: 'user_id,chave' };

// Tabelas e tipos que dependem de uma migração (supabase/migracoes). Se a migração ainda não
// foi rodada, só aquela tabela espera; as outras continuam sincronizando normalmente.
const MIGRACAO_DA_TABELA = { videos: '005-youtube.sql (e depois a 006-youtube-completo.sql)', simulados: '007-areas.sql', sessoes_foco: '008-foco.sql',
  ...Object.fromEntries(['projetos', 'tarefas', 'habitos', 'habito_registros', 'diario', 'saude', 'clientes', 'consultoria', 'financas', 'casa', 'metas', 'lazer'].map((t) => [t, '009-vida.sql'])),
};
const tabelaNaoExiste = (erro) => erro instanceof ErroNuvem && (erro.codigo === 'PGRST205' || erro.codigo === '42P01' || erro.status === 404);
// Tipo novo recusado pela regra do banco (23514) ou coluna nova que não existe (PGRST204/42703):
// sinal de migração que falta rodar.
const faltaMigracao = (erro) => erro instanceof ErroNuvem && ['23514', 'PGRST204', '42703'].includes(erro.codigo);
// Qualquer outra recusa do banco para os dados (não é falta de internet nem de login).
const recusaDeDados = (erro) => erro instanceof ErroNuvem && erro.status >= 400 && erro.status < 500 && erro.status !== 401 && erro.status !== 403;

// { tipo: 'aviso' | 'erro', texto } ou null (erro que deve parar a sincronização inteira).
function explicar(tabela, erro) {
  if (tabelaNaoExiste(erro)) {
    const migracao = MIGRACAO_DA_TABELA[tabela];
    return { tipo: 'aviso', texto: `A tabela "${tabela}" ainda não existe no Supabase.${migracao ? ` Rode a migração ${migracao} no SQL Editor.` : ' Rode as migrações em supabase/migracoes.'}` };
  }
  if (faltaMigracao(erro)) {
    return { tipo: 'aviso', texto: `O Supabase ainda não aceita alguns dados de "${tabela}" (${erro.detalhe || erro.message}). Rode no SQL Editor as migrações que faltam em supabase/migracoes, na ordem.` };
  }
  if (recusaDeDados(erro)) {
    return { tipo: 'erro', texto: `O Supabase recusou um registro de "${tabela}": ${erro.detalhe || erro.message}` };
  }
  return null;
}

let problemas = new Map(); // tabela → { tipo, texto } (da última sincronização)

let bancoAberto = null;
let sincronizando = null;
let deNovo = false; // algo mudou durante a sincronização: rodar mais uma vez no fim
let temporizador = null;
const situacao = { estado: 'ocioso', ultima: lerUltima(), erro: null, pendentes: 0 };

function lerUltima() {
  try {
    return localStorage.getItem('hub.sinc.ultima');
  } catch {
    return null;
  }
}

const LOJAS = [...TABELAS, 'fila', 'meta'];

function abrirVersao(versao) {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(NOME_BANCO, versao);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      for (const tabela of TABELAS) {
        if (!db.objectStoreNames.contains(tabela)) db.createObjectStore(tabela, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'chave' });
    };
    pedido.onsuccess = () => {
      const db = pedido.result;
      // Outra aba (ou o app atualizado) precisa subir a versão: esta aba solta o banco.
      db.onversionchange = () => {
        db.close();
        bancoAberto = null;
      };
      resolver(db);
    };
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

function abrir() {
  if (!bancoAberto) {
    bancoAberto = (async () => {
      let db = await abrirVersao(VERSAO_BANCO).catch(async (erro) => {
        // O aparelho já tem uma versão maior (ex.: subida automática abaixo): abre a que existe.
        if (erro?.name !== 'VersionError') throw erro;
        return abrirVersao(undefined);
      });
      if (LOJAS.some((l) => !db.objectStoreNames.contains(l))) {
        const versao = db.version + 1;
        db.close();
        db = await abrirVersao(versao);
      }
      return db;
    })();
    bancoAberto.catch(() => {
      bancoAberto = null;
    });
  }
  return bancoAberto;
}

// Executa uma função dentro de uma transação e espera ela terminar.
async function transacao(lojas, modo, fn) {
  const db = await abrir();
  return new Promise((resolver, rejeitar) => {
    const tx = db.transaction(lojas, modo);
    let resultado;
    Promise.resolve(fn(tx)).then((r) => {
      resultado = r;
    }, rejeitar);
    tx.oncomplete = () => resolver(resultado);
    tx.onerror = () => rejeitar(tx.error);
    tx.onabort = () => rejeitar(tx.error);
  });
}

const comoPromessa = (pedido) => new Promise((resolver, rejeitar) => {
  pedido.onsuccess = () => resolver(pedido.result);
  pedido.onerror = () => rejeitar(pedido.error);
});

function avisar(tipo, detalhe) {
  window.dispatchEvent(new CustomEvent(tipo, { detail: detalhe }));
}

function mudarSituacao(campos) {
  Object.assign(situacao, campos);
  avisar('hub:sincronizacao', { ...situacao });
}

export function situacaoSincronizacao() {
  return { ...situacao, online: navigator.onLine, nuvem: nuvemConfigurada(), logada: Boolean(sessaoAtual()) };
}

// ---------------------------------------------------------------------------
// Leitura e escrita locais
// ---------------------------------------------------------------------------

export async function listar(tabela, { incluirExcluidos = false } = {}) {
  const todos = await transacao([tabela], 'readonly', (tx) => comoPromessa(tx.objectStore(tabela).getAll()));
  return incluirExcluidos ? todos : todos.filter((r) => !r.excluido_em);
}

export async function obter(tabela, id) {
  return transacao([tabela], 'readonly', (tx) => comoPromessa(tx.objectStore(tabela).get(id)));
}

export async function salvar(tabela, dados) {
  if (SOMENTE_LEITURA.has(tabela)) throw new Error(`${tabela} é somente leitura no app.`);
  const agora = new Date().toISOString();
  const registro = { ...dados, id: dados.id || crypto.randomUUID(), criado_em: dados.criado_em || agora, atualizado_em: agora };
  await transacao([tabela, 'fila'], 'readwrite', (tx) => {
    tx.objectStore(tabela).put(registro);
    tx.objectStore('fila').add({ tabela, id: registro.id });
  });
  avisar('hub:dados', { tabela });
  await contarPendentes();
  agendarSincronizacao(1500);
  return registro;
}

export async function excluir(tabela, id) {
  const registro = await obter(tabela, id);
  if (!registro) return null;
  return salvar(tabela, { ...registro, excluido_em: new Date().toISOString() });
}

async function contarPendentes() {
  const total = await transacao(['fila'], 'readonly', (tx) => comoPromessa(tx.objectStore('fila').count()));
  mudarSituacao({ pendentes: total });
  return total;
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

// Apaga de vez (aparelho e nuvem), para o que já está na lixeira. Na nuvem precisa de internet;
// o que estava esperando na fila para estes registros sai junto.
export async function apagarDeVez(tabela, ids) {
  if (!ids.length) return;
  if (nuvemConfigurada() && sessaoAtual()) {
    for (let i = 0; i < ids.length; i += 100) {
      await rest(`${tabela}?id=in.(${ids.slice(i, i + 100).map(encodeURIComponent).join(',')})`, { metodo: 'DELETE', prefer: 'return=minimal' });
    }
  }
  const alvo = new Set(ids);
  await transacao([tabela, 'fila'], 'readwrite', async (tx) => {
    for (const id of ids) tx.objectStore(tabela).delete(id);
    const fila = await comoPromessa(tx.objectStore('fila').getAll());
    for (const f of fila) if (f.tabela === tabela && alvo.has(f.id)) tx.objectStore('fila').delete(f.seq);
  });
  avisar('hub:dados', { tabela });
  await contarPendentes();
}

export function agendarSincronizacao(atraso = 0) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    sincronizar().catch(() => {});
  }, atraso);
}

// Agrupa registros com as mesmas colunas (o envio em lote do Supabase exige isso).
function agruparPorColunas(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const chave = Object.keys(r).sort().join(',');
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(r);
  }
  return [...grupos.values()];
}

async function enviarFila() {
  const fila = await transacao(['fila'], 'readonly', (tx) => comoPromessa(tx.objectStore('fila').getAll()));
  if (!fila.length) return;

  const porTabela = new Map();
  for (const item of fila) {
    if (!porTabela.has(item.tabela)) porTabela.set(item.tabela, new Map());
    porTabela.get(item.tabela).set(item.id, item.seq); // guarda o último seq de cada registro
  }

  for (const [tabela, ids] of porTabela) {
    try {
      await enviarTabela(tabela, ids);
    } catch (erro) {
      // Problema de estrutura do banco: esta tabela espera na fila; as outras seguem.
      const explicacao = explicar(tabela, erro);
      if (!explicacao) throw erro;
      problemas.set(`envio:${tabela}`, explicacao);
    }
  }
}

async function enviarTabela(tabela, ids) {
  {
    const registros = (await Promise.all([...ids.keys()].map((id) => obter(tabela, id)))).filter(Boolean);
    // user_id é preenchido pelo banco (auth.uid()); atualizado_em também.
    const corpo = registros.map(({ user_id: _u, atualizado_em: _a, ...resto }) => resto);

    const devolvidos = [];
    const enviarLote = (lote) => rest(`${tabela}?on_conflict=${CHAVE_DE_CONFLITO[tabela] || 'id'}`, {
      metodo: 'POST',
      corpo: lote,
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    let primeiraRecusa = null;
    for (const grupo of agruparPorColunas(corpo)) {
      for (let i = 0; i < grupo.length; i += LOTE) {
        const lote = grupo.slice(i, i + LOTE);
        try {
          devolvidos.push(...((await enviarLote(lote)) || []));
        } catch (erro) {
          if (!explicar(tabela, erro) || tabelaNaoExiste(erro)) throw erro;
          // Um registro recusado não segura os outros: manda um por um e só o recusado espera.
          for (const linha of lote) {
            try {
              devolvidos.push(...((await enviarLote([linha])) || []));
            } catch (erroDaLinha) {
              if (!explicar(tabela, erroDaLinha)) throw erroDaLinha;
              primeiraRecusa ??= erroDaLinha;
            }
          }
        }
      }
    }

    // Grava a versão do servidor e tira da fila só o que não mudou de novo nesse meio-tempo.
    await transacao([tabela, 'fila'], 'readwrite', async (tx) => {
      const loja = tx.objectStore('fila');
      const atuais = await comoPromessa(loja.getAll());
      for (const linha of devolvidos) {
        const ultimoSeq = ids.get(linha.id);
        const mudouDepois = atuais.some((f) => f.tabela === tabela && f.id === linha.id && f.seq > ultimoSeq);
        if (!mudouDepois) tx.objectStore(tabela).put(linha);
      }
      const enviados = new Set(devolvidos.map((l) => l.id));
      for (const f of atuais) {
        if (f.tabela === tabela && enviados.has(f.id) && f.seq <= ids.get(f.id)) loja.delete(f.seq);
      }
    });
    avisar('hub:dados', { tabela, daNuvem: true });
    if (primeiraRecusa) throw primeiraRecusa;
  }
}

async function receberMudancas() {
  for (const tabela of TABELAS) {
    try {
      await receberTabela(tabela);
    } catch (erro) {
      const explicacao = explicar(tabela, erro);
      if (!explicacao) throw erro;
      problemas.set(`recebimento:${tabela}`, explicacao);
    }
  }
}

async function receberTabela(tabela) {
  {
    const meta = await transacao(['meta'], 'readonly', (tx) => comoPromessa(tx.objectStore('meta').get(`cursor:${tabela}`)));
    let cursor = meta?.valor || '1970-01-01T00:00:00Z';
    let mudou = false;

    for (;;) {
      const linhas = await rest(
        `${tabela}?select=*&atualizado_em=gte.${encodeURIComponent(cursor)}&order=atualizado_em.asc,id.asc&limit=${LOTE}`,
      );
      if (!linhas?.length) break;
      // A fila é lida na mesma transação da gravação: uma mudança feita no aparelho enquanto
      // a sincronização baixava (ex.: um traço novo no caderno) nunca é sobrescrita pela versão antiga.
      await transacao([tabela, 'fila'], 'readwrite', async (tx) => {
        const fila = await comoPromessa(tx.objectStore('fila').getAll());
        const pendentes = new Set(fila.filter((f) => f.tabela === tabela).map((f) => f.id));
        const loja = tx.objectStore(tabela);
        for (const linha of linhas) {
          if (pendentes.has(linha.id)) continue;
          // O cursor é "maior ou igual": a última linha sempre volta. Só conta como mudança se for nova.
          const guardada = await comoPromessa(loja.get(linha.id));
          if (guardada?.atualizado_em === linha.atualizado_em && Boolean(guardada?.excluido_em) === Boolean(linha.excluido_em)) continue;
          loja.put(linha);
          mudou = true;
        }
        // Uma chave de config só pode ter uma linha: a que veio da nuvem substitui as cópias locais.
        if (tabela === 'config') {
          const loja = tx.objectStore('config');
          const locais = await comoPromessa(loja.getAll());
          for (const linha of linhas) {
            for (const l of locais) {
              if (l.chave === linha.chave && l.id !== linha.id && !pendentes.has(l.id)) loja.delete(l.id);
            }
          }
        }
      });
      const novoCursor = linhas[linhas.length - 1].atualizado_em;
      if (linhas.length < LOTE || novoCursor === cursor) {
        cursor = novoCursor;
        break;
      }
      cursor = novoCursor;
    }

    await transacao(['meta'], 'readwrite', (tx) => tx.objectStore('meta').put({ chave: `cursor:${tabela}`, valor: cursor }));
    if (mudou) avisar('hub:dados', { tabela, daNuvem: true });
  }
}

export async function sincronizar() {
  if (!nuvemConfigurada() || !sessaoAtual()) {
    mudarSituacao({ estado: 'local' });
    return situacaoSincronizacao();
  }
  if (!navigator.onLine) {
    mudarSituacao({ estado: 'offline' });
    return situacaoSincronizacao();
  }
  if (sincronizando) {
    deNovo = true;
    return sincronizando;
  }

  sincronizando = (async () => {
    mudarSituacao({ estado: 'sincronizando', erro: null });
    problemas = new Map();
    try {
      await enviarFila();
      await receberMudancas();
      const ultima = new Date().toISOString();
      try {
        localStorage.setItem('hub.sinc.ultima', ultima);
      } catch {
        // sem armazenamento
      }
      await contarPendentes();
      // Sincronizou, mas alguma tabela ficou esperando uma migração: avisa qual.
      const lista = [...problemas.values()];
      const textos = [...new Set(lista.map((p) => p.texto))];
      const estado = lista.some((p) => p.tipo === 'erro') ? 'erro' : (lista.length ? 'aviso' : 'ok');
      mudarSituacao({ estado, ultima, erro: textos.length ? textos.join(' ') : null });
    } catch (erro) {
      const offline = erro instanceof ErroNuvem && erro.codigo === 'rede';
      mudarSituacao({ estado: offline ? 'offline' : 'erro', erro: erro.message });
    } finally {
      sincronizando = null;
      if (deNovo) {
        deNovo = false;
        agendarSincronizacao(0);
      }
    }
    return situacaoSincronizacao();
  })();
  return sincronizando;
}

export function iniciarSincronizacaoAutomatica() {
  window.addEventListener('online', () => agendarSincronizacao(500));
  window.addEventListener('offline', () => mudarSituacao({ estado: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) agendarSincronizacao(500);
  });
  setInterval(() => {
    if (!document.hidden) agendarSincronizacao(0);
  }, 5 * 60 * 1000);
  contarPendentes().catch(() => {});
  agendarSincronizacao(0);
}

// ---------------------------------------------------------------------------
// Backup (como na Central): exportar e importar tudo em um arquivo .json
// ---------------------------------------------------------------------------

export async function exportarBackup() {
  const tabelas = {};
  for (const tabela of TABELAS) {
    if (!SOMENTE_LEITURA.has(tabela)) tabelas[tabela] = await listar(tabela, { incluirExcluidos: true });
  }
  const conteudo = { app: 'hub-estudos', versao: 1, exportado_em: new Date().toISOString(), tabelas };
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `hub-estudos-backup-${conteudo.exportado_em.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  return Object.values(tabelas).reduce((soma, linhas) => soma + linhas.length, 0);
}

export async function importarBackup(arquivo) {
  let conteudo;
  try {
    conteudo = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('Esse arquivo não é um backup válido.');
  }
  if (conteudo?.app !== 'hub-estudos' || typeof conteudo.tabelas !== 'object') {
    throw new Error('Esse arquivo não é um backup da Bússola.');
  }

  let total = 0;
  for (const tabela of TABELAS) {
    const linhas = conteudo.tabelas[tabela];
    if (SOMENTE_LEITURA.has(tabela) || !Array.isArray(linhas)) continue;
    const validas = linhas.filter((l) => l && typeof l === 'object' && typeof l.id === 'string');
    if (!validas.length) continue;
    await transacao([tabela, 'fila'], 'readwrite', (tx) => {
      for (const { user_id: _u, ...linha } of validas) {
        tx.objectStore(tabela).put(linha);
        tx.objectStore('fila').add({ tabela, id: linha.id });
      }
    });
    total += validas.length;
    avisar('hub:dados', { tabela });
  }
  await contarPendentes();
  agendarSincronizacao(500);
  return total;
}

// Ao sair da conta: apaga os dados do aparelho (ficam a salvo no Supabase).
export async function apagarDadosLocais() {
  const db = await abrir();
  db.close();
  bancoAberto = null;
  await new Promise((resolver) => {
    const pedido = indexedDB.deleteDatabase(NOME_BANCO);
    pedido.onsuccess = pedido.onerror = pedido.onblocked = () => resolver();
  });
  try {
    localStorage.removeItem('hub.sinc.ultima');
  } catch {
    // sem armazenamento
  }
  mudarSituacao({ pendentes: 0, ultima: null, estado: 'local' });
}
