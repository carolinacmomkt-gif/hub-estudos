// Dados de exemplo para a Etapa 1. Os horários são relativos a "agora",
// para a contagem regressiva e as cores de urgência sempre aparecerem.
// Saem de cena na Etapa 2 (Supabase) e na Etapa 4 (AVA).

import { HORA, DIA } from './utilidades.js';

export function gerarDadosExemplo(agora = Date.now()) {
  return {
    nome: 'Carol',

    eventos: [
      { id: 'ev1', tipo: 'trabalho', titulo: 'Resenha crítica do capítulo 3', disciplina: 'Metodologia Científica', prazo: agora - 5 * HORA, status: 'pendente' },
      { id: 'ev2', tipo: 'atividade', titulo: 'Fórum: comunicação e redes sociais', disciplina: 'Comunicação e Sociedade', prazo: agora + 20 * HORA, status: 'pendente' },
      { id: 'ev3', tipo: 'trabalho', titulo: 'Estudo de caso em grupo', disciplina: 'Marketing Estratégico', prazo: agora + 3 * DIA, status: 'pendente' },
      { id: 'ev4', tipo: 'prova', titulo: 'Prova N1', disciplina: 'Estatística Aplicada', prazo: agora + 5 * DIA, status: 'pendente' },
      { id: 'ev5', tipo: 'atividade', titulo: 'Questionário da unidade 2', disciplina: 'Comunicação e Sociedade', prazo: agora + 6 * DIA, status: 'entregue' },
      { id: 'ev6', tipo: 'prova', titulo: 'Prova N1', disciplina: 'Metodologia Científica', prazo: agora + 12 * DIA, status: 'pendente' },
    ],

    revisoes: [
      { disciplina: 'Estatística Aplicada', quantidade: 4 },
      { disciplina: 'Metodologia Científica', quantidade: 2 },
      { disciplina: 'Estudos gerais', quantidade: 1 },
    ],

    notas: [
      { disciplina: 'Comunicação e Sociedade', item: 'Atividade avaliativa 1', nota: 9, maximo: 10, data: agora - 1 * DIA },
      { disciplina: 'Marketing Estratégico', item: 'Seminário', nota: 8.5, maximo: 10, data: agora - 3 * DIA },
      { disciplina: 'Estatística Aplicada', item: 'Lista de exercícios 2', nota: 7, maximo: 10, data: agora - 6 * DIA },
    ],

    cadernos: [
      { id: 'c1', titulo: 'Estatística', disciplina: 'Estatística Aplicada', capa: 3, paginas: 18, editadoEm: agora - 2 * HORA },
      { id: 'c2', titulo: 'Metodologia', disciplina: 'Metodologia Científica', capa: 1, paginas: 24, editadoEm: agora - 1 * DIA },
      { id: 'c3', titulo: 'Ideias para o Substack', disciplina: 'Substack', capa: 5, paginas: 9, editadoEm: agora - 3 * DIA },
      { id: 'c4', titulo: 'Marketing', disciplina: 'Marketing Estratégico', capa: 4, paginas: 12, editadoEm: agora - 5 * DIA },
    ],

    areas: [
      { id: 'faculdade', nome: 'Faculdade', detalhe: '12 de 19 atividades entregues no semestre', progresso: 12 / 19 },
      { id: 'estudos', nome: 'Estudos gerais', detalhe: '2 de 5 temas da trilha concluídos', progresso: 2 / 5 },
      { id: 'substack', nome: 'Substack', detalhe: 'Meta do mês: 2 de 4 textos publicados', progresso: 2 / 4 },
    ],

    leituras: [
      { titulo: 'O que é pesquisa qualitativa', status: 'lendo' },
    ],
  };
}
