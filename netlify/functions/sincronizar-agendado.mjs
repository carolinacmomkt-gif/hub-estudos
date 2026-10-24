// Sincronização automática a cada 6h, mesmo com o app fechado (Netlify Scheduled Function).
// Uma função agendada tem cerca de 30 s: o AVA vai em partes e para quando o tempo acaba;
// o que faltar entra na próxima rodada (ou quando a Carol abrir o app).

import { banco } from '../lib/supabase.mjs';
import { sincronizarAva, sincronizarLyceumDaUsuaria } from '../lib/sincronizacao.mjs';

const ORCAMENTO_MS = 24 * 1000;

export default async () => {
  const inicio = Date.now();
  const sobra = () => ORCAMENTO_MS - (Date.now() - inicio);
  const credenciais = await banco.listarCredenciais();

  for (const { user_id: userId, servico } of credenciais) {
    if (sobra() < 5000) break;
    if (servico === 'lyceum') {
      await sincronizarLyceumDaUsuaria(userId);
      continue;
    }
    const geral = await sincronizarAva(userId, { parte: 'geral' });
    const cursos = geral.ok ? geral.cursos : [];
    for (let i = 0; i < cursos.length && sobra() > 5000; i += 3) {
      await sincronizarAva(userId, { parte: 'cursos', cursos: cursos.slice(i, i + 3) });
    }
  }
  return new Response('ok');
};

export const config = { schedule: '0 */6 * * *' };
