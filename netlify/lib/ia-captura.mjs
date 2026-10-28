// Captura por voz: a IA separa o que a Carol falou em itens e decide o destino de cada um
// (tarefa, compromisso, gasto, entrada, ideia de vídeo, pauta, demanda ou ideia solta).

import { pedirJson, lista, objeto, texto } from './ia-comum.mjs';
import { DESTINOS_CAPTURA, conferirItens } from '../../js/dados-captura.js';
import { AREAS_TAREFA } from '../../js/dados-tarefas.js';

const SYSTEM = `Você organiza o que a Carol falou (ditado no celular, às vezes sem pontuação) em itens do app dela, a Bússola.
Ela é estudante de Publicidade, sócia de uma agência de marketing para médicos, cria conteúdo para YouTube e Substack e tem a consultoria Sensus.
Para cada coisa que ela quer guardar, um item. Destinos:
- tarefa: algo para fazer ("ligar pro banco", "mandar o orçamento").
- evento: compromisso com dia e hora marcados com outra pessoa ou num lugar ("dentista quinta às 15h").
- gasto: dinheiro que saiu ("gastei 40 no mercado"). entrada: dinheiro que entrou.
- video: ideia de vídeo para o canal dela. pauta: ideia de texto para o Substack.
- demanda: pedido de cliente ou da agência para ela fazer.
- ideia: o resto (pensamento solto, lembrete sem ação clara).
Regras:
- titulo curto, começando por verbo nas tarefas e demandas, sem travessão, em português do Brasil.
- data em AAAA-MM-DD a partir de "hoje" (o JSON traz hoje e o dia da semana); "sexta" é a próxima sexta, mas para gasto e entrada é a última (já aconteceu). Sem data dita: "".
- hora HH:MM se dita; senão "".
- valor só para gasto e entrada (número, sem R$); senão 0.
- categoria: um id da lista de categorias (só para gasto); senão "".
- prioridade 2 se ela disser urgente/hoje sem falta, 1 se importante, senão 0.
- area: uma de ${AREAS_TAREFA.map((a) => a.id).join(', ')} quando der para saber; senão "".
- notas: detalhe útil que não coube no título; senão "".
Não invente nada que ela não disse. No máximo 10 itens.`;

const ESQUEMA = objeto({
  itens: lista('Itens que ela quer guardar', objeto({
    destino: { type: 'string', enum: DESTINOS_CAPTURA.map((d) => d.id) },
    titulo: texto, data: texto, hora: texto, valor: { type: 'number' }, categoria: texto,
    prioridade: { type: 'integer', enum: [0, 1, 2] }, area: texto, notas: texto,
  })),
});

export async function organizarCaptura({ texto: falado, hoje, categorias }, { cliente } = {}) {
  const pedido = {
    hoje,
    dia_da_semana: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${hoje}T12:00:00Z`)),
    categorias: (categorias || []).map((c) => ({ id: c.id, nome: c.nome })),
    falado: String(falado).slice(0, 3000),
  };
  const r = await pedirJson({ system: SYSTEM, conteudo: JSON.stringify(pedido), esquema: ESQUEMA, maxTokens: 2000, cliente });
  return conferirItens(r.itens, { categorias });
}
