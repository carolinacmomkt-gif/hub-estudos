// Leitura do calendário acadêmico com a IA (API da Anthropic).
// Entra um PDF ou um texto colado; sai uma lista de eventos para a Carol revisar.
// A resposta vem em JSON com esquema garantido (structured outputs) e ainda passa por
// validarEventos, que descarta o que não tiver data ou tipo válido.

import Anthropic from '@anthropic-ai/sdk';

export const MODELO = 'claude-sonnet-5-5';
export const TIPOS_ACADEMICOS = ['prova', 'feriado', 'aula', 'atividade', 'trabalho'];
const MAX_EVENTOS = 300;

const ESQUEMA = {
  type: 'object',
  properties: {
    periodo: { type: 'string', description: 'Período do calendário, ex.: "2026/2"' },
    eventos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          tipo: { type: 'string', enum: TIPOS_ACADEMICOS },
          inicio: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
          fim: { type: 'string', description: 'Último dia (AAAA-MM-DD) se durar vários dias; vazio se for um dia só' },
          observacao: { type: 'string' },
        },
        required: ['titulo', 'tipo', 'inicio', 'fim', 'observacao'],
        additionalProperties: false,
      },
    },
    avisos: { type: 'string', description: 'O que ficou ambíguo ou ilegível; vazio se nada' },
  },
  required: ['periodo', 'eventos', 'avisos'],
  additionalProperties: false,
};

const INSTRUCOES = `Você lê calendários acadêmicos da UniEVANGÉLICA (Anápolis, GO) para uma aluna de graduação.
Extraia só as datas que importam para ela:
- provas e semanas de provas, avaliações substitutivas e exames finais → tipo "prova";
- feriados, pontos facultativos e recessos → tipo "feriado";
- início e fim das aulas e do semestre, reposições e dias letivos especiais → tipo "aula";
- prazos acadêmicos (rematrícula, trancamento, ajuste de matrícula, revisão de notas, lançamento de notas, colação de grau) → tipo "atividade";
- entregas de trabalhos, TCC e estágio → tipo "trabalho".
Regras:
- Datas sempre em AAAA-MM-DD. Se o ano não estiver escrito ao lado da data, use o ano do calendário.
- Um período de vários dias vira um evento só, com "inicio" e "fim". Se for um dia só, "fim" fica vazio.
- Títulos curtos em português, como aparecem no calendário (ex.: "Semana de provas N1", "Feriado: Tiradentes").
- Não invente datas. Se algo estiver ambíguo, explique em "avisos" e deixe o evento de fora.
- Ignore o que for só de funcionários, da pós-graduação ou de outros campi, a menos que valha para todos.
- Use "observacao" para detalhes úteis (ex.: "sem aula", "só cursos noturnos"); vazio se não houver.`;

const ehData = (texto) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(new Date(`${texto}T12:00:00Z`).getTime())
  && new Date(`${texto}T12:00:00Z`).toISOString().slice(0, 10) === texto;

const limpar = (valor, max) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Confere e arruma o que a IA devolveu. Nunca confia cegamente: data inválida ou tipo
// fora da lista sai da lista; fim antes do início é descartado; repetidos viram um só.
export function validarEventos(bruto) {
  const vistos = new Set();
  const eventos = [];
  for (const item of Array.isArray(bruto?.eventos) ? bruto.eventos : []) {
    const titulo = limpar(item?.titulo, 140);
    const tipo = TIPOS_ACADEMICOS.includes(item?.tipo) ? item.tipo : null;
    const inicio = limpar(item?.inicio, 10);
    let fim = limpar(item?.fim, 10);
    if (!titulo || !tipo || !ehData(inicio)) continue;
    if (!ehData(fim) || fim <= inicio) fim = '';
    const chave = `${inicio}|${titulo.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    eventos.push({ titulo, tipo, inicio, fim, observacao: limpar(item?.observacao, 300) });
    if (eventos.length >= MAX_EVENTOS) break;
  }
  eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  return { periodo: limpar(bruto?.periodo, 40), eventos, avisos: limpar(bruto?.avisos, 1000) };
}

export class ErroIa extends Error {}

// entrada: { pdf: Buffer } ou { texto: string }; curso: dica opcional.
export async function lerCalendario({ pdf, texto, curso }, { cliente } = {}) {
  if (!process.env.ANTHROPIC_API_KEY && !cliente) throw new ErroIa('Falta a variável ANTHROPIC_API_KEY na Netlify.');
  const anthropic = cliente || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const conteudo = [];
  if (pdf) {
    conteudo.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } });
  } else {
    conteudo.push({ type: 'text', text: `<calendario>\n${texto}\n</calendario>` });
  }
  const hoje = new Date().toISOString().slice(0, 10);
  conteudo.push({
    type: 'text',
    text: `Hoje é ${hoje}.${curso ? ` O curso da aluna é ${curso}; inclua o que vale para ele e para todos os cursos.` : ''} Extraia os eventos deste calendário acadêmico.`,
  });

  let mensagem;
  try {
    mensagem = await anthropic.beta.messages
      .stream({
        model: MODELO,
        max_tokens: 16000,
        // Se o modelo recusar o pedido, a API tenta de novo com o modelo reserva recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: INSTRUCOES,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
        messages: [{ role: 'user', content: conteudo }],
      })
      .finalMessage();
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) throw new ErroIa('A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY na Netlify.');
    if (erro instanceof Anthropic.RateLimitError) throw new ErroIa('A IA está com muitos pedidos agora. Tente de novo em alguns minutos.');
    if (erro instanceof Anthropic.BadRequestError && /pdf|document|page/i.test(String(erro.message))) {
      throw new ErroIa('A IA não conseguiu abrir este PDF. Tente colar o texto do calendário.');
    }
    if (erro instanceof Anthropic.APIError) throw new ErroIa(`A IA não respondeu agora (${erro.status || 'sem status'}). Tente de novo.`);
    throw erro;
  }

  if (mensagem.stop_reason === 'refusal') throw new ErroIa('A IA não quis ler este arquivo. Tente colar só o texto do calendário.');
  if (mensagem.stop_reason === 'max_tokens') throw new ErroIa('O calendário é grande demais para ler de uma vez. Mande só as páginas do semestre.');
  const bloco = mensagem.content.find((b) => b.type === 'text');
  if (!bloco) throw new ErroIa('A IA não devolveu nenhum evento.');
  let bruto;
  try {
    bruto = JSON.parse(bloco.text);
  } catch {
    throw new ErroIa('A resposta da IA veio num formato inesperado. Tente de novo.');
  }
  return { ...validarEventos(bruto), modelo: mensagem.model };
}
