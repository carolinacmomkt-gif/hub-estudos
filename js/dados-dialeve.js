// Dia de pouca energia (decisão da Carol, 29/10/2026): "hoje estou mal" encolhe o dia em vez de
// esconder tudo. Ficam só os inegociáveis (compromissos e tarefas com hora, prazos que vencem
// hoje ou amanhã, contas de hoje), o resto vai para amanhã, os hábitos ganham a versão mínima e o
// Próximo passo vira algo pequeno e possível. Fica em config "dia_leve" ({ data, movidas, historico }).

import { somarDias } from './dados-tarefas.js';

export const diaLeveDe = (config) => (config || []).find((c) => c.chave === 'dia_leve' && !c.excluido_em)?.valor || { data: null, movidas: [], historico: [] };
export const emDiaLeve = (config, hoje) => diaLeveDe(config).data === hoje;

// As tarefas que saem do dia: as de hoje sem hora e sem prazo de demanda para hoje.
export function tarefasParaAmanha(tarefas, hoje) {
  return (tarefas || []).filter((t) => !t.excluido_em && !t.feita_em && t.data && t.data <= hoje && !t.hora && !(t.dados?.prazo && t.dados.prazo <= somarDias(hoje, 1)));
}

// Os inegociáveis: o que não dá para pular mesmo num dia ruim.
// eventos: os de hoje com hora (já em ISO); prazos: eventos tipo prova/trabalho/atividade com prazo até amanhã.
export function inegociaveis({ tarefas = [], eventos = [], contas = [], hoje }) {
  const amanha = somarDias(hoje, 1);
  const itens = [];
  for (const e of eventos) {
    if (e.excluido_em || e.dia_inteiro || !e.inicio) continue;
    const data = e.inicio.slice(0, 10);
    if (data !== hoje) continue;
    if (['prova', 'trabalho', 'atividade'].includes(e.tipo)) continue; // entram como prazos
    itens.push({ tipo: 'compromisso', titulo: e.titulo, hora: new Date(e.inicio).toTimeString().slice(0, 5), rota: '#calendario' });
  }
  for (const t of tarefas) {
    if (t.excluido_em || t.feita_em) continue;
    if (t.data === hoje && t.hora) itens.push({ tipo: 'tarefa', id: t.id, titulo: t.titulo, hora: t.hora, rota: '#tarefas' });
    else if (t.dados?.prazo && t.dados.prazo <= amanha && !t.feita_em) itens.push({ tipo: 'tarefa', id: t.id, titulo: t.titulo, hora: null, rota: '#tarefas', prazo: t.dados.prazo });
  }
  for (const e of eventos) {
    if (e.excluido_em || !['prova', 'trabalho', 'atividade'].includes(e.tipo) || e.status === 'entregue') continue;
    const data = String(e.inicio || '').slice(0, 10);
    if (data === hoje || data === amanha) itens.push({ tipo: 'prazo', titulo: e.titulo, hora: null, rota: '#faculdade', prazo: data });
  }
  for (const c of contas) itens.push({ tipo: 'conta', titulo: c, hora: null, rota: '#financas/contas' });
  const ordem = { compromisso: 0, tarefa: 1, prazo: 2, conta: 3 };
  return itens.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99') || ordem[a.tipo] - ordem[b.tipo]);
}

// Um passo pequeno e possível, no lugar do Próximo passo.
export const PASSOS_PEQUENOS = [
  { titulo: 'Beber um copo d’água e alongar 2 minutos', texto: 'Só isso. O resto pode esperar.', acao: 'Começar 2 min', foco: 2 },
  { titulo: 'Ler 10 minutos de algo leve', texto: 'Sem meta de páginas. Parar quando quiser.', acao: 'Abrir a Biblioteca', destino: '#biblioteca' },
  { titulo: 'Responder uma mensagem só', texto: 'A que mais pesa. Depois fecha o celular.', acao: 'Feito', destino: null },
  { titulo: 'Tomar um banho demorado', texto: 'Cuidar de você também é produtivo.', acao: 'Feito', destino: null },
  { titulo: 'Arrumar um canto da mesa', texto: 'Cinco minutos e o olhar descansa.', acao: 'Começar 5 min', foco: 5 },
];

export const passoPequeno = (hoje) => PASSOS_PEQUENOS[Number(hoje.slice(8, 10)) % PASSOS_PEQUENOS.length];

// Versão mínima de cada hábito: 2 minutos ou uma unidade.
export function versaoMinima(h) {
  const meta = Number(h.meta) || 1;
  if (meta > 1) return `só 1 de ${meta}${h.unidade ? ` ${h.unidade}` : ''}`;
  return '2 minutos valem';
}
