// Organiza o documento da quinzena da R7 no formato que a Bússola lê, em segundo plano (Netlify Background
// Function, até 15 min: o pedido normal estourava o tempo com documentos grandes). Responde 202 na hora; o
// resultado vai para config "r7-documento:<cliente>" { status: 'pronto' | 'erro', documento, erro, pedido_em },
// que o app acompanha. Só reorganiza: nunca escreve nem muda as copys (Carol, 18/11/2026).

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { organizarDocumentoR7 } from '../lib/trabalho.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const e = (await lerCorpo(req)) || {};
  const cliente = texto(e.cliente, 120);
  const pedidoEm = texto(e.pedido_em, 40);
  const doc = texto(e.texto, 80000);
  if (!/^[\w-]+$/.test(cliente) || doc.trim().length < 40) return;
  const gravar = (valor) => banco.gravar('config', [{ user_id: usuaria.id, chave: `r7-documento:${cliente}`, valor: { ...valor, pedido_em: pedidoEm, em: new Date().toISOString() } }], 'user_id,chave');
  try {
    const r = await organizarDocumentoR7(usuaria.id, { clienteChave: cliente, texto: doc, hoje: texto(e.hoje, 10) });
    await gravar({ status: 'pronto', documento: r.documento });
  } catch (falha) {
    if (!(falha instanceof ErroIa)) console.error('r7-documento:', falha?.message);
    await gravar({ status: 'erro', erro: falha instanceof ErroIa ? falha.message : 'A IA não conseguiu organizar este documento agora. Tente de novo.' }).catch(() => {});
  }
};
