// Estudos gerais: trilhas (com etapas para marcar) e temas, usando a tabela areas.
// Cada trilha ou tema junta os artigos, cadernos e questões ligados a ele.

import { artigosAtivos } from './dados-biblioteca.js';

export const TIPOS_AREA = [
  { id: 'trilha', nome: 'Trilha', descricao: 'Um caminho com etapas em ordem (ex.: um curso, um livro por capítulos).' },
  { id: 'tema', nome: 'Tema', descricao: 'Um assunto que você acompanha (ex.: Filosofia, Marketing).' },
];
export const CORES_AREA = [1, 2, 3, 4, 5, 6];

export function areasAtivas(estado) {
  return (estado.areas || []).filter((a) => !a.excluido_em)
    .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

export function areaPeloId(estado, id) {
  return areasAtivas(estado).find((a) => a.id === id) || null;
}

export const nomeDaArea = (estado, id) => (id ? areaPeloId(estado, id)?.nome || '' : '');

export function conteudoDaArea(estado, id) {
  const artigos = artigosAtivos(estado).filter((a) => a.area_id === id);
  const cadernos = (estado.cadernos || []).filter((c) => !c.excluido_em && c.area_id === id);
  return { artigos, cadernos };
}

// Progresso: trilha = etapas feitas; tema = leituras terminadas (lido ou fichado).
export function progressoDaArea(estado, area) {
  if (area.tipo === 'trilha') {
    const itens = Array.isArray(area.itens) ? area.itens : [];
    const feitos = itens.filter((i) => i.feito).length;
    return {
      fracao: itens.length ? feitos / itens.length : 0,
      detalhe: itens.length ? `${feitos} de ${itens.length} etapas` : 'Sem etapas ainda',
    };
  }
  const { artigos } = conteudoDaArea(estado, area.id);
  const lidos = artigos.filter((a) => a.status === 'lido' || a.status === 'fichado').length;
  return { fracao: artigos.length ? lidos / artigos.length : 0, detalhe: artigos.length ? `${lidos} de ${artigos.length} leituras` : 'Sem leituras' };
}

export function proximaEtapa(area) {
  return (Array.isArray(area.itens) ? area.itens : []).find((i) => !i.feito) || null;
}

export function novoItem(texto) {
  return { id: crypto.randomUUID().slice(0, 8), texto: String(texto).trim().slice(0, 200), feito: false };
}
