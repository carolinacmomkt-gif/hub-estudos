// Trabalhos longos da IA, em segundo plano: gerar questões e ler o PDF de um artigo.
// Responde 202 na hora; o resultado vai para a linha da tabela importacoes (o app acompanha).
// Corpo: { id } de uma linha de importacoes (tipo 'questoes' ou 'artigo').
// A linha traz em "texto" o pedido em JSON e, no caso do PDF, o caminho em "arquivo".

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { gerarQuestoes } from '../lib/ia-questoes.mjs';
import { lerPdf } from '../lib/ia-artigo.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;
  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  if (!linha || linha.status !== 'lendo' || !['questoes', 'artigo'].includes(linha.tipo)) return;

  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    let resultado;
    if (linha.tipo === 'questoes') {
      const pedido = JSON.parse(linha.texto || '{}');
      if (pedido.fonte === 'imagem' && linha.arquivo) pedido.imagem = (await banco.baixarArquivo(usuaria.id, linha.arquivo)).toString('base64');
      resultado = { questoes: await gerarQuestoes(pedido) };
    } else {
      if (!linha.arquivo) throw new ErroIa('Não veio o PDF para ler.');
      resultado = await lerPdf(await banco.baixarArquivo(usuaria.id, linha.arquivo));
    }
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível terminar agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('ia-background:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem }).catch(() => {});
  } finally {
    // A imagem da página só serve para gerar as questões. O PDF do artigo fica (a Carol pode abrir depois).
    if (linha.tipo === 'questoes' && linha.arquivo) await banco.apagarArquivo(usuaria.id, linha.arquivo).catch(() => {});
  }
};
