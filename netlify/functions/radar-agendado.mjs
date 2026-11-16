// Radar do nicho sozinho, só SEGUNDA E QUINTA (Carol, 16/11/2026, para gastar menos crédito da Netlify):
// às 7h31 de Brasília (segunda prepara a semana; quinta pega o urgente do fim de semana) lê as notícias e pede a análise com a IA (em segundo plano, pela
// radar-background), que avisa no celular só as urgentes. Atualizar agora, no app, continua valendo.

import { banco } from '../lib/supabase.mjs';
import { rodarRadarAgendado } from '../lib/radar.mjs';

export default async () => {
  const linhas = await banco.listarTodas('config', 'chave=eq.radar&excluido_em=is.null').catch(() => []);
  for (const userId of [...new Set(linhas.map((l) => l.user_id))]) {
    try {
      await rodarRadarAgendado(userId);
    } catch (falha) {
      console.error('radar-agendado:', falha?.message);
    }
  }
  return new Response('ok');
};

// 10:31 UTC = 7h31 em Brasília, segunda (1) e quinta (4).
export const config = { schedule: '31 10 * * 1,4' };
