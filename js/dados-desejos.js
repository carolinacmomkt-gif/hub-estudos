// Lista de desejos (Meu cantinho, parte 2): o que você gostaria de ter, sem preço e sem pressa.
// É separada do "Esperar 48h" das Finanças (config "desejos"): aqui não entra dinheiro.
// Fica em config "lista_desejos" { lista: [{ id, nome, porque, link, criado_em, estado }] }.

import { novoId } from './dados-cuidar.js';

export const listaDesejosDe = (config) => (config || []).find((c) => c.chave === 'lista_desejos' && !c.excluido_em)?.valor?.lista || [];

export function novoDesejoDaLista({ nome, porque = '', link = '' }, agora = Date.now()) {
  const l = String(link || '').trim();
  return {
    id: novoId(), nome: String(nome || '').trim().slice(0, 80), porque: String(porque || '').trim().slice(0, 160),
    link: /^https?:\/\//i.test(l) ? l.slice(0, 500) : '', criado_em: new Date(agora).toISOString(), estado: null, decidido_em: null,
  };
}

export const desejosAbertos = (lista) => (lista || []).filter((d) => !d.estado);
export const desejosRealizados = (lista) => (lista || []).filter((d) => d.estado === 'ganhei').sort((a, b) => String(b.decidido_em).localeCompare(String(a.decidido_em)));

export function diasEsperando(d, agora = Date.now()) {
  return Math.max(0, Math.floor((agora - Date.parse(d.criado_em)) / 86400000));
}

export function textoEsperando(d, agora = Date.now()) {
  const n = diasEsperando(d, agora);
  if (n === 0) return 'entrou hoje';
  if (n === 1) return 'esperando há 1 dia';
  if (n >= 30) return `esperando há ${Math.round(n / 30)} ${Math.round(n / 30) === 1 ? 'mês' : 'meses'}`;
  return `esperando há ${n} dias`;
}
