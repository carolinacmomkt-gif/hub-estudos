// "Planejar meu dia" com a IA: recebe o resumo do dia (tarefas, compromissos, prazos, contas,
// hábitos e energia) e devolve blocos de horário. A conferência (sem sobrepor compromisso,
// dentro do horário do dia) é a mesma do planejador simples, em js/dados-dia.js.

import { pedirJson, ErroIa, lista, objeto, texto } from './ia-comum.mjs';
import { conferirBlocos, prefsDoDia, paraHora, TIPOS_BLOCO } from '../../js/dados-dia.js';

const SYSTEM = `Você organiza o dia da Carol em blocos de horário. Ela é sócia de uma agência de marketing para médicos, cria conteúdo, faz faculdade de Publicidade e tem a consultoria Sensus.
Regras:
- Nunca mova nem cubra os compromissos fixos: planeje só nos horários livres entre o início e o fim do dia dela.
- Use só as tarefas que vieram (pode juntar tarefas pequenas num bloco "Tarefas rápidas: ..."). Não invente tarefas.
- O mais importante e o que pede concentração vai para quando a energia está melhor (com energia boa, cedo). Com pouca energia, blocos menores (25 a 40 min) e mais pausas.
- Uma pausa curta a cada 60 a 90 minutos de trabalho e o almoço perto do horário dela.
- Hábitos do período (manhã, tarde, noite) entram como blocos curtos.
- Se houver prova ou entrega nos próximos dias, reserve um bloco de estudo ou de avanço.
- Deixe uma folga: não encha cada minuto.
- Títulos curtos, em português do Brasil, sem travessão. "motivo" em uma frase curta explicando por que naquele horário.
- No máximo 12 blocos. Horários no formato HH:MM.`;

const ESQUEMA = objeto({
  blocos: lista('Blocos do dia, em ordem', objeto({
    inicio: texto, fim: texto, titulo: texto,
    tipo: { type: 'string', enum: TIPOS_BLOCO.filter((t) => t !== 'compromisso') },
    tarefa_id: texto,
    motivo: texto,
  })),
  dica: texto,
});

export async function planejarComIa(entrada, valorPrefs, agoraMin, { cliente } = {}) {
  const prefs = prefsDoDia({ prefs: valorPrefs });
  const pedido = {
    dia: entrada.hoje,
    agora: paraHora(agoraMin),
    dia_vai_das: `${prefs.inicio} às ${prefs.fim}`,
    almoco: prefs.almoco,
    energia_de_1_a_5: entrada.energia || 'não informada',
    compromissos_fixos: entrada.compromissos.map((c) => ({ das: paraHora(c.inicio), ate: paraHora(c.fim), titulo: c.titulo })),
    dia_todo: entrada.diaTodo,
    tarefas: entrada.tarefas,
    prazos_proximos: entrada.prazos || [],
    contas_de_hoje: entrada.contas,
    habitos: entrada.habitos,
    observacao_da_carol: entrada.nota || '',
  };
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: `Planeje a partir de agora (${paraHora(agoraMin)}). Para tarefa_id use o id da tarefa ou "" se não for de uma tarefa.\n\n${JSON.stringify(pedido)}`,
    esquema: ESQUEMA,
    maxTokens: 3000,
    esforco: 'low',
    cliente,
  });
  const blocos = conferirBlocos((r.blocos || []).map((b) => ({ ...b, tarefa_id: b.tarefa_id || null })), entrada, prefs, agoraMin);
  if (!blocos.some((b) => b.tipo !== 'compromisso')) throw new ErroIa('A IA não achou espaço livre hoje. Ajuste o horário do dia e tente de novo.');
  return { blocos, dica: String(r.dica || '').replace(/\s+/g, ' ').trim().slice(0, 200) };
}
