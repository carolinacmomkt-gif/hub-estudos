// Lê o Trello e o Notion UMA VEZ POR DIA, às 7h de Brasília (Carol, 16/11/2026, para gastar menos crédito
// da Netlify), mesmo com o app fechado. Com o app aberto, a leitura continua na hora.
// As demandas novas esperam o OK da Carol na caixa do Hoje.

import { banco } from '../lib/supabase.mjs';
import { sincronizarDemandas } from '../lib/demandas.mjs';

export default async () => {
  const credenciais = await banco.listarCredenciais();
  const porUsuaria = new Map();
  for (const { user_id: userId, servico } of credenciais) {
    if (!['trello', 'notion'].includes(servico)) continue;
    porUsuaria.set(userId, [...(porUsuaria.get(userId) || []), servico]);
  }
  for (const [userId, servicos] of porUsuaria) {
    try {
      await sincronizarDemandas(userId, { servicos });
    } catch (falha) {
      console.error('demandas-agendado:', falha?.message);
    }
  }
  return new Response('ok');
};

// 10:00 UTC = 7h em Brasília.
export const config = { schedule: '0 10 * * *' };
