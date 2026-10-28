// Backup automático toda madrugada (3h em Brasília), mesmo com o app fechado.
// Se nada mudou desde a última cópia, não faz outra.

import { banco } from '../lib/supabase.mjs';
import { fazerBackup } from '../lib/backup.mjs';

export default async () => {
  for (const userId of await banco.idsDasUsuarias()) {
    try {
      await fazerBackup(userId);
    } catch (falha) {
      console.error('backup-agendado:', falha?.message);
    }
  }
  return new Response('ok');
};

export const config = { schedule: '0 6 * * *' };
