// "Pergunte à Bússola": a IA responde com os dados que o app mandou (os itens achados e um
// panorama curto). Ela não inventa: se a resposta não está ali, diz que não achou.

import { pedirJson, lista, objeto, texto } from './ia-comum.mjs';

const SYSTEM = `Você é a Bússola, o app pessoal da Carol (estudante de Publicidade na UniEVANGÉLICA, sócia de uma agência de marketing para médicos, cria conteúdo e tem a consultoria Sensus).
Responda a pergunta dela usando SÓ os dados do JSON que vem junto (itens achados no app, agenda dos próximos dias, tarefas abertas e, se houver, finanças).
Regras:
- Português do Brasil, tom direto e acolhedor, sem travessão. Comece pela resposta, em 1 a 4 frases curtas. Pode usar uma lista curta se ajudar.
- Datas no formato "qui, 05/11"; dinheiro como "R$ 1.234,50". Some valores quando ela perguntar "quanto".
- "hoje" é a data em "hoje". Use-a para "amanhã", "esta semana", "este mês".
- Se a resposta não estiver nos dados, diga com franqueza que não achou isso no app e sugira onde ela pode registrar.
- Nunca invente datas, valores, nomes ou tarefas.
- Em "itens", devolva os ids dos itens dos dados que embasam a resposta (no máximo 6), do mais importante para o menos.`;

const ESQUEMA = objeto({
  resposta: texto,
  itens: lista('ids dos itens usados na resposta', texto),
});

export async function responderPergunta(contexto, { cliente } = {}) {
  const r = await pedirJson({ system: SYSTEM, conteudo: JSON.stringify(contexto), esquema: ESQUEMA, maxTokens: 1500, cliente });
  const ids = new Set([
    ...(contexto.achados || []).map((a) => a.id),
    ...(contexto.agenda_proximos_21_dias || []).map((a) => a.id),
    ...(contexto.tarefas_abertas || []).map((a) => a.id),
  ]);
  return {
    resposta: String(r.resposta || '').trim().slice(0, 1500),
    itens: (r.itens || []).filter((id) => ids.has(id)).slice(0, 6),
  };
}
