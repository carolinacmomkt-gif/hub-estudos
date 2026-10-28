// Captura por voz (só quando a Carol toca em "Organizar"). Corpo: { texto, hoje, categorias }.
// Devolve os itens para ela conferir; quem grava é o app.

import { resposta, lerCorpo, texto } from '../lib/http.mjs';
import { exigirLogin } from '../lib/supabase.mjs';
import { organizarCaptura } from '../lib/ia-captura.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { erro } = await exigirLogin(req);
  if (erro) return erro;
  const entrada = (await lerCorpo(req)) || {};
  const falado = texto(entrada.texto, 3000).trim();
  if (!falado || !/^\d{4}-\d{2}-\d{2}$/.test(entrada.hoje || '')) return resposta(400, { ok: false, erro: 'Pedido inválido.' });
  const categorias = (Array.isArray(entrada.categorias) ? entrada.categorias : []).slice(0, 40)
    .map((c) => ({ id: texto(c?.id, 40), nome: texto(c?.nome, 60) })).filter((c) => c.id);
  try {
    return resposta(200, { ok: true, itens: await organizarCaptura({ texto: falado, hoje: entrada.hoje, categorias }) });
  } catch (falha) {
    if (falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('capturar:', falha?.message);
    return resposta(200, { ok: false, erro: 'A IA não respondeu agora. Dá para salvar do jeito simples.' });
  }
};
