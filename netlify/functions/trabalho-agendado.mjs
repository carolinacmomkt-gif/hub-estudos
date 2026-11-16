// Grupo Trabalho: copia os calendários do Notion e os quadros do Trello às 7h, 12h e 17h dos dias úteis
// em Brasília, mesmo com o app fechado (Netlify Scheduled Function, ~30 s). Vai em partes: o que não
// couber na rodada fica para a próxima (a próxima começa de onde esta parou).

import { banco } from '../lib/supabase.mjs';
import { partesDaSincronizacao, sincronizarParte } from '../lib/trabalho.mjs';

const ORCAMENTO_MS = 22 * 1000;

export default async () => {
  const inicio = Date.now();
  const credenciais = await banco.listarCredenciais();
  for (const { user_id: userId, servico } of credenciais) {
    if (servico !== 'notion_trabalho') continue;
    const conexao = await banco.lerConexao(userId, 'notion_trabalho');
    const partes = await partesDaSincronizacao(userId);
    let i = Number(conexao?.detalhe?.proximaParte) || 0;
    while (Date.now() - inicio < ORCAMENTO_MS) {
      const parte = partes[i % partes.length];
      try {
        await sincronizarParte(userId, parte);
      } catch (falha) {
        console.error('trabalho-agendado:', parte, falha?.message);
      }
      i += 1;
      if (i % partes.length === 0) break; // uma volta inteira por rodada basta
    }
    await banco.salvarConexao(userId, 'notion_trabalho', {
      detalhe: { ...(conexao?.detalhe || {}), proximaParte: i % partes.length },
      ...(i % partes.length === 0 ? { ultima_sincronizacao: new Date().toISOString() } : {}),
    }).catch(() => {});
  }
  return new Response('ok');
};

// De hora em hora, das 10h às 23h UTC (7h às 20h em Brasília).
// 10, 15 e 20 UTC = 7h17, 12h17 e 17h17 em Brasília, de segunda a sexta (Carol, 16/11/2026).
export const config = { schedule: '17 10,15,20 * * 1-5' };
