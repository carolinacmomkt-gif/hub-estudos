// Lê os prints do Instagram para o relatório de métricas, em segundo plano (Netlify Background Function).
// Responde 202 na hora; o resultado vai para a linha de importacoes (tipo 'relatorio') que o app acompanha.
// Corpo: { id } da linha, com os caminhos dos prints em "arquivo" (um por linha) e { nome, mes } em "texto".

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { lerPrints, ErroIa } from '../lib/ia-relatorio.mjs';

const MAX_PRINTS = 12;

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  // Só lê uma vez: se a Netlify repetir a chamada, não gasta outra leitura.
  if (!linha || linha.status !== 'lendo' || linha.tipo !== 'relatorio') return;

  const caminhos = String(linha.arquivo || '').split('\n').map((c) => c.trim())
    .filter((c) => c.startsWith(`${usuaria.id}/importacoes/`)).slice(0, MAX_PRINTS);
  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    if (!caminhos.length) throw new ErroIa('Não chegou nenhum print para ler.');
    let contexto = {};
    try { contexto = JSON.parse(linha.texto || '{}'); } catch { /* sem contexto */ }
    const imagens = [];
    for (const c of caminhos) {
      const bytes = await banco.baixarArquivo(usuaria.id, c);
      imagens.push({ tipo: /\.png$/i.test(c) ? 'image/png' : 'image/jpeg', base64: Buffer.from(bytes).toString('base64') });
    }
    const resultado = await lerPrints({ imagens, nome: contexto.nome, mes: contexto.mes });
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível ler os prints agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('relatorio-ler:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem }).catch(() => {});
  } finally {
    // Os prints só servem para esta leitura (o app guarda a cópia dele enquanto a tela está aberta).
    for (const c of caminhos) await banco.apagarArquivo(usuaria.id, c).catch(() => {});
  }
};
