// YouTube: etapas do vídeo, modelos de roteiro, duração estimada, capítulos e checklist.
// Funções puras (sem tela), usadas pelo painel e pela página de cada vídeo.

export const ETAPAS = [
  { id: 'ideia', nome: 'Ideia' },
  { id: 'pesquisa', nome: 'Pesquisa' },
  { id: 'roteiro', nome: 'Roteiro' },
  { id: 'gravacao', nome: 'Gravação' },
  { id: 'edicao', nome: 'Edição' },
  { id: 'pos', nome: 'Thumb e SEO' },
  { id: 'agendado', nome: 'Agendado' },
  { id: 'publicado', nome: 'Publicado' },
];

export const FORMATOS = [
  { id: 'longo', nome: 'Vídeo longo' },
  { id: 'short', nome: 'Short' },
  { id: 'live', nome: 'Live' },
];

export const TIPOS_BLOCO = [
  { id: 'gancho', nome: 'Gancho' },
  { id: 'intro', nome: 'Promessa / intro' },
  { id: 'bloco', nome: 'Bloco' },
  { id: 'cta', nome: 'Chamada (CTA)' },
  { id: 'final', nome: 'Final' },
];

// Estruturas prontas. Gancho curto, blocos com mini-gancho e CTA lá pelo meio do vídeo.
export const MODELOS_ROTEIRO = {
  longo: [
    { tipo: 'gancho', titulo: 'Gancho (até 15 s)', texto: '', dica: 'Promessa forte, número ou pergunta. Leia em voz alta antes de gravar.' },
    { tipo: 'intro', titulo: 'O que a pessoa vai ganhar', texto: '', dica: 'Diga em uma frase por que vale assistir até o fim.' },
    { tipo: 'bloco', titulo: 'Bloco 1', texto: '', dica: 'Abra com um mini-gancho que puxa para o próximo bloco.' },
    { tipo: 'bloco', titulo: 'Bloco 2', texto: '', dica: 'Exemplo real ou história.' },
    { tipo: 'cta', titulo: 'Chamada no meio', texto: '', dica: 'Inscrição, comentário ou link: funciona melhor lá pelos 60–70% do vídeo.' },
    { tipo: 'bloco', titulo: 'Bloco 3', texto: '', dica: 'Feche a promessa do começo.' },
    { tipo: 'final', titulo: 'Final e tela final', texto: '', dica: 'Recapitule e indique o próximo vídeo (sem "é isso, tchau").' },
  ],
  short: [
    { tipo: 'gancho', titulo: 'Gancho (2 s)', texto: '', dica: 'A primeira frase já é o assunto.' },
    { tipo: 'bloco', titulo: 'Conteúdo', texto: '', dica: 'Uma ideia só, sem introdução.' },
    { tipo: 'final', titulo: 'Fecho em loop', texto: '', dica: 'Termine numa frase que encaixa com o começo.' },
  ],
  live: [
    { tipo: 'intro', titulo: 'Abertura', texto: '', dica: 'Tema da live e o que vai acontecer.' },
    { tipo: 'bloco', titulo: 'Pauta', texto: '', dica: 'Tópicos em ordem.' },
    { tipo: 'cta', titulo: 'Chamadas', texto: '', dica: 'Quando pedir perguntas e inscrição.' },
    { tipo: 'final', titulo: 'Encerramento', texto: '', dica: 'Próxima live ou vídeo.' },
  ],
};

export const CHECKLIST = [
  { id: 'roteiro', nome: 'Roteiro revisado', etapa: 'roteiro' },
  { id: 'gancho-voz', nome: 'Gancho lido em voz alta', etapa: 'roteiro' },
  { id: 'cenario', nome: 'Cenário, luz e áudio testados', etapa: 'gravacao' },
  { id: 'gravado', nome: 'Gravado', etapa: 'gravacao' },
  { id: 'broll', nome: 'B-roll e telas', etapa: 'edicao' },
  { id: 'editado', nome: 'Edição pronta', etapa: 'edicao' },
  { id: 'legendas', nome: 'Legendas', etapa: 'edicao' },
  { id: 'thumb', nome: 'Thumbnail', etapa: 'pos' },
  { id: 'titulo', nome: 'Título final escolhido', etapa: 'pos' },
  { id: 'descricao', nome: 'Descrição, tags e capítulos', etapa: 'pos' },
  { id: 'tela-final', nome: 'Tela final e cards', etapa: 'pos' },
  { id: 'agendado', nome: 'Agendado no YouTube Studio', etapa: 'agendado' },
];

const PALAVRAS_POR_MINUTO = 150;

export const contarPalavras = (texto) => (String(texto || '').trim().match(/\S+/g) || []).length;

export function palavrasDoRoteiro(video) {
  return (video.roteiro?.blocos || []).reduce((s, b) => s + contarPalavras(b.texto), 0);
}

// "8:30" a partir das palavras (fala de ~150 palavras por minuto).
export function duracao(segundos) {
  const s = Math.round(segundos);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function duracaoEstimada(video) {
  return (palavrasDoRoteiro(video) / PALAVRAS_POR_MINUTO) * 60;
}

// Capítulos para a descrição: "0:00 Título" de cada bloco, pela duração estimada.
// O YouTube pede o primeiro em 0:00 e pelo menos 3 capítulos de 10 s ou mais.
export function capitulos(video) {
  // Só entram blocos com fala de uns 10 s ou mais (25 palavras); a chamada (CTA) não vira capítulo.
  const blocos = (video.roteiro?.blocos || []).filter((b) => contarPalavras(b.texto) > 0);
  let tempo = 0;
  const linhas = [];
  for (const b of blocos) {
    const palavras = contarPalavras(b.texto);
    if (b.tipo !== 'cta' && (palavras >= 25 || !linhas.length)) linhas.push(`${duracao(tempo)} ${limparTitulo(b.titulo) || 'Parte'}`);
    tempo += (palavras / PALAVRAS_POR_MINUTO) * 60;
  }
  return linhas.length >= 3 ? linhas.join('\n') : '';
}

const limparTitulo = (t) => String(t || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();

export function progressoChecklist(video) {
  const feitos = CHECKLIST.filter((c) => video.checklist?.[c.id]).length;
  return { feitos, total: CHECKLIST.length, fracao: feitos / CHECKLIST.length };
}

export function videosAtivos(estado) {
  return (estado.videos || []).filter((v) => !v.excluido_em);
}

const ORDEM_ETAPA = Object.fromEntries(ETAPAS.map((e, i) => [e.id, i]));

export function videosDaEtapa(estado, etapa) {
  return videosAtivos(estado)
    .filter((v) => v.etapa === etapa)
    .sort((a, b) => (a.data_publicacao || '9999').localeCompare(b.data_publicacao || '9999') || (a.prioridade - b.prioridade) || (a.ordem - b.ordem));
}

export function etapaVizinha(etapa, passo) {
  const i = ORDEM_ETAPA[etapa] ?? 0;
  return ETAPAS[Math.max(0, Math.min(ETAPAS.length - 1, i + passo))].id;
}

// Próximo vídeo a sair (com data de publicação no futuro e ainda não publicado).
export function proximoAPublicar(estado, agora = Date.now()) {
  return videosAtivos(estado)
    .filter((v) => v.etapa !== 'publicado' && v.data_publicacao && new Date(v.data_publicacao).getTime() >= agora - 60 * 60 * 1000)
    .sort((a, b) => a.data_publicacao.localeCompare(b.data_publicacao))[0] || null;
}

// Meta de publicação: vídeos publicados (ou com data) na semana atual (segunda a domingo).
export function metaDaSemana(estado, meta, agora = Date.now()) {
  const d = new Date(agora);
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7);
  const daSemana = videosAtivos(estado).filter((v) => {
    if (!v.data_publicacao) return false;
    const t = new Date(v.data_publicacao).getTime();
    return t >= inicio.getTime() && t < fim.getTime();
  });
  return { meta, marcados: daSemana.length, publicados: daSemana.filter((v) => v.etapa === 'publicado').length };
}

// Eventos do Calendário que um vídeo gera (gravação e publicação).
export function eventosDoVideo(video) {
  const lista = [];
  if (video.excluido_em) return lista;
  if (video.data_gravacao) {
    const [a, m, d] = video.data_gravacao.split('-').map(Number);
    lista.push({ origem_id: `${video.id}:gravar`, titulo: `Gravar: ${video.titulo}`, inicio: new Date(a, m - 1, d).toISOString(), dia_inteiro: true });
  }
  if (video.data_publicacao) {
    lista.push({ origem_id: `${video.id}:publicar`, titulo: `Publicar: ${video.titulo}`, inicio: video.data_publicacao, dia_inteiro: false });
  }
  return lista;
}

export function novoVideo({ titulo, formato = 'longo', etapa = 'ideia' }) {
  const modelo = MODELOS_ROTEIRO[formato] || MODELOS_ROTEIRO.longo;
  return {
    titulo,
    formato,
    etapa,
    prioridade: 2,
    titulos_alternativos: [],
    tags: [],
    checklist: {},
    metricas: {},
    roteiro: { blocos: modelo.map((b) => ({ ...b, id: crypto.randomUUID() })) },
  };
}
