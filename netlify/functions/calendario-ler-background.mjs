// Lê o calendário acadêmico com a IA, em segundo plano (Netlify Background Function).
// Ler um PDF leva de 20 s a alguns minutos; por isso a função responde na hora (202) e
// grava o resultado na tabela importacoes. O app acompanha a linha até ficar "pronto".
// Corpo: { id } de uma linha de importacoes criada pelo app (com o PDF no Storage ou o texto).

import { lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { lerCalendario, ErroIa } from '../lib/ia-calendario.mjs';

const MAX_TEXTO = 200000;

export default async (req) => {
  if (req.method !== 'POST') return;
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return;

  const { id } = (await lerCorpo(req)) || {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const linha = await banco.lerPorId('importacoes', usuaria.id, id);
  // Só lê uma vez: se a Netlify repetir a chamada depois de um erro, não gasta outra leitura.
  if (!linha || linha.status !== 'lendo') return;

  const terminar = (campos) => banco.atualizarPorId('importacoes', usuaria.id, id, campos);
  try {
    const entrada = { curso: linha.curso || '' };
    if (linha.arquivo) entrada.pdf = await banco.baixarArquivo(usuaria.id, linha.arquivo);
    else if (linha.texto) entrada.texto = String(linha.texto).slice(0, MAX_TEXTO);
    else throw new ErroIa('Não veio nem PDF nem texto para ler.');

    const resultado = await lerCalendario(entrada);
    await terminar({ status: 'pronto', resultado, erro: null, texto: null });
  } catch (falha) {
    const mensagem = falha instanceof ErroIa ? falha.message : 'Não foi possível ler o calendário agora. Tente de novo.';
    if (!(falha instanceof ErroIa)) console.error('calendario-ler:', falha?.message);
    await terminar({ status: 'erro', erro: mensagem }).catch(() => {});
  } finally {
    // O PDF só serve para esta leitura.
    if (linha.arquivo) await banco.apagarArquivo(usuaria.id, linha.arquivo).catch(() => {});
  }
};
