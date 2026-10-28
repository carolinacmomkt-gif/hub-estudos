// Desconecta o AVA, o Lyceum, o Trello ou o Notion: apaga o segredo criptografado e marca a conexão como desconectada.

import { resposta, lerCorpo } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';

const SERVICOS = ['ava', 'lyceum', 'trello', 'notion'];

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });

  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;

  const entrada = await lerCorpo(req);
  const servico = entrada?.servico;
  if (!SERVICOS.includes(servico)) return resposta(400, { ok: false, erro: 'Serviço desconhecido.' });

  try {
    await banco.apagarCredencial(usuaria.id, servico);
    await banco.salvarConexao(usuaria.id, servico, { status: 'desconectado', conectado_em: null, detalhe: {} });
  } catch (falha) {
    console.error('desconectar:', falha.message);
    return resposta(200, { ok: false, erro: 'Não foi possível desconectar agora. Tente de novo.' });
  }
  return resposta(200, { ok: true });
};
