// Caixa de demandas: conectar o Trello e o Notion, escolher as bases do Notion, "Ler agora" e ler
// uma mensagem compartilhada (WhatsApp). O app só LÊ o Trello e o Notion.
// Corpo: { acao: 'conectar', servico: 'trello' | 'notion', token }
//        { acao: 'bases' }                    → atualiza a lista de bases que o Notion deixa ver
//        { acao: 'escolher', bases: [ids] }   → quais bases viram demandas
//        { acao: 'sincronizar' }
//        { acao: 'ler', texto }               → sugestão para uma mensagem (quem grava é o app)

import { resposta, lerCorpo, texto } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { cifrar, decifrar } from '../lib/cripto.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';
import { noFuso } from '../lib/avisos.mjs';
import {
  ErroOrigem, contaTrello, contaNotion, basesNotion, sincronizarDemandas, lerMensagem,
} from '../lib/demandas.mjs';

const MAX_BASES = 8;

async function conectar(userId, servico, token) {
  if (!['trello', 'notion'].includes(servico)) return { ok: false, erro: 'Serviço desconhecido.' };
  if (!token || token.length < 20) return { ok: false, erro: servico === 'trello' ? 'O token do Trello não veio. Tente conectar de novo.' : 'Cole o segredo da conexão do Notion (começa com "ntn_" ou "secret_").' };
  let detalhe;
  if (servico === 'trello') {
    detalhe = await contaTrello(token);
  } else {
    const [conta, disponiveis] = await Promise.all([contaNotion(token), basesNotion(token)]);
    // Ela liberou essas bases para a conexão: já começam escolhidas (dá para tirar depois).
    detalhe = { ...conta, disponiveis, bases: disponiveis.slice(0, MAX_BASES) };
  }
  await banco.salvarCredencial(userId, servico, cifrar({ token }));
  await banco.salvarConexao(userId, servico, { status: 'conectado', conectado_em: new Date().toISOString(), detalhe });
  return { ok: true, detalhe };
}

async function tokenNotion(userId) {
  const cifrado = await banco.lerCredencial(userId, 'notion');
  if (!cifrado) throw new ErroOrigem('Conecte o Notion primeiro.');
  return decifrar(cifrado).token;
}

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;
  const entrada = (await lerCorpo(req)) || {};
  try {
    switch (entrada.acao) {
      case 'conectar':
        return resposta(200, await conectar(usuaria.id, entrada.servico, texto(entrada.token, 300).trim()));
      case 'bases': {
        const disponiveis = await basesNotion(await tokenNotion(usuaria.id));
        const conexao = await banco.lerConexao(usuaria.id, 'notion');
        const ids = new Set(disponiveis.map((b) => b.id));
        const bases = (conexao?.detalhe?.bases || []).filter((b) => ids.has(b.id));
        await banco.salvarConexao(usuaria.id, 'notion', { detalhe: { ...(conexao?.detalhe || {}), disponiveis, bases } });
        return resposta(200, { ok: true, disponiveis, bases });
      }
      case 'escolher': {
        const conexao = await banco.lerConexao(usuaria.id, 'notion');
        if (!conexao) return resposta(200, { ok: false, erro: 'Conecte o Notion primeiro.' });
        const quero = new Set((Array.isArray(entrada.bases) ? entrada.bases : []).map(String));
        const bases = (conexao.detalhe?.disponiveis || []).filter((b) => quero.has(b.id)).slice(0, MAX_BASES);
        await banco.salvarConexao(usuaria.id, 'notion', { detalhe: { ...conexao.detalhe, bases } });
        return resposta(200, { ok: true, bases });
      }
      case 'sincronizar':
        return resposta(200, await sincronizarDemandas(usuaria.id));
      case 'ler': {
        const mensagem = texto(entrada.texto, 4000).trim();
        if (!mensagem) return resposta(400, { ok: false, erro: 'A mensagem veio vazia.' });
        const { data: hoje } = noFuso(Date.now(), 'America/Sao_Paulo');
        return resposta(200, { ok: true, sugestao: await lerMensagem(mensagem, hoje) });
      }
      default:
        return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
    }
  } catch (falha) {
    if (falha instanceof ErroOrigem || falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message });
    console.error('demandas:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não deu certo agora. Tente de novo em instantes.' });
  }
};
