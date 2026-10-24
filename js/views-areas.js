// Telas que ainda vão ser construídas: por enquanto mostram o que vem e em qual etapa.

import { cabecalho, emConstrucao } from './componentes.js';

const AREAS = {
  faculdade: {
    sub: 'UniEVANGÉLICA, integrada ao AVA',
    icone: 'faculdade',
    titulo: 'Suas disciplinas aparecem aqui',
    texto: 'Depois de conectar o AVA, este painel mostra tudo da faculdade num lugar só.',
    itens: ['Painel geral e um painel por disciplina', 'Materiais, atividades e prazos', 'Notas, frequência e avisos', 'Cadernos e questões de cada disciplina'],
    etapa: '4',
  },
  estudos: {
    sub: 'O que você estuda por conta própria',
    icone: 'estudos',
    titulo: 'Trilhas e temas',
    texto: 'Um painel para organizar os estudos fora da faculdade.',
    itens: ['Trilhas ou temas com progresso', 'Biblioteca filtrada pelo tema', 'Cadernos e questões do tema'],
    etapa: '8',
  },
  substack: {
    sub: 'Pautas, rascunhos e meta de publicação',
    icone: 'substack',
    titulo: 'Seu espaço de escrita',
    texto: 'Das ideias até o texto publicado.',
    itens: ['Pautas em etapas: ideia → rascunho → revisão → publicado', 'Editor de rascunho', 'Referências da Biblioteca ligadas a cada texto', 'Meta de publicação'],
    etapa: '8',
  },
  biblioteca: {
    sub: 'Artigos, PDFs e textos salvos',
    icone: 'biblioteca',
    titulo: 'Sua biblioteca de leitura',
    texto: 'Guarde o que você lê e encontre depois com facilidade.',
    itens: ['Adicionar por link, PDF ou texto colado', 'Tags, área e status (ler / lendo / lido / fichado)', 'Destaques e notas'],
    etapa: '6',
  },
  cadernos: {
    sub: 'Escrita à mão com a S Pen',
    icone: 'cadernos',
    titulo: 'Estantes e cadernos',
    texto: 'Cadernos no estilo GoodNotes, com pressão da caneta e vários modelos de folha.',
    itens: ['Caderno comum, por matéria, fichário, PDF, quadro infinito e planner', 'Canetas, marca-texto, borracha, laço e formas', 'Modelos de folha: pautada, quadriculada, Cornell, flashcards e muitos outros', 'Exportar em PDF ou PNG'],
    etapa: '5',
    acao: { href: '#caneta', rotulo: 'Testar a caneta (protótipo)' },
  },
  questoes: {
    sub: 'Gerador com IA, banco e revisão',
    icone: 'questoes',
    titulo: 'Gerador de questões',
    texto: 'Questões criadas a partir de um tema, um artigo, um material do AVA ou uma página de caderno.',
    itens: ['Modo prova: múltipla escolha e verdadeiro/falso', 'Modo fixação: a IA corrige a sua resposta', 'Gabarito comentado com fontes', 'Revisão das erradas em 1, 3, 7 e 15 dias'],
    etapa: '7',
  },
  calendario: {
    sub: 'Prazos, provas e eventos próprios',
    icone: 'calendario',
    titulo: 'Calendário da faculdade e o seu',
    texto: 'Tudo o que tem data, num lugar só.',
    itens: ['Visão de mês, semana e lista', 'Prazos e provas do AVA', 'Calendário acadêmico importado do PDF', 'Eventos que você cria e avisos 3 dias / 1 dia / no dia'],
    etapa: '4',
  },
};

export function criarViewArea(rota) {
  const area = AREAS[rota.id];
  return () => `
    ${cabecalho(rota.titulo, area.sub)}
    ${emConstrucao(area)}`;
}

export const IDS_AREAS = Object.keys(AREAS);
