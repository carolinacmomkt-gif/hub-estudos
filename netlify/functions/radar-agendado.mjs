// Radar do nicho sozinho, de hora em hora (Netlify Scheduled Function): notícias a cada 2 h das
// 7h às 21h (Brasília), a análise com a IA às 6h30 (em segundo plano, pela radar-background) e de
// novo no dia se uma notícia disparar, os avisos no celular e o resumo das 8h.

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

export const config = { schedule: '31 * * * *' };
