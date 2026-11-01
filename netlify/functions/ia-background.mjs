// Trabalho longo da IA, em segundo plano: ler o PDF de um artigo.
// Responde 202 na hora; o resultado vai para a linha da tabela importacoes (o app acompanha).
// Corpo: { id } de uma linha de importacoes (tipo 'artigo'), com o caminho do PDF em "arquivo".

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { lerPdf } from '../lib/ia-artigo.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  if (!linha || linha.status !== 'lendo' || linha.tipo !== 'artigo') return;

  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    if (!linha.arquivo) throw new ErroIa('Não veio o PDF para ler.');
    const resultado = await lerPdf(await banco.baixarArquivo(usuaria.id, linha.arquivo));
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível terminar agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('ia-background:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem }).catch(() => {});
  }
};
