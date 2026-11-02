// Escreve a legenda de um post da pauta olhando as artes, em segundo plano (Netlify Background Function).
// Responde 202 na hora; o resultado vai para a linha de importacoes (tipo 'pauta') que o app acompanha.
// Corpo: { id } da linha, com os caminhos das artes em "arquivo" (um por linha) e o cartão em "texto".

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { escreverLegenda, ErroIa } from '../lib/ia-pauta.mjs';
import { contextoDoCliente } from '../lib/trabalho.mjs';

const MAX_ARTES = 6;

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  if (!linha || linha.status !== 'lendo' || linha.tipo !== 'pauta') return;

  const caminhos = String(linha.arquivo || '').split('\n').map((c) => c.trim())
    .filter((c) => c.startsWith(`${usuaria.id}/importacoes/`)).slice(0, MAX_ARTES);
  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    let cartao = {};
    try { cartao = JSON.parse(linha.texto || '{}'); } catch { /* sem dados */ }
    if (!caminhos.length && !cartao.descricao) throw new ErroIa('Sem arte e sem descrição não dá para escrever a legenda.');
    const imagens = [];
    for (const c of caminhos) {
      const bytes = await banco.baixarArquivo(usuaria.id, c);
      imagens.push({ tipo: /\.png$/i.test(c) ? 'image/png' : 'image/jpeg', base64: Buffer.from(bytes).toString('base64') });
    }
    const cliente = await contextoDoCliente(usuaria.id, typeof cartao.cliente === 'string' ? cartao.cliente.slice(0, 120) : '');
    if (!cliente.nome) cliente.nome = String(cartao.nome || '').slice(0, 120);
    const resultado = await escreverLegenda({
      imagens, cliente, titulo: cartao.titulo, formato: cartao.formato, descricao: cartao.descricao, observacao: cartao.observacao,
    });
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível escrever a legenda agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('pauta-legenda:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem }).catch(() => {});
  } finally {
    for (const c of caminhos) await banco.apagarArquivo(usuaria.id, c).catch(() => {});
  }
};
