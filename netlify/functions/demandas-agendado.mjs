// Lê o Trello e o Notion a cada 2 horas, mesmo com o app fechado (Netlify Scheduled Function).
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

export const config = { schedule: '0 */2 * * *' };
