// Caixa de demandas nas funções: lê o Trello e o Notion (só leitura, nunca escreve lá), pede à IA
// a sugestão de prazo, tempo e prioridade do que é novo e grava em "demandas" para a Carol aprovar.
//
// Trello: chave do app em TRELLO_API_KEY (Netlify) + token da Carol (criptografado).
// Notion: segredo da conexão interna da Carol (criptografado) + as bases que ela escolheu.
// Endereços trocáveis para os testes: TRELLO_BASE_URL e NOTION_BASE_URL.

import { createHash } from 'node:crypto';
import { banco } from './supabase.mjs';
import { decifrar } from './cripto.mjs';
import { pedirJson, ErroIa, lista, objeto, texto, limpar } from './ia-comum.mjs';
import { noFuso } from './avisos.mjs';
import {
  pareceFeito, prazoDaOrigem, assinaturaDe, aplicarSugestao, sugestaoSimples, mudancaDe, AREAS_DEMANDA,
} from '../../js/dados-demandas.js';

const FUSO = 'America/Sao_Paulo';
const IA_POR_RODADA = 15; // o resto fica com a sugestão simples e a IA completa na próxima leitura
const MAX_ITENS = 150;
const NOTION_VERSAO = '2022-06-28';

export class ErroOrigem extends Error {
  constructor(mensagem, { reconectar = false } = {}) {
    super(mensagem);
    this.reconectar = reconectar;
  }
}

const baseTrello = () => (process.env.TRELLO_BASE_URL || 'https://api.trello.com').replace(/\/+$/, '');
const baseNotion = () => (process.env.NOTION_BASE_URL || 'https://api.notion.com').replace(/\/+$/, '');

async function pedir(url, opcoes, nome) {
  let r;
  try {
    r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new ErroOrigem(`Não consegui falar com o ${nome} agora. Tento de novo na próxima leitura.`);
  }
  if (r.status === 401 || r.status === 403) throw new ErroOrigem(`O ${nome} recusou o acesso. Conecte de novo em Configurações.`, { reconectar: true });
  if (r.status === 429) throw new ErroOrigem(`O ${nome} pediu uma pausa (muitos pedidos). Tento de novo mais tarde.`);
  if (!r.ok) throw new ErroOrigem(`O ${nome} respondeu ${r.status}. Tento de novo na próxima leitura.`);
  return r.json();
}

// ---------------------------------------------------------------------------
// Trello: cartões em que a Carol é membro, abertos e fora das listas de "feito"
// ---------------------------------------------------------------------------

export function chaveTrello() {
  const chave = process.env.TRELLO_API_KEY || '';
  if (!chave) throw new ErroOrigem('Falta a variável TRELLO_API_KEY na Netlify.');
  return chave;
}

const trello = (caminho, token, extra = '') => pedir(
  `${baseTrello()}/1/${caminho}?key=${encodeURIComponent(chaveTrello())}&token=${encodeURIComponent(token)}${extra}`,
  { headers: { Accept: 'application/json' } },
  'Trello',
);

export async function contaTrello(token) {
  const eu = await trello('members/me', token, '&fields=fullName,username');
  return { nome: eu.fullName || eu.username || 'Trello' };
}

export async function lerTrello(token) {
  const [quadros, cartoes] = await Promise.all([
    trello('members/me/boards', token, '&filter=open&fields=name'),
    trello('members/me/cards', token, '&filter=open&fields=name,desc,due,dueComplete,idBoard,idList,shortUrl,url'),
  ]);
  const nomeQuadro = new Map((quadros || []).map((q) => [q.id, q.name]));
  const comCartao = [...new Set((cartoes || []).map((c) => c.idBoard))].filter((id) => nomeQuadro.has(id)).slice(0, 20);
  const listas = new Map();
  await Promise.all(comCartao.map(async (id) => {
    for (const l of (await trello(`boards/${id}/lists`, token, '&fields=name')) || []) listas.set(l.id, l.name);
  }));
  return (cartoes || [])
    .filter((c) => !c.dueComplete && nomeQuadro.has(c.idBoard) && !pareceFeito(listas.get(c.idList)))
    .slice(0, MAX_ITENS)
    .map((c) => ({
      origem: 'trello',
      origem_id: c.id,
      origem_url: c.shortUrl || c.url || null,
      titulo: limpar(c.name, 200),
      detalhe: String(c.desc || '').trim().slice(0, 2000) || null,
      onde: [nomeQuadro.get(c.idBoard), listas.get(c.idList)].filter(Boolean).join(' › '),
      quem: null,
      ...prazoDaOrigem(c.due, FUSO),
    }));
}

// ---------------------------------------------------------------------------
// Notion: páginas das bases escolhidas, editadas nos últimos 30 dias e não concluídas
// ---------------------------------------------------------------------------

const notion = (caminho, token, corpo) => pedir(`${baseNotion()}/v1/${caminho}`, {
  method: corpo ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSAO, 'Content-Type': 'application/json' },
  body: corpo ? JSON.stringify(corpo) : undefined,
}, 'Notion');

const textoRico = (partes) => (partes || []).map((p) => p.plain_text || '').join('').trim();

// Bases que a conexão consegue ver (a Carol escolhe quais viram demandas).
export async function basesNotion(token) {
  const r = await notion('search', token, { filter: { property: 'object', value: 'database' }, page_size: 50 });
  return (r.results || []).map((b) => ({ id: b.id, nome: textoRico(b.title) || 'Sem nome' })).slice(0, 50);
}

export async function contaNotion(token) {
  const eu = await notion('users/me', token);
  return { nome: eu?.bot?.workspace_name || eu?.name || 'Notion' };
}

function lerPagina(p, nomeBase) {
  const props = Object.values(p.properties || {});
  const titulo = textoRico(props.find((x) => x.type === 'title')?.title);
  const data = props.find((x) => x.type === 'date' && x.date?.start)?.date?.start || null;
  const situacao = props.map((x) => (x.type === 'status' ? x.status?.name : x.type === 'select' ? x.select?.name : null)).filter(Boolean);
  const marcado = props.some((x) => x.type === 'checkbox' && x.checkbox === true);
  const pessoas = props.filter((x) => x.type === 'people').flatMap((x) => x.people || []).map((u) => u.name).filter(Boolean);
  const textos = props.filter((x) => x.type === 'rich_text').map((x) => textoRico(x.rich_text)).filter(Boolean);
  return {
    feito: situacao.some(pareceFeito) || marcado,
    item: {
      origem: 'notion',
      origem_id: p.id,
      origem_url: p.url || null,
      titulo: limpar(titulo, 200),
      detalhe: [situacao.length ? `Status: ${situacao.join(', ')}` : '', pessoas.length ? `Responsável: ${pessoas.join(', ')}` : '', ...textos].filter(Boolean).join('\n').slice(0, 2000) || null,
      onde: nomeBase,
      quem: null,
      ...prazoDaOrigem(data, FUSO),
    },
  };
}

export async function lerNotion(token, bases) {
  const itens = [];
  for (const base of (bases || []).slice(0, 8)) {
    const r = await notion(`databases/${encodeURIComponent(base.id)}/query`, token, {
      page_size: 50,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      filter: { timestamp: 'last_edited_time', last_edited_time: { past_month: {} } },
    });
    for (const p of r.results || []) {
      if (p.archived || p.in_trash) continue;
      const { feito, item } = lerPagina(p, base.nome);
      if (!feito && item.titulo) itens.push(item);
    }
  }
  return itens.slice(0, MAX_ITENS);
}

// ---------------------------------------------------------------------------
// IA: prazo, tempo, prioridade e área de cada demanda nova
// ---------------------------------------------------------------------------

const SYSTEM = `Você ajuda a Carol a transformar demandas (cartões do Trello, páginas do Notion e mensagens de WhatsApp) em tarefas claras. Ela é sócia de uma agência de marketing para médicos, cria conteúdo, faz faculdade e tem a consultoria Sensus.
Para cada item, devolva:
- titulo: o que ela precisa fazer, começando por um verbo, curto (até 70 caracteres), em português do Brasil, sem travessão.
- prazo: AAAA-MM-DD se o texto disser uma data ou um dia ("sexta", "amanhã", "até dia 5"), contando a partir de hoje; senão "".
- hora: HH:MM se o texto disser um horário; senão "".
- minutos: estimativa realista do tempo de trabalho (15, 30, 45, 60, 90, 120...).
- prioridade: 2 se for urgente ou vencer em até 1 dia, 1 se for importante ou vencer em até 3 dias, 0 no resto.
- quem: quem pediu, se der para saber pelo texto; senão "".
- area: uma de ${AREAS_DEMANDA.join(', ')} (agência e clientes = consultoria; conteúdo próprio = criacao).
- motivo: uma frase curta explicando a prioridade (ex.: "Cliente pediu para amanhã").
Não invente tarefas nem detalhes que não estão no texto.`;

const ESQUEMA = objeto({
  itens: lista('Um por item recebido, mesmo id', objeto({
    id: texto, titulo: texto, prazo: texto, hora: texto,
    minutos: { type: 'integer' }, prioridade: { type: 'integer', enum: [0, 1, 2] },
    quem: texto, area: { type: 'string', enum: AREAS_DEMANDA }, motivo: texto,
  })),
});

export async function sugerirComIa(itens, hoje, { cliente } = {}) {
  if (!itens.length) return new Map();
  const pedido = {
    hoje,
    dia_da_semana: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${hoje}T12:00:00Z`)),
    itens: itens.map((x, i) => ({
      id: String(i), origem: x.origem, titulo: x.titulo, detalhe: String(x.detalhe || '').slice(0, 1200),
      onde: x.onde || '', prazo_da_origem: x.prazo || '',
    })),
  };
  const r = await pedirJson({ system: SYSTEM, conteudo: JSON.stringify(pedido), esquema: ESQUEMA, maxTokens: 4000, cliente });
  return new Map((r.itens || []).map((s) => [Number(s.id), s]));
}

// ---------------------------------------------------------------------------
// Leitura completa de uma usuária (app, "Ler agora" e a função agendada)
// ---------------------------------------------------------------------------

const resumoDe = (a) => createHash('sha1').update(a).digest('base64url').slice(0, 16);

function linhaNova(userId, item, s, ia) {
  return {
    user_id: userId,
    origem: item.origem,
    origem_id: item.origem_id,
    origem_url: item.origem_url,
    titulo: s.titulo,
    detalhe: item.detalhe,
    onde: item.onde || null,
    quem: s.quem,
    prazo: s.prazo,
    hora: s.hora,
    minutos: s.minutos,
    prioridade: s.prioridade,
    status: 'nova',
    assinatura: resumoDe(assinaturaDe(item)),
    excluido_em: null, // voltou para a origem depois de sumir: volta para a caixa
    dados: { titulo_origem: item.titulo, prazo_origem: item.prazo || null, motivo: s.motivo, area: s.area, ia },
  };
}

async function lerOrigem(userId, servico) {
  const cifrado = await banco.lerCredencial(userId, servico);
  if (!cifrado) return null;
  const segredo = decifrar(cifrado);
  if (servico === 'trello') return lerTrello(segredo.token);
  const conexao = await banco.lerConexao(userId, 'notion');
  return lerNotion(segredo.token, conexao?.detalhe?.bases || []);
}

// Junta o que veio da origem com o que já está guardado.
// Nova → sugestão (IA nas primeiras); mudou → atualiza (ou avisa, se já virou tarefa);
// sumiu da origem (feita, arquivada) → some da caixa se ainda não foi aceita.
export async function sincronizarDemandas(userId, { agora = Date.now(), cliente, servicos = ['trello', 'notion'] } = {}) {
  const { data: hoje } = noFuso(agora, FUSO);
  const resultado = { ok: true, novas: 0, mudadas: 0, erros: [] };
  for (const servico of servicos) {
    let itens;
    try {
      itens = await lerOrigem(userId, servico);
    } catch (falha) {
      const reconectar = falha instanceof ErroOrigem && falha.reconectar;
      const mensagem = falha instanceof ErroOrigem ? falha.message : `Não consegui ler o ${servico === 'trello' ? 'Trello' : 'Notion'} agora.`;
      if (!(falha instanceof ErroOrigem)) console.error(`demandas ${servico}:`, falha?.message);
      resultado.erros.push(mensagem);
      const conexao = await banco.lerConexao(userId, servico).catch(() => null);
      if (conexao) await banco.salvarConexao(userId, servico, { status: reconectar ? 'reconectar' : conexao.status, detalhe: { ...(conexao.detalhe || {}), mensagem } }).catch(() => {});
      continue;
    }
    if (!itens) continue;

    const guardadas = await banco.listar('demandas', userId, `origem=eq.${servico}`);
    const porId = new Map(guardadas.map((d) => [d.origem_id, d]));
    const vistos = new Set(itens.map((x) => x.origem_id));
    const novos = itens.filter((x) => !porId.has(x.origem_id));
    // Novas sem IA de leituras anteriores também ganham a vez (até o limite da rodada).
    const semIa = guardadas.filter((d) => d.status === 'nova' && d.dados?.ia === false && vistos.has(d.origem_id));
    const paraIa = [...novos, ...semIa.map((d) => itens.find((x) => x.origem_id === d.origem_id))].slice(0, IA_POR_RODADA);
    let sugestoes = new Map();
    try {
      sugestoes = await sugerirComIa(paraIa, hoje, { cliente });
    } catch (falha) {
      if (!(falha instanceof ErroIa)) console.error('demandas IA:', falha?.message);
    }
    const daIa = (item) => {
      const i = paraIa.indexOf(item);
      return i >= 0 && sugestoes.has(i) ? sugestoes.get(i) : null;
    };

    const gravar = [];
    for (const item of itens) {
      const antiga = porId.get(item.origem_id);
      const assinatura = resumoDe(assinaturaDe(item));
      if (!antiga) {
        const s = daIa(item);
        gravar.push(linhaNova(userId, item, aplicarSugestao(item, s, hoje), Boolean(s)));
        continue;
      }
      if (antiga.status === 'nova' && antiga.dados?.ia === false && daIa(item)) {
        const s = aplicarSugestao(item, daIa(item), hoje);
        gravar.push({ ...linhaNova(userId, item, s, true), id: antiga.id });
        continue;
      }
      if (antiga.assinatura === assinatura) continue;
      if (antiga.status === 'nova') {
        // Ainda não aprovada: acompanha a origem (o prazo da origem vale mais).
        const s = { ...sugestaoSimples(item, hoje), titulo: antiga.titulo, minutos: antiga.minutos, quem: antiga.quem };
        gravar.push({ ...linhaNova(userId, item, { ...s, prioridade: antiga.prioridade, area: antiga.dados?.area, motivo: antiga.dados?.motivo }, antiga.dados?.ia !== false), id: antiga.id });
      } else if (antiga.status === 'aceita') {
        const mudou = mudancaDe({ ...antiga, prazo: antiga.dados?.prazo_origem ?? antiga.prazo }, item);
        await banco.atualizarPorId('demandas', userId, antiga.id, {
          assinatura,
          ...(mudou ? { mudou } : {}),
          dados: { ...(antiga.dados || {}), titulo_origem: item.titulo, prazo_origem: item.prazo || null },
        });
        if (mudou) resultado.mudadas += 1;
      } else {
        await banco.atualizarPorId('demandas', userId, antiga.id, { assinatura });
      }
    }
    resultado.novas += novos.length;
    await banco.gravar('demandas', gravar, 'user_id,origem,origem_id');
    // Saiu da origem (concluída, arquivada, deixou de ser dela) e ainda não foi aceita: some da caixa.
    const sumiram = guardadas.filter((d) => d.status === 'nova' && !vistos.has(d.origem_id));
    for (const d of sumiram) await banco.atualizarPorId('demandas', userId, d.id, { excluido_em: new Date(agora).toISOString() });

    const conexao = await banco.lerConexao(userId, servico);
    const { mensagem, ...detalhe } = conexao?.detalhe || {};
    await banco.salvarConexao(userId, servico, {
      status: 'conectado',
      ultima_sincronizacao: new Date(agora).toISOString(),
      detalhe: { ...detalhe, lidas: itens.length },
    });
  }
  resultado.ok = resultado.erros.length === 0;
  return resultado;
}

// Mensagem compartilhada (WhatsApp e outros): só a sugestão; quem grava é o app.
export async function lerMensagem(texto, hoje, { cliente } = {}) {
  const item = { origem: 'compartilhado', titulo: limpar(texto, 200), detalhe: String(texto).slice(0, 2000), prazo: null, hora: null };
  const s = (await sugerirComIa([item], hoje, { cliente })).get(0);
  return aplicarSugestao(item, s, hoje);
}
