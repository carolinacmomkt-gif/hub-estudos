// Backup na nuvem a pedido do app: { acao: 'listar' } ou { acao: 'criar' } ("Fazer uma cópia agora").
// Baixar e restaurar acontecem no app (o arquivo fica na pasta dela no Storage).

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { listarBackups, fazerBackup } from '../lib/backup.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;
  const entrada = (await lerCorpo(req)) || {};
  try {
    if (entrada.acao === 'listar') return resposta(200, { ok: true, copias: await listarBackups(usuaria.id) });
    if (entrada.acao === 'criar') {
      const r = await fazerBackup(usuaria.id, { forcar: true });
      return resposta(200, { ...r, copias: await listarBackups(usuaria.id) });
    }
    return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
  } catch (falha) {
    console.error('backup:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não consegui mexer nas cópias agora. Tente de novo em instantes.' });
  }
};
