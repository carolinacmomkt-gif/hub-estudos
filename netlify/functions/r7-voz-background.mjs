// Lê o tom de voz de um cliente da R7 em segundo plano (Netlify Background Function).
// Responde 202 na hora; o perfil vai para a linha de importacoes (tipo 'voz') que o app acompanha.
// Corpo: { id } da linha, com { nome, textos: [{ id, fonte, texto }] } em "texto".

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { lerVoz, ErroIa } from '../lib/ia-voz.mjs';

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  // Só lê uma vez: se a Netlify repetir a chamada, não gasta outra leitura.
  if (!linha || linha.status !== 'lendo' || linha.tipo !== 'voz') return;
  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    let pedido = {};
    try { pedido = JSON.parse(linha.texto || '{}'); } catch { /* sem textos */ }
    const resultado = await lerVoz({ nome: pedido.nome, textos: pedido.textos });
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível ler a voz agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('r7-voz:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem, texto: null }).catch(() => {});
  }
};
