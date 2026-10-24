// Telas que ainda vão ser construídas: por enquanto mostram o que vem e em qual etapa.

import { cabecalho, emConstrucao } from './componentes.js';

const AREAS = {
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
  questoes: {
    sub: 'Gerador com IA, banco e revisão',
    icone: 'questoes',
    titulo: 'Gerador de questões',
    texto: 'Questões criadas a partir de um tema, um artigo, um material do AVA ou uma página de caderno.',
    itens: ['Modo prova: múltipla escolha e verdadeiro/falso', 'Modo fixação: a IA corrige a sua resposta', 'Gabarito comentado com fontes', 'Revisão das erradas em 1, 3, 7 e 15 dias'],
    etapa: '7',
  },
};

export function criarViewArea(rota) {
  const area = AREAS[rota.id];
  return () => `
    ${cabecalho(rota.titulo, area.sub)}
    ${emConstrucao(area)}`;
}

export const IDS_AREAS = Object.keys(AREAS);
