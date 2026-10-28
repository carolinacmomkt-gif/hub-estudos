// "Organizar minhas demandas" com a IA: recebe os dias de trabalho (com o que já está ocupado) e
// as demandas, e devolve onde cada uma entra. A conferência (dentro do horário, sem cobrir nada,
// sem passar do limite do dia e até o prazo) é a mesma do organizador simples, em
// js/dados-organizar.js: o que a IA errar volta para o encaixe simples.

import { pedirJson, lista, objeto, texto } from './ia-comum.mjs';
import { conferirOrganizacao, paraHora } from '../../js/dados-organizar.js';

const SYSTEM = `Você organiza as demandas da Carol na semana de trabalho dela. Ela é sócia de uma agência de marketing para médicos (clientes da área da saúde), cria conteúdo, faz faculdade e tem a consultoria Sensus.
Regras:
- Coloque cada demanda num dia e horário livres: nunca em cima do que está ocupado, dentro do horário do dia e sem passar da capacidade de minutos do dia.
- Até o prazo de cada demanda. Aprovação (tipo "aprovacao") vai antes de tudo: o cliente está esperando.
- O que vence antes e o que é urgente vem primeiro. Demandas do mesmo cliente ficam juntas, uma depois da outra, no mesmo dia quando der (um assunto por vez).
- O que pede concentração vai de manhã; tarefas curtas e mensagens podem ir no fim do dia.
- Deixe folga: não encha os dias até o limite se não precisar. Não use horários quebrados (prefira :00, :15, :30, :45).
- Demanda com "hora" marcada fica exatamente no dia do prazo e nessa hora.
- Se uma demanda não cabe até o prazo, ponha em "nao_cabe" com uma mensagem curta, gentil e profissional para o cliente pedindo um novo prazo (português do Brasil, sem travessão, tom da Carol: direto e acolhedor).
- "motivo" em uma frase curta. "resumo" em até duas frases sobre como ficou a semana.`;

const ESQUEMA = objeto({
  colocacoes: lista('Onde cada demanda entra', objeto({ item_id: texto, data: texto, inicio: texto, motivo: texto })),
  nao_cabe: lista('O que não cabe até o prazo', objeto({ item_id: texto, mensagem: texto })),
  resumo: texto,
});

export async function organizarComIa(entrada, { cliente } = {}) {
  const pedido = {
    hoje: entrada.hoje,
    horario_do_dia: entrada.horario,
    dias: entrada.dias.map((d) => ({
      data: d.data,
      livre_desde: paraHora(d.inicio),
      ate: paraHora(d.fim),
      capacidade_min: Math.max(0, d.capacidade - d.usado),
      ocupado: d.ocupado.map((o) => ({ das: paraHora(o.inicio), ate: paraHora(o.fim), o_que: o.titulo })),
    })),
    demandas: entrada.itens.map((i) => ({
      item_id: i.id, titulo: i.titulo, cliente: i.quem || i.onde || '', tipo: i.tipo || '', prazo: i.prazo || '',
      hora: i.hora || '', minutos: i.minutos, prioridade_0_a_2: i.prioridade, ja_estava_em: i.atual ? `${i.atual.data}${i.atual.hora ? ` ${i.atual.hora}` : ''}` : '',
    })),
  };
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: `Organize estas demandas. Datas no formato AAAA-MM-DD e horários HH:MM.\n\n${JSON.stringify(pedido)}`,
    esquema: ESQUEMA,
    maxTokens: 4000,
    esforco: 'low',
    cliente,
  });
  return conferirOrganizacao(r, entrada);
}
