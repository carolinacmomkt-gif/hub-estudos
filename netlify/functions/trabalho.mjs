// Grupo Trabalho (o Pauta dentro do Bússola). Só a Carol, com login.
// Corpo: { acao: 'conectar', token }                 → segredo do Notion do trabalho (fica criptografado)
//        { acao: 'desconectar' }
//        { acao: 'situacao' }                        → conexões e se o Trello deixa escrever
//        { acao: 'partes' }                          → as partes da sincronização, na ordem
//        { acao: 'sincronizar', parte }              → 'clientes' | 'cal:<n>' | 'trello'
//        { acao: 'mudar', id, status?, data?, etapa? } → muda a peça no Notion ou no Trello (com a trava)
//        { acao: 'comentar', id, texto }
//        { acao: 'texto', id }                       → lê o texto da peça no Notion
//        { acao: 'criar', calendario, titulo, data, formato, texto, cliente }
//        { acao: 'calendarios-buscar' }               → calendários que a conexão enxerga (para acrescentar)
//        { acao: 'calendarios-salvar', desligados, extras }
//        { acao: 'ia', pedido: 'criar' | 'gancho' | 'arte', cliente, formato, objetivo, tema, notas, texto }
//        { acao: 'relatorio-consideracoes', nome, mes, metricas: [{ rotulo, valor, comparacao }], temas, topicos, observacoes }

import { resposta, lerCorpo, texto } from '../lib/http.mjs';
import { exigirLogin, banco } from '../lib/supabase.mjs';
import { cifrar } from '../lib/cripto.mjs';
import { ErroIa } from '../lib/ia-comum.mjs';
import {
  ErroOrigem, contaNotionTrabalho, trelloEscreve, tokenDe, partesDaSincronizacao, sincronizarParte, mudarPeca, comentarPeca,
  lerTextoDaPeca, criarPeca, pedirIa, calendariosDe, buscarCalendarios, salvarCalendarios,
} from '../lib/trabalho.mjs';
import { fontes } from '../lib/trabalho-fontes.mjs';
import { escreverConsideracoes } from '../lib/ia-relatorio.mjs';

const UUID = /^[0-9a-f-]{36}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export default async (req) => {
  if (req.method !== 'POST') return resposta(405, { ok: false, erro: 'Use POST.' });
  const { usuaria, erro } = await exigirLogin(req);
  if (erro) return erro;
  const e = (await lerCorpo(req)) || {};
  const id = String(e.id || '');
  try {
    switch (e.acao) {
      case 'conectar': {
        const token = texto(e.token, 300).trim();
        if (!/^(ntn_|secret_)\w{20,}/.test(token)) return resposta(200, { ok: false, erro: 'Cole o segredo da conexão do Notion (começa com "ntn_").' });
        const conta = await contaNotionTrabalho(token);
        await banco.salvarCredencial(usuaria.id, 'notion_trabalho', cifrar({ token }));
        await banco.salvarConexao(usuaria.id, 'notion_trabalho', { status: 'conectado', conectado_em: new Date().toISOString(), detalhe: conta });
        return resposta(200, { ok: true, detalhe: conta });
      }
      case 'desconectar':
        await banco.apagarCredencial(usuaria.id, 'notion_trabalho');
        await banco.salvarConexao(usuaria.id, 'notion_trabalho', { status: 'desconectado', detalhe: {} });
        return resposta(200, { ok: true });
      case 'situacao': {
        const trello = await banco.lerConexao(usuaria.id, 'trello');
        let escreve = false;
        if (trello) escreve = await trelloEscreve(await tokenDe(usuaria.id, 'trello')).catch(() => false);
        const conexao = await banco.lerConexao(usuaria.id, 'notion_trabalho');
        const lista = await calendariosDe(usuaria.id);
        const diagnostico = conexao?.detalhe?.diagnostico || {};
        return resposta(200, {
          ok: true, trello: Boolean(trello), trelloEscreve: escreve, calendarios: lista.map((c) => c.nome),
          calendariosLista: [
            ...lista.map((c) => ({ banco: c.banco, nome: c.nome, cliente: c.cliente, doPauta: c.doPauta, ligado: true, diag: diagnostico[c.banco] || null })),
            ...fontes().calendarios.filter((c) => !lista.some((l) => l.banco === c.banco)).map((c) => ({ banco: c.banco, nome: c.nome, cliente: c.cliente, doPauta: true, ligado: false, diag: null })),
          ],
          desligados: conexao?.detalhe?.calendariosDesligados || [],
        });
      }
      case 'partes':
        return resposta(200, { ok: true, partes: await partesDaSincronizacao(usuaria.id) });
      case 'calendarios-buscar':
        return resposta(200, { ok: true, calendarios: await buscarCalendarios(usuaria.id) });
      case 'calendarios-salvar':
        return resposta(200, await salvarCalendarios(usuaria.id, { desligados: Array.isArray(e.desligados) ? e.desligados : [], extras: Array.isArray(e.extras) ? e.extras : [] }));
      case 'sincronizar': {
        const r = await sincronizarParte(usuaria.id, String(e.parte || ''));
        if (e.parte === 'trello' || e.ultima) await banco.salvarConexao(usuaria.id, 'notion_trabalho', { ultima_sincronizacao: new Date().toISOString() }).catch(() => {});
        return resposta(200, r);
      }
      case 'mudar': {
        if (!UUID.test(id)) return resposta(400, { ok: false, erro: 'Peça inválida.' });
        const m = {};
        if (e.status !== undefined) m.status = texto(e.status, 80);
        if (e.data !== undefined) { if (e.data && !DIA.test(e.data)) return resposta(400, { ok: false, erro: 'Data inválida.' }); m.data = e.data || null; }
        if (['aprovou', 'ajuste'].includes(e.etapa)) m.etapa = e.etapa;
        if (!Object.keys(m).length) return resposta(400, { ok: false, erro: 'Nada para mudar.' });
        return resposta(200, await mudarPeca(usuaria.id, id, m));
      }
      case 'comentar': {
        const t = texto(e.texto, 2000).trim();
        if (!UUID.test(id) || !t) return resposta(400, { ok: false, erro: 'Comentário vazio.' });
        return resposta(200, await comentarPeca(usuaria.id, id, t));
      }
      case 'texto':
        if (!UUID.test(id)) return resposta(400, { ok: false, erro: 'Peça inválida.' });
        return resposta(200, await lerTextoDaPeca(usuaria.id, id));
      case 'criar': {
        const titulo = texto(e.titulo, 200).trim();
        if (!titulo) return resposta(200, { ok: false, erro: 'Dê um título à peça.' });
        if (e.data && !DIA.test(e.data)) return resposta(200, { ok: false, erro: 'Data inválida.' });
        return resposta(200, await criarPeca(usuaria.id, {
          calendario: texto(e.calendario, 120), titulo, data: e.data || null, formato: texto(e.formato, 60), texto: texto(e.texto, 30000), clienteChave: texto(e.cliente, 120) || null, status: texto(e.status, 80) || null,
        }));
      }
      case 'ia':
        return resposta(200, await pedirIa(usuaria.id, {
          acao: e.pedido, clienteChave: texto(e.cliente, 120) || null, formato: texto(e.formato, 60), objetivo: texto(e.objetivo, 60),
          tema: texto(e.tema, 300), notas: texto(e.notas, 1000), texto: texto(e.texto, 12000),
        }));
      case 'relatorio-consideracoes': {
        const lista = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
        const topicos = lista(e.topicos, 8).map((t) => texto(t, 60)).filter(Boolean);
        if (!topicos.length) return resposta(200, { ok: false, erro: 'Escreva pelo menos o nome de um tópico.' });
        const consideracoes = await escreverConsideracoes({
          nome: texto(e.nome, 120),
          mes: texto(e.mes, 40),
          metricas: lista(e.metricas, 10).map((m) => ({ rotulo: texto(m?.rotulo, 60), valor: texto(m?.valor, 30), comparacao: texto(m?.comparacao, 80) })).filter((m) => m.rotulo && m.valor),
          temas: lista(e.temas, 6).map((t) => texto(t, 160)).filter(Boolean),
          topicos,
          observacoes: texto(e.observacoes, 1500),
        });
        return resposta(200, { ok: true, consideracoes });
      }
      default:
        return resposta(400, { ok: false, erro: 'Pedido desconhecido.' });
    }
  } catch (falha) {
    if (falha instanceof ErroOrigem || falha instanceof ErroIa) return resposta(200, { ok: false, erro: falha.message, reconectar: Boolean(falha.reconectar) });
    console.error('trabalho:', falha?.message);
    return resposta(200, { ok: false, erro: 'Não deu certo agora. Tente de novo em instantes.' });
  }
};
