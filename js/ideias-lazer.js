// Ideias de lazer no gosto da Carol (Anápolis, Goiânia, Brasília, cafés, cinema, drive-thru,
// livros e shopping). A lista começa com algumas e ganha 3 novas por semana, sempre as mesmas
// em todos os aparelhos (cada ideia tem um id fixo, então nada se repete nem volta depois de excluída).

import { listar, salvar, situacaoSincronizacao } from './persistencia.js';
import { nuvemConfigurada } from './nuvem.js';

// Em ordem de chegada: as 8 primeiras entram de uma vez, depois 3 por semana.
export const IDEIAS_LAZER = [
  { id: 'drive-sorvete', tipo: 'cafe', titulo: 'Drive-thru + sorvete no carro com música boa', custo: 35 },
  { id: 'cinema-semana', tipo: 'filme', titulo: 'Cinema no meio da semana (sala vazia e mais barato)', custo: 45 },
  { id: 'livro-tudo-e-rio', tipo: 'livro', titulo: 'Tudo é rio, de Carla Madeira', custo: 55 },
  { id: 'goiania-vaca-brava', tipo: 'lugar', titulo: 'Fim de tarde no Parque Vaca Brava (Goiânia)', custo: 0 },
  { id: 'cafe-novo-anapolis', tipo: 'cafe', titulo: 'Conhecer um café novo em Anápolis', custo: 30 },
  { id: 'brasilia-pontao', tipo: 'lugar', titulo: 'Pôr do sol no Pontão do Lago Sul (Brasília)', custo: 40 },
  { id: 'filme-ainda-estou-aqui', tipo: 'filme', titulo: 'Ainda Estou Aqui (Walter Salles)', custo: 0 },
  { id: 'shopping-flamboyant', tipo: 'lugar', titulo: 'Passeio no Flamboyant Shopping (Goiânia)', custo: 0 },
  { id: 'livro-torto-arado', tipo: 'livro', titulo: 'Torto Arado, de Itamar Vieira Junior', custo: 55 },
  { id: 'goiania-feira-hippie', tipo: 'lugar', titulo: 'Feira Hippie de domingo (Goiânia)', custo: 60 },
  { id: 'brunch-domingo', tipo: 'cafe', titulo: 'Brunch de domingo sem pressa', custo: 70 },
  { id: 'brasilia-ccbb', tipo: 'evento', titulo: 'Exposição no CCBB Brasília', custo: 0 },
  { id: 'serie-gilmore', tipo: 'serie', titulo: 'Gilmore Girls (para rever com café)', custo: 0 },
  { id: 'livro-cora', tipo: 'livro', titulo: 'Poemas dos Becos de Goiás e Estórias Mais, de Cora Coralina', custo: 45 },
  { id: 'goiania-feira-lua', tipo: 'lugar', titulo: 'Feira da Lua no sábado (Goiânia)', custo: 50 },
  { id: 'drive-madrugada', tipo: 'cafe', titulo: 'Drive-thru de batata frita e conversa longa', custo: 30 },
  { id: 'brasilia-torre', tipo: 'lugar', titulo: 'Torre de TV e Feira da Torre (Brasília)', custo: 40 },
  { id: 'cinema-pre-estreia', tipo: 'filme', titulo: 'Pré-estreia de um filme que você está esperando', custo: 50 },
  { id: 'livro-psicologia-financeira', tipo: 'livro', titulo: 'A Psicologia Financeira, de Morgan Housel', custo: 50 },
  { id: 'pirenopolis', tipo: 'lugar', titulo: 'Fim de semana em Pirenópolis', custo: 400 },
  { id: 'cafe-livro', tipo: 'cafe', titulo: 'Tarde de café com um livro na bolsa', custo: 30 },
  { id: 'goiania-niemeyer', tipo: 'evento', titulo: 'Centro Cultural Oscar Niemeyer (Goiânia)', custo: 0 },
  { id: 'serie-anne', tipo: 'serie', titulo: 'Anne with an E', custo: 0 },
  { id: 'brasilia-ermida', tipo: 'lugar', titulo: 'Pôr do sol na Ermida Dom Bosco (Brasília)', custo: 0 },
  { id: 'livraria-garimpo', tipo: 'livro', titulo: 'Garimpar livros numa livraria sem lista pronta', custo: 80 },
  { id: 'anapolis-ipiranga', tipo: 'lugar', titulo: 'Caminhada no Parque Ipiranga (Anápolis)', custo: 0 },
  { id: 'filme-estrelas', tipo: 'filme', titulo: 'Estrelas Além do Tempo', custo: 0 },
  { id: 'cidade-de-goias', tipo: 'lugar', titulo: 'Cidade de Goiás e a Casa de Cora Coralina', custo: 350 },
  { id: 'shopping-iguatemi-bsb', tipo: 'lugar', titulo: 'Passeio no Iguatemi Brasília', custo: 0 },
  { id: 'livro-hora-estrela', tipo: 'livro', titulo: 'A Hora da Estrela, de Clarice Lispector', custo: 35 },
  { id: 'cafe-especial-metodo', tipo: 'cafe', titulo: 'Provar um café especial em outro método (V60, prensa)', custo: 25 },
  { id: 'brasilia-jardim-botanico', tipo: 'lugar', titulo: 'Jardim Botânico de Brasília', custo: 10 },
  { id: 'cinema-classico', tipo: 'filme', titulo: 'Noite de clássico em casa: O Diabo Veste Prada', custo: 0 },
  { id: 'goiania-bosque-buritis', tipo: 'lugar', titulo: 'Bosque dos Buritis (Goiânia)', custo: 0 },
  { id: 'livro-teto-todo-seu', tipo: 'livro', titulo: 'Um Teto Todo Seu, de Virginia Woolf', custo: 40 },
  { id: 'drive-pipoca-filme', tipo: 'cafe', titulo: 'Drive-thru para levar e sessão de filme em casa', custo: 40 },
  { id: 'brasilia-museu-nacional', tipo: 'evento', titulo: 'Museu Nacional da República (Brasília)', custo: 0 },
  { id: 'serie-only-murders', tipo: 'serie', titulo: 'Only Murders in the Building', custo: 0 },
  { id: 'goiania-jardim-botanico', tipo: 'lugar', titulo: 'Jardim Botânico de Goiânia', custo: 0 },
  { id: 'livro-avesso-da-pele', tipo: 'livro', titulo: 'O Avesso da Pele, de Jeferson Tenório', custo: 50 },
  { id: 'show-goiania', tipo: 'evento', titulo: 'Show ou peça no fim de semana em Goiânia', custo: 120 },
  { id: 'cafe-da-tarde-doce', tipo: 'cafe', titulo: 'Café da tarde com doce de padaria artesanal', custo: 35 },
  { id: 'brasilia-catedral', tipo: 'lugar', titulo: 'Catedral e Esplanada dos Ministérios (Brasília)', custo: 0 },
  { id: 'filme-central-brasil', tipo: 'filme', titulo: 'Central do Brasil', custo: 0 },
  { id: 'shopping-anapolis', tipo: 'lugar', titulo: 'Volta no Brasil Park Shopping (Anápolis)', custo: 0 },
  { id: 'livro-habitos-atomicos', tipo: 'livro', titulo: 'Hábitos Atômicos, de James Clear', custo: 50 },
  { id: 'piquenique', tipo: 'lugar', titulo: 'Piquenique simples no parque (pão, fruta e café)', custo: 40 },
  { id: 'brasilia-parque-cidade', tipo: 'lugar', titulo: 'Bicicleta no Parque da Cidade (Brasília)', custo: 20 },
  { id: 'cinema-maratona', tipo: 'filme', titulo: 'Duas sessões seguidas no cinema (dia de folga)', custo: 90 },
  { id: 'livro-mulheres-lobos', tipo: 'livro', titulo: 'Mulheres que Correm com os Lobos, de Clarissa Pinkola Estés', custo: 70 },
];

// Id fixo (formato uuid) para cada ideia: o mesmo em qualquer aparelho.
export function idDaIdeia(chave) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const texto = `lazer-ideia:${chave}`;
  for (let i = 0; i < texto.length; i += 1) {
    h1 = Math.imul(h1 ^ texto.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + texto.charCodeAt(i), 2246822519) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex(Math.imul(h1 ^ h2, 3266489917) >>> 0);
  const d = hex(Math.imul(h2 ^ 0x9e3779b9, 668265263) >>> 0);
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`;
}

const INICIAIS = 8;
const POR_SEMANA = 3;
const SEMANA = 7 * 864e5;
// Semana 0 = a semana em que as ideias começaram a entrar (fixa, igual em todo aparelho).
const INICIO = Date.UTC(2026, 9, 26); // segunda, 26/10/2026

export function quantasIdeias(agora = Date.now()) {
  const semanas = Math.max(0, Math.floor((agora - INICIO) / SEMANA));
  return Math.min(IDEIAS_LAZER.length, INICIAIS + semanas * POR_SEMANA);
}

let semeando = null;

// Coloca no Lazer as ideias que já chegaram e ainda não estão lá. Só roda depois de o aparelho
// receber o que está na nuvem (senão poderia repor uma ideia já feita ou excluída noutro aparelho).
export function semearLazer(agora = Date.now()) {
  if (semeando) return semeando;
  semeando = (async () => {
    if (nuvemConfigurada() && !situacaoSincronizacao().ultima) return 0;
    const existentes = new Set((await listar('lazer', { incluirExcluidos: true })).map((l) => l.id));
    let novas = 0;
    for (const ideia of IDEIAS_LAZER.slice(0, quantasIdeias(agora))) {
      const id = idDaIdeia(ideia.id);
      if (existentes.has(id)) continue;
      await salvar('lazer', { id, tipo: ideia.tipo, titulo: ideia.titulo, status: 'quero', dados: { custo: ideia.custo || null, sugestao: ideia.id } });
      novas += 1;
    }
    return novas;
  })().finally(() => { semeando = null; });
  return semeando;
}
