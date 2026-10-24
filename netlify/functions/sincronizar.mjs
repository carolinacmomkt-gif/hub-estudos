// Sincroniza a faculdade a pedido do app ("Sincronizar agora" e ao abrir, se faz mais de 1h).
// Corpo: { servico: 'ava', parte: 'geral' } → { cursos: [...] }
//        { servico: 'ava', parte: 'cursos', cursos: [até 2 ids] }
//        { servico: 'lyceum' }

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { sincronizarAva, sincronizarLyceumDaUsuaria, CURSOS_POR_PARTE } from '../lib/sincronizacao.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;

  const entrada = (await lerCorpo(req)) || {};
  if (entrada.servico === 'ava') {
    const parte = entrada.parte === 'cursos' ? 'cursos' : 'geral';
    const cursos = Array.isArray(entrada.cursos) ? entrada.cursos.map(Number).filter(Number.isInteger).slice(0, CURSOS_POR_PARTE) : [];
    return resposta(200, await sincronizarAva(usuaria.id, { parte, cursos }));
  }
  if (entrada.servico === 'lyceum') return resposta(200, await sincronizarLyceumDaUsuaria(usuaria.id));
  return resposta(400, { ok: false, erro: 'Serviço desconhecido.' });
};
