// Menu do app: grupos com título que abrem e fecham (como no Notion), favoritos no topo,
// itens escondidos e os 4 atalhos da barra do celular. A organização fica em config
// (chave "menu", vale em todos os aparelhos); o jeito de mostrar (aberto, só ícones ou
// escondido) é de cada aparelho.

import { obterEstado } from './estado.js';
import { ROTAS } from './rotas.js';
import { listar, salvar } from './persistencia.js';

export const GRUPOS_PADRAO = [
  { id: 'dia', nome: 'Meu dia' },
  { id: 'faculdade', nome: 'Faculdade' },
  { id: 'estudos', nome: 'Estudos' },
  { id: 'criacao', nome: 'Criação' },
  { id: 'consultoria', nome: 'Consultoria' },
  { id: 'vida', nome: 'Vida' },
];
export const MODOS_MENU = [
  { id: 'aberto', nome: 'Aberto, com os nomes' },
  { id: 'icones', nome: 'Só os ícones' },
  { id: 'oculto', nome: 'Escondido' },
];
const CHAVE_MODO = 'hub.menu.modo';
const MAX_CELULAR = 4;

const rotaPeloId = (id) => ROTAS.find((r) => r.id === id);

function guardado(estado) {
  return (estado.config || []).find((c) => c.chave === 'menu' && !c.excluido_em)?.valor || {};
}

// Organização atual, já completada: rota nova (de uma atualização do app) entra no grupo dela.
export function organizacaoDoMenu(estado = obterEstado()) {
  const v = guardado(estado);
  const grupos = (Array.isArray(v.grupos) && v.grupos.length ? v.grupos : GRUPOS_PADRAO.map((g) => ({ ...g, itens: [] })))
    .map((g) => ({ id: g.id, nome: g.nome, aberto: g.aberto !== false, itens: (g.itens || []).filter(rotaPeloId) }));
  const colocados = new Set(grupos.flatMap((g) => g.itens));
  for (const r of ROTAS) {
    if (colocados.has(r.id)) continue;
    let g = grupos.find((x) => x.id === r.grupo);
    if (!g) {
      const padrao = GRUPOS_PADRAO.find((x) => x.id === r.grupo) || { id: r.grupo || 'outros', nome: 'Outros' };
      g = { ...padrao, aberto: true, itens: [] };
      grupos.push(g);
    }
    g.itens.push(r.id);
  }
  const escondidos = new Set((v.escondidos || []).filter(rotaPeloId));
  escondidos.delete('inicio'); // o Hoje nunca some
  const favoritos = (v.favoritos || []).filter((id) => rotaPeloId(id) && !escondidos.has(id));
  const padraoCelular = ROTAS.filter((r) => r.fixaCelular).map((r) => r.id);
  const celular = (Array.isArray(v.celular) && v.celular.length ? v.celular : padraoCelular).filter((id) => rotaPeloId(id) && !escondidos.has(id)).slice(0, MAX_CELULAR);
  return { grupos, escondidos, favoritos, celular };
}

export async function mudarMenu(fn) {
  const atual = (await listar('config')).find((c) => c.chave === 'menu');
  const org = organizacaoDoMenu(obterEstado());
  const valor = {
    grupos: org.grupos.map((g) => ({ id: g.id, nome: g.nome, aberto: g.aberto, itens: [...g.itens] })),
    escondidos: [...org.escondidos], favoritos: [...org.favoritos], celular: [...org.celular],
  };
  fn(valor);
  return salvar('config', { ...(atual || {}), chave: 'menu', valor });
}

// Modo de mostrar o menu neste aparelho. Tablet em pé começa só com ícones.
const tipoDeTela = () => (window.innerWidth >= 1100 ? 'largo' : 'medio');

export function modoDoMenu() {
  try {
    const v = localStorage.getItem(`${CHAVE_MODO}.${tipoDeTela()}`);
    if (MODOS_MENU.some((m) => m.id === v)) return v;
  } catch {
    // sem armazenamento
  }
  return tipoDeTela() === 'largo' ? 'aberto' : 'icones';
}

let animacao = null;

export function definirModoDoMenu(modo) {
  document.body.classList.add('menu-animando');
  clearTimeout(animacao);
  animacao = setTimeout(() => document.body.classList.remove('menu-animando'), 300);
  try {
    localStorage.setItem(`${CHAVE_MODO}.${tipoDeTela()}`, modo);
  } catch {
    // vale só agora
  }
  document.body.dataset.menu = modo;
}

// Botão do topo do menu: aberto → só ícones → escondido; o ☰ flutuante traz de volta.
export function proximoModo(modo) {
  return modo === 'aberto' ? 'icones' : modo === 'icones' ? 'oculto' : 'aberto';
}

export { rotaPeloId, MAX_CELULAR };
