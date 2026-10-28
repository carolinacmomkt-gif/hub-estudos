// Backup automático: uma cópia de tudo da usuária (as mesmas tabelas do app) no Storage do
// Supabase, em "{id}/backups/bussola-AAAA-MM-DD.json.gz", no mesmo formato do "Exportar backup".
// Senhas e tokens (credenciais) e as conexões nunca entram. Os arquivos (PDFs, imagens) já
// estão no Storage e não são copiados de novo.

import { gzipSync } from 'node:zlib';
import { banco } from './supabase.mjs';
import { noFuso } from './avisos.mjs';
import { TABELAS, SOMENTE_LEITURA } from '../../js/tabelas.js';
import { PASTA_BACKUP, nomeDoBackup, diaDoBackup, backupsParaApagar } from '../../js/dados-backup.js';

const FUSO = 'America/Sao_Paulo';

export async function listarBackups(userId) {
  const arquivos = await banco.listarArquivos(userId, PASTA_BACKUP);
  return arquivos.filter((a) => diaDoBackup(a.name)).map((a) => ({
    nome: a.name,
    dia: diaDoBackup(a.name),
    tamanho: Number(a.metadata?.size) || null,
    criado_em: a.created_at || a.updated_at || null,
    caminho: `${userId}/${PASTA_BACKUP}/${a.name}`,
  })).sort((a, b) => b.dia.localeCompare(a.dia));
}

// forcar: faz mesmo sem mudança (botão "Fazer uma cópia agora").
export async function fazerBackup(userId, { agora = Date.now(), forcar = false } = {}) {
  const { data: hoje } = noFuso(agora, FUSO);
  const existentes = await listarBackups(userId);
  const tabelas = {};
  let ultimaMudanca = 0;
  let total = 0;
  for (const tabela of TABELAS) {
    if (SOMENTE_LEITURA.has(tabela)) continue;
    let linhas;
    try {
      linhas = await banco.listarTudo(tabela, userId);
    } catch {
      continue; // tabela de uma migração que ainda não rodou: segue sem ela
    }
    tabelas[tabela] = linhas;
    total += linhas.length;
    for (const l of linhas) ultimaMudanca = Math.max(ultimaMudanca, Date.parse(l.atualizado_em) || 0);
  }
  const ultimo = existentes[0];
  // Nada mudou desde a última cópia: não gasta espaço com uma igual.
  if (!forcar && ultimo?.criado_em && ultimaMudanca && ultimaMudanca < Date.parse(ultimo.criado_em)) {
    return { ok: true, feito: false, motivo: 'sem-mudanca', total };
  }
  const conteudo = { app: 'hub-estudos', versao: 1, exportado_em: new Date(agora).toISOString(), automatico: true, tabelas };
  const nome = nomeDoBackup(hoje);
  await banco.subirArquivo(userId, `${userId}/${PASTA_BACKUP}/${nome}`, gzipSync(JSON.stringify(conteudo)), 'application/gzip');
  // Limpa as cópias que sobram (ficam 7 diárias e 1 por semana por 8 semanas).
  const nomes = [...new Set([nome, ...existentes.map((e) => e.nome)])];
  for (const velho of backupsParaApagar(nomes, hoje)) {
    await banco.apagarArquivo(userId, `${userId}/${PASTA_BACKUP}/${velho}`).catch(() => {});
  }
  return { ok: true, feito: true, nome, total };
}
