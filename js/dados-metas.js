// Metas, quadro dos sonhos e lazer, sem tela: progresso (ligado a uma caixinha, hábito, projeto,
// lista de lazer, número manual ou marcos), ritmo até o prazo e a lista do que a Carol quer viver.

import { progressoCaixinha } from './dados-financas.js';
import { feitoNoDia, iso as isoH } from './dados-habitos.js';
import { progressoDoProjeto } from './dados-tarefas.js';

export const AREAS_VIDA = [
  { id: 'carreira', nome: 'Carreira', emoji: '💼' },
  { id: 'consultoria', nome: 'Consultoria', emoji: '🤝' },
  { id: 'criacao', nome: 'Criação', emoji: '🎥' },
  { id: 'estudos', nome: 'Estudos', emoji: '🎓' },
  { id: 'viagens', nome: 'Viagens', emoji: '✈️' },
  { id: 'casa', nome: 'Casa', emoji: '🏡' },
  { id: 'dinheiro', nome: 'Dinheiro', emoji: '💰' },
  { id: 'eu', nome: 'Eu', emoji: '🌷' },
];

export const TIPOS_LAZER = [
  { id: 'filme', nome: 'Filme', emoji: '🎬', palavras: ['filme'] },
  { id: 'serie', nome: 'Série', emoji: '📺', palavras: ['serie', 'série'] },
  { id: 'livro', nome: 'Livro', emoji: '📚', palavras: ['livro', 'ler'] },
  { id: 'lugar', nome: 'Lugar e viagem', emoji: '🗺️', palavras: ['lugar', 'viagem', 'viajar', 'passeio', 'conhecer'] },
  { id: 'cafe', nome: 'Café e restaurante', emoji: '☕', palavras: ['cafe', 'café', 'restaurante', 'comer', 'jantar', 'brunch'] },
  { id: 'evento', nome: 'Evento e show', emoji: '🎟️', palavras: ['evento', 'show', 'peca', 'peça', 'exposicao', 'exposição', 'festival'] },
  { id: 'outro', nome: 'Outro', emoji: '✨', palavras: [] },
];
export const STATUS_LAZER = [
  { id: 'quero', nome: 'Quero' },
  { id: 'fazendo', nome: 'Fazendo' },
  { id: 'feito', nome: 'Feito' },
];

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const ativas = (metas) => vivos(metas).filter((m) => m.status !== 'realizada' && m.status !== 'pausada');
export const realizadas = (metas) => vivos(metas).filter((m) => m.status === 'realizada')
  .sort((a, b) => String(b.dados?.realizada_em || '').localeCompare(String(a.dados?.realizada_em || '')));

// Progresso: { atual, alvo, fracao, texto } ou null (sonho só visual).
export function progressoDaMeta(m, dados, hoje = iso(new Date())) {
  const lig = m.dados?.ligacao || { tipo: 'nenhuma' };
  const inicio = String(m.dados?.inicio || m.criado_em || hoje).slice(0, 10);
  const pronto = (atual, alvo, texto) => ({ atual, alvo, fracao: alvo ? Math.min(1, Math.max(0, atual / alvo)) : 0, texto });
  if (lig.tipo === 'caixinha') {
    const c = vivos(dados.financas).find((x) => x.id === lig.id);
    if (!c) return null;
    const p = progressoCaixinha(c);
    const alvo = Number(m.alvo) || p.meta;
    return pronto(p.guardado, alvo, null);
  }
  if (lig.tipo === 'habito') {
    const h = vivos(dados.habitos).find((x) => x.id === lig.id);
    if (!h) return null;
    let feitos = 0;
    for (let d = inicio; d <= hoje; d = isoH(new Date(new Date(`${d}T12:00:00`).getTime() + 864e5))) if (feitoNoDia(dados.habitoRegistros, h, d)) feitos += 1;
    return pronto(feitos, Number(m.alvo) || 30, null);
  }
  if (lig.tipo === 'projeto') {
    const p = vivos(dados.projetos).find((x) => x.id === lig.id);
    if (!p) return null;
    const pr = progressoDoProjeto(p, dados.tarefas);
    return pronto(pr.prontas, pr.total || 1, `${pr.prontas} de ${pr.total} tarefas`);
  }
  if (lig.tipo === 'lazer') {
    const feitos = vivos(dados.lazer).filter((l) => l.status === 'feito' && (!lig.lazerTipo || l.tipo === lig.lazerTipo) && String(l.data || l.atualizado_em || '').slice(0, 10) >= inicio).length;
    return pronto(feitos, Number(m.alvo) || 12, null);
  }
  if (lig.tipo === 'marcos') {
    const marcos = m.dados?.marcos || [];
    if (!marcos.length) return null;
    const feitos = marcos.filter((x) => x.feito).length;
    return pronto(feitos, marcos.length, `${feitos} de ${marcos.length} etapas`);
  }
  if (lig.tipo === 'manual' && Number(m.alvo) > 0) return pronto(Number(m.atual) || 0, Number(m.alvo), null);
  return null;
}

// Ritmo até o prazo: compara o feito com o esperado para hoje.
export function ritmoDaMeta(m, progresso, hoje = iso(new Date())) {
  if (!progresso || !m.prazo) return null;
  if (progresso.fracao >= 1) return { estado: 'pronta', texto: 'Meta alcançada!' };
  const inicio = String(m.dados?.inicio || m.criado_em || hoje).slice(0, 10);
  const total = Math.max(1, dias(inicio, m.prazo));
  const passado = Math.min(total, Math.max(0, dias(inicio, hoje)));
  const restam = dias(hoje, m.prazo);
  if (restam < 0) return { estado: 'atrasada', texto: 'O prazo passou. Que tal um prazo novo?' };
  const esperado = passado / total;
  const falta = Math.max(0, progresso.alvo - progresso.atual);
  const quando = restam === 0 ? 'hoje' : restam === 1 ? 'amanhã' : `em ${restam} dias`;
  if (progresso.fracao + 0.05 >= esperado) return { estado: 'no-ritmo', texto: `No ritmo para chegar ${quando}.`, falta, restam };
  return { estado: 'acelerar', texto: `Dá para acelerar: falta ${Math.round(progresso.fracao * 100) < 100 ? `${100 - Math.round(progresso.fracao * 100)}%` : 'pouco'} e o prazo é ${quando}.`, falta, restam };
}

// Lazer: "filme Duna 2", "lugar Pirenópolis 300", "café Santo Grão"
export function lerLazer(texto) {
  let resto = ` ${String(texto || '').trim()} `;
  let custo = null;
  // Número no fim vira custo só com "R$" ou a partir de 10 (assim "Duna 2" continua sendo o título).
  const valor = resto.match(/\s(r\$\s?)?(\d+(?:[.,]\d{1,2})?)\s*$/i);
  if (valor && (valor[1] || Number(valor[2].replace(',', '.')) >= 10)) {
    custo = Number(valor[2].replace(',', '.'));
    resto = resto.slice(0, valor.index);
  }
  const primeira = semAcento(resto.trim().split(/\s+/)[0] || '');
  let tipo = TIPOS_LAZER.find((t) => t.palavras.some((p) => semAcento(p) === primeira));
  if (tipo) resto = resto.trim().split(/\s+/).slice(1).join(' ');
  tipo = tipo || TIPOS_LAZER.find((t) => t.id === 'outro');
  return { tipo: tipo.id, titulo: resto.replace(/\s+/g, ' ').trim(), custo };
}

export function sortearLazer(lazer, tipo = '', aleatorio = Math.random) {
  const opcoes = vivos(lazer).filter((l) => l.status === 'quero' && (!tipo || l.tipo === tipo));
  return opcoes.length ? opcoes[Math.floor(aleatorio() * opcoes.length)] : null;
}

// Ideias para o fim de semana: as mesmas a semana toda (escolhidas pelo número da semana).
export function ideiasDoFimDeSemana(lazer, hoje = new Date(), quantas = 3) {
  const opcoes = vivos(lazer).filter((l) => l.status === 'quero');
  if (!opcoes.length) return [];
  const semana = Math.floor(hoje.getTime() / (7 * 864e5));
  const ordenadas = [...opcoes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return Array.from({ length: Math.min(quantas, ordenadas.length) }, (_, i) => ordenadas[(semana * 7 + i * 3) % ordenadas.length])
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

// Sonho do dia (para o Hoje): um dos ativos com imagem, trocando todo dia.
export function sonhoDoDia(metas, hoje = new Date()) {
  const lista = ativas(metas).filter((m) => m.dados?.imagem).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!lista.length) return null;
  const dia = Math.floor(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 864e5);
  return lista[dia % lista.length];
}

// Link do Spotify → endereço do player embutido.
export function spotifyEmbed(link) {
  const m = String(link || '').match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : null;
}
