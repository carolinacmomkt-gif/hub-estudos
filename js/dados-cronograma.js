// Cronograma da quinzena da R7 (Carol, 17/11/2026), sem DOM, pelo "Manual padrão: como montar o cronograma
// de conteúdo da quinzena" da R7: a grade de dias pela rotina da ficha, o "o que falta" de cada peça (sem
// IA, de graça), o pedido pronto para o Claude, a leitura da resposta colada, o texto do WhatsApp, a copy
// do carrossel para o Trello, os nomes das pastas e arquivos do Drive e os slides do PDF/PPTX (capa, resumo
// da quinzena, uma página por peça e "Para aprovar"; fundo branco, sem enfeites). Os textos dos clientes
// ficam só no banco (config).

import { checarVoz } from './dados-r7.js';
import { quebrar } from './dados-relatorio.js';
import { especialidade, especialidadeDoTexto, regraDoCta } from './especialidades.js';
import { datasEntre, areasDoNicho } from './datas-especiais.js';

export const PREFIXO_CRONOGRAMA = 'cronograma-r7:';
export const chaveDoCronograma = (cliente, inicio) => `${PREFIXO_CRONOGRAMA}${cliente}:${inicio}`;

const DIA_MS = 864e5;
const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CURTOS_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const somarDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diaDaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const ddBarraMm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const nomeDoDia = (iso) => NOMES_DIA[diaDaSemana(iso)];
const limpo = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const texto = (v, max = 6000) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Período padrão: da próxima segunda até a sexta da semana seguinte (a quinzena, 10 dias úteis).
export function periodoPadrao(hoje) {
  const d = diaDaSemana(hoje);
  const inicio = somarDias(hoje, d === 1 ? 7 : (8 - d) % 7 || 7);
  return { inicio, fim: somarDias(inicio, 11) };
}

export function periodoEmTexto(inicio, fim, { zeros = false } = {}) {
  const dia = (n) => (zeros ? String(n).padStart(2, '0') : n);
  const [, mi, di0] = inicio.split('-').map(Number);
  const [, mf, df0] = fim.split('-').map(Number);
  const di = dia(di0);
  const df = dia(df0);
  return mi === mf ? `${di} a ${df} de ${MESES[mf - 1]}` : `${di} de ${MESES[mi - 1]} a ${df} de ${MESES[mf - 1]}`;
}

// ---------------------------------------------------------------------------
// Peças e grade
// ---------------------------------------------------------------------------

export const TIPOS_PECA = [
  { id: 'post', rotulo: 'POSTAGEM', nome: 'Post' },
  { id: 'reels', rotulo: 'REELS', nome: 'Reel' },
  { id: 'story', rotulo: 'STORY', nome: 'Stories' },
  { id: 'bomdia', rotulo: 'STORIES DE BOM DIA', nome: 'Stories de bom dia' },
];
export const FORMATOS_POST = [
  { id: 'carrossel', nome: 'Carrossel' }, { id: 'estatico', nome: 'Estático' }, { id: 'post', nome: 'Post' },
];
const rotuloDe = (tipo) => TIPOS_PECA.find((t) => t.id === tipo)?.rotulo || 'POSTAGEM';
const ehStory = (p) => p.tipo === 'story' || p.tipo === 'bomdia';
const ehFeed = (p) => p.tipo === 'post' || p.tipo === 'reels';

// "Carrossel", "Estático", "Reel", "Stories"…
export function formatoDaPeca(p) {
  if (p.tipo === 'post') return FORMATOS_POST.find((f) => f.id === p.formato)?.nome || 'Post';
  return TIPOS_PECA.find((t) => t.id === p.tipo)?.nome || 'Post';
}

export function tituloDaPeca(p) {
  return `${rotuloDe(p.tipo)} - ${ddmm(p.data)} - ${nomeDoDia(p.data)}`;
}

// O que entra por cima da sequência (manual da R7): repost do post do dia na primeira tela, enquete (com as
// duas opções) ou caixinha logo no começo e o link para agendar sempre na última tela. Vários, separados por ";".
const FIGURINHA_DO_MODELO = { contexto_enquete: 'enquete Sim / Não', enquete: 'enquete Sim / Não', caixinha: 'caixinha de perguntas', repost: '', bomdia: '' };
export const FUNCOES_TELA = ['gancho', 'interação', 'virada', 'prova', 'chamada'];

export function figurinhaPadrao(modelo, temPost = false) {
  if (modelo === 'bomdia') return '';
  return [temPost || modelo === 'repost' ? 'repost do post do dia' : '', FIGURINHA_DO_MODELO[modelo] ?? '', 'link de agendamento'].filter(Boolean).join('; ');
}

// "repost; enquete Sim / Não; link" → [{ tipo, texto, opcoes }]
export function acoesDaFigurinha(fig) {
  return String(fig || '').split(/[;\n]+/).map((x) => x.trim()).filter(Boolean).map((t) => {
    const tipo = /repost/i.test(t) ? 'repost' : /enquete/i.test(t) ? 'enquete' : /caixinha|pergunta/i.test(t) ? 'caixinha' : /link/i.test(t) ? 'link' : 'outro';
    const opcoes = tipo === 'enquete' ? t.replace(/^.*?enquete\s*:?\s*/i, '').split(/\s*\/\s*/).map((o) => o.trim()).filter(Boolean) : [];
    return { tipo, texto: t, opcoes };
  });
}

// Em que tela entra cada ação: repost na 1, enquete e caixinha na 2 (ou na 1 sem repost), link na última.
export function telaDaAcao(acao, total, acoes = []) {
  if (acao.tipo === 'repost') return 1;
  if (acao.tipo === 'link') return total;
  const temRepost = acoes.some((a) => a.tipo === 'repost');
  return Math.min(total, temRepost || total >= 3 ? 2 : 1);
}

// Linha curta do que entra por cima ("Enquete: Sim / Não", "Link de agendamento", "Repost do post do dia").
export function rotuloDaAcao(a) {
  if (a.tipo === 'enquete') return a.opcoes.length ? `Enquete: ${a.opcoes.join(' / ')}` : 'Enquete';
  if (a.tipo === 'caixinha') return 'Caixinha de perguntas';
  if (a.tipo === 'link') return 'Link de agendamento';
  if (a.tipo === 'repost') return 'Repost do post do dia';
  return a.texto.charAt(0).toUpperCase() + a.texto.slice(1);
}

// O direcionamento que vai escrito na arte, no lugar da figurinha (30 px, sem seta nem caixa).
export const direcionamentoDe = (a) => ({ enquete: 'colocar a enquete aqui', caixinha: 'colocar a caixinha de perguntas aqui', link: 'colocar o link aqui', repost: 'colocar o repost do post do dia aqui' }[a.tipo] || `colocar ${a.texto} aqui`);

const novoId = (data, tipo, i) => `${data}-${tipo}-${i}`;

export function pecaVazia(data, tipo, extra = {}) {
  return {
    id: extra.id || novoId(data, tipo, Math.random().toString(36).slice(2, 7)),
    data, tipo, formato: tipo === 'post' ? (extra.formato || 'carrossel') : '', modelo: ehStory({ tipo }) ? (extra.modelo || (tipo === 'bomdia' ? 'bomdia' : 'contexto_enquete')) : '',
    tema: '', legenda: '', slides: '', video: '', capa: '', telas: '',
    figurinha: ehStory({ tipo }) ? figurinhaPadrao(extra.modelo || (tipo === 'bomdia' ? 'bomdia' : 'contexto_enquete'), extra.temPost) : '',
    pode: false,
  };
}

// A grade sai da rotina da ficha (dados.r7.rotina): feed por dia (formato e quantidade) e stories por dia.
export function gradeDoPeriodo(rotina = {}, inicio, fim) {
  if (!ISO.test(inicio) || !ISO.test(fim) || fim < inicio) return [];
  const feed = Array.isArray(rotina.feed) ? rotina.feed : [];
  const stories = rotina.stories?.tem === false ? {} : (rotina.stories?.dias || {});
  const pecas = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) {
    const n = diaDaSemana(dia);
    for (const f of feed.filter((x) => Number(x.dia) === n)) {
      for (let i = 0; i < (Number(f.qtd) || 1); i += 1) {
        const tipo = f.formato === 'video' ? 'reels' : 'post';
        pecas.push(pecaVazia(dia, tipo, { id: novoId(dia, tipo, `${f.formato}${i}`), formato: f.formato === 'video' ? '' : f.formato }));
      }
    }
    const modelo = stories[n] || stories[String(n)];
    const temPost = pecas.some((p) => p.data === dia);
    if (modelo) pecas.push(pecaVazia(dia, modelo === 'bomdia' ? 'bomdia' : 'story', { id: novoId(dia, 'story', 0), modelo, temPost }));
  }
  return pecas;
}

export function cronogramaVazio({ cliente, nome, inicio, fim, rotina }) {
  return { cliente, nome, inicio, fim, pecas: gradeDoPeriodo(rotina, inicio, fim), marcas: {}, checklist: {}, criado_em: new Date().toISOString() };
}

// Cronogramas antigos (Story 1/Story 2/enquete) viram sequência de telas.
function migrarStory(p) {
  if (!ehStory(p) || p.telas || !(p.story1 || p.story2 || p.pergunta)) return p;
  const telas = [p.story1 && `Tela 1 (gancho): ${p.story1}`, p.story2 && `Tela 2 (interação): ${p.story2}`, p.pergunta && `Tela ${p.story2 ? 3 : 2} (interação): ${p.pergunta}`].filter(Boolean).join('\n');
  return { ...p, telas, figurinha: p.figurinha || (p.enquete ? `enquete ${p.enquete}` : FIGURINHA_DO_MODELO[p.modelo] || '') };
}

export function normalizarCronograma(v = {}) {
  const pecas = (Array.isArray(v.pecas) ? v.pecas : []).filter((p) => p && ISO.test(p.data) && TIPOS_PECA.some((t) => t.id === p.tipo))
    .map((p) => migrarStory({ ...pecaVazia(p.data, p.tipo, p), ...p }))
    .sort((a, z) => a.data.localeCompare(z.data) || (ehStory(a) - ehStory(z)));
  return { ...v, pecas, marcas: v.marcas || {}, checklist: v.checklist || {} };
}

// "Tela 2 (pergunta): Título | apoio" → { n, funcao, titulo, apoio }
export function lerTelas(t) {
  return String(t || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.replace(/\*\*/g, '').match(/^tela\s*(\d+)\s*(?:\(([^)]*)\))?\s*[:\-–]?\s*(.*)$/i);
    const corpo = m ? m[3] : l;
    const [titulo, ...resto] = corpo.split('|');
    return { n: m ? Number(m[1]) : i + 1, funcao: limpo(m?.[2] || '', 30).toLowerCase(), titulo: limpo(titulo, 160), apoio: limpo(resto.join('|'), 300) };
  }).filter((x) => x.titulo || x.apoio);
}

// "Slide 01 | Capa (foto): texto" → { n, indicacao, texto }
export function lerLaminas(t) {
  return String(t || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.replace(/\*\*/g, '').match(/^(?:slide|l[aâ]mina)\s*(\d+)\s*[|\-–:]?\s*([^:]*?)\s*:\s*(.*)$/i);
    return m ? { n: Number(m[1]), indicacao: limpo(m[2], 80), texto: limpo(m[3], 400) } : { n: i + 1, indicacao: '', texto: limpo(l, 400) };
  });
}

// Totais da capa: "6 posts no feed · 2 reels · 3 carrosséis · 4 sequências de stories".
export function totaisDoCronograma(cron) {
  const feed = cron.pecas.filter(ehFeed).length;
  const reels = cron.pecas.filter((p) => p.tipo === 'reels').length;
  const carrosseis = cron.pecas.filter((p) => p.tipo === 'post' && p.formato === 'carrossel').length;
  const stories = cron.pecas.filter(ehStory).length;
  return [plural(feed, 'post no feed', 'posts no feed'), reels && plural(reels, 'reel', 'reels'), carrosseis && plural(carrosseis, 'carrossel', 'carrosséis'), stories && plural(stories, 'sequência de stories', 'sequências de stories')].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// O que falta (no aparelho, sem IA)
// ---------------------------------------------------------------------------

// Frases que o manual da R7 proíbe em qualquer copy.
const PROIBIDAS = [/entre uma coisa e outra/i, /vamos l[aá](?!\p{L})/iu];
const EMOJI = /\p{Extended_Pictographic}/u;
const palavras = (t) => String(t || '').split(/\s+/).filter(Boolean).length;

// O que falta e o que conferir em cada peça. contexto.diaComPost diz se há post no feed no mesmo dia (o
// story abre com o repost); sem RQE na assinatura, o texto não chama o cliente de especialista.
export function oQueFalta(p, { assinatura = '', voz = {}, ficha = null, diaComPost = false } = {}) {
  const falta = [];
  const atencao = [];
  const textos = [p.legenda, p.slides, p.capa, p.telas, p.tema].join('\n');
  const proibida = PROIBIDAS.map((re) => textos.match(re)?.[0]).find(Boolean);
  if (proibida) atencao.push(`tirar "${proibida.toLowerCase()}"`);
  if (assinatura && !/\bRQE\b/i.test(assinatura) && /\bespecialista\b/i.test(textos)) atencao.push('"especialista" sem RQE na assinatura');
  if (ehFeed(p)) {
    if (!p.tema.trim()) atencao.push('sem tema');
    if (!p.legenda.trim()) falta.push('legenda');
    else {
      if (assinatura && !p.legenda.includes(assinatura)) falta.push('assinatura');
      if (/[—–]/.test(p.legenda)) atencao.push('travessão');
      for (const a of checarVoz(p.legenda, voz, ficha).avisos) if (!/assinatura/i.test(a)) atencao.push(a);
    }
    if (p.tipo === 'post' && p.formato === 'carrossel') {
      const laminas = lerLaminas(p.slides);
      if (!p.slides.trim()) falta.push('lâminas');
      else {
        if (laminas.length < 5 || laminas.length > 8) atencao.push(`${plural(laminas.length, 'lâmina', 'lâminas')} (capa + 4 a 7 cards)`);
        if (laminas.some((l) => EMOJI.test(l.texto))) atencao.push('emoji nas lâminas');
      }
    }
    if (p.tipo === 'reels') {
      if (!p.video.trim()) falta.push('link do vídeo');
      if (!p.capa.trim()) falta.push('texto da capa');
    }
  } else {
    const telas = lerTelas(p.telas);
    const minimo = p.tipo === 'bomdia' ? 1 : 3;
    if (!telas.length) falta.push('telas');
    else if (telas.length < minimo) atencao.push(`${plural(telas.length, 'tela', 'telas')} (o manual pede de 3 a 5)`);
    if (telas.length > 5) atencao.push('mais de 5 telas');
    if (telas.some((t) => palavras(t.titulo) > 12)) atencao.push('título com mais de 12 palavras');
    if (telas.some((t) => t.apoio.length > 110)) atencao.push('texto de apoio longo (até duas linhas)');
    if (p.tipo === 'story') {
      const acoes = acoesDaFigurinha(p.figurinha);
      if (!acoes.some((a) => a.tipo === 'enquete' || a.tipo === 'caixinha')) atencao.push('sem interação (enquete ou caixinha)');
      if (acoes.some((a) => a.tipo === 'enquete' && a.opcoes.length < 2)) atencao.push('enquete sem as duas opções');
      if (!acoes.some((a) => a.tipo === 'link')) atencao.push('sem o link na última tela');
      if (diaComPost && !acoes.some((a) => a.tipo === 'repost')) atencao.push('dia de post: abrir com o repost');
    }
  }
  return { falta, atencao, pronta: !falta.length && (!atencao.length || p.pode) };
}

const diasComPost = (cron) => new Set(cron.pecas.filter(ehFeed).map((p) => p.data));

export function resumoDoQueFalta(cron, contexto) {
  const dias = diasComPost(cron);
  const itens = cron.pecas.map((p) => ({ p, ...oQueFalta(p, { ...contexto, diaComPost: dias.has(p.data) }) }));
  const legendas = itens.filter((x) => x.falta.includes('legenda')).length;
  const outros = itens.reduce((n, x) => n + x.falta.filter((f) => f !== 'legenda').length, 0);
  const atencao = itens.filter((x) => x.atencao.length && !x.p.pode).length;
  const prontas = itens.filter((x) => x.pronta).length;
  return { total: itens.length, prontas, legendas, outros, atencao, itens };
}

export function frasesDoQueFalta(r) {
  const partes = [];
  if (r.legendas) partes.push(plural(r.legendas, 'legenda', 'legendas'));
  if (r.outros) partes.push(plural(r.outros, 'item', 'itens'));
  if (r.atencao) partes.push(`${r.atencao} para conferir`);
  return partes.length ? `Falta: ${partes.join(', ')}` : 'Tudo pronto';
}

// Checklist final do manual da R7 (a Carol marca antes de mandar).
export const CHECKLIST_FINAL = [
  'Cronograma duplicado do último, com as datas certas e na ordem de postagem',
  'Registro profissional em artes e legendas, sem título de especialista que o cliente não tem',
  'Copys revisadas no tom do cliente, sem "entre uma coisa e outra" e sem "vamos lá"',
  'Stories com uma fonte só, linhas equilibradas, contraste e direcionamento só em texto',
  'Pasta do Drive com uma pasta por peça e arquivos nomeados',
  'Cards do Trello com orientação curta, copy, fotos nomeadas, referência acessível e entrega na quinta',
];

// ---------------------------------------------------------------------------
// Pedido para o Claude e leitura da resposta
// ---------------------------------------------------------------------------

function blocoModelo(p) {
  const cab = `### ${ddmm(p.data)} · ${rotuloDe(p.tipo)}${p.tipo === 'post' && p.formato && p.formato !== 'post' ? ` · ${formatoDaPeca(p)}` : ''}`;
  if (p.tipo === 'post') return [cab, 'Tema:', 'Legenda:', ...(p.formato === 'carrossel' ? ['Slides:', 'Slide 01 | Capa (indicação de foto): texto', 'Slide 02 | Card 1: texto'] : [])].join('\n');
  if (p.tipo === 'reels') return [cab, 'Tema:', 'Texto da capa:', 'Legenda:'].join('\n');
  if (p.tipo === 'bomdia') return [cab, 'Tela 1 (gancho): título | texto de apoio'].join('\n');
  return [cab, 'Tela 1 (gancho): título | texto de apoio', 'Tela 2 (interação): título | texto de apoio', 'Tela 3 (virada): título | texto de apoio', 'Tela 4 (prova): título | texto de apoio', 'Tela 5 (chamada): título | texto de apoio', `Por cima: ${p.figurinha || figurinhaPadrao('contexto_enquete')}`].join('\n');
}

// O que vai para o Claude: a ficha, a voz, as regras do manual e os blocos que faltam, no formato que o app
// lê de volta.
export function pedidoParaClaude(cron, { nome, fichaTexto = '', voz = {}, nicho = '', assinatura = '' }, contexto = {}) {
  const r = resumoDoQueFalta(cron, { ...contexto, assinatura, voz });
  const faltando = r.itens.filter((x) => x.falta.length || x.atencao.some((a) => /tela|interação|lâmina|vamos|entre uma|especialista/.test(a))).map((x) => x.p);
  const semRqe = assinatura && !/\bRQE\b/i.test(assinatura);
  const prontas = r.itens.filter((x) => !faltando.includes(x.p)).map((x) => x.p);
  const esp = especialidade(nicho) || especialidadeDoTexto(nicho);
  const areas = new Set(areasDoNicho(esp?.nome || nicho, nome));
  const datas = datasEntre(cron.inicio, cron.fim).filter((d) => (d.areas || []).some((a) => a === 'todas' || areas.has(a))).slice(0, 12);
  const vozTexto = Object.entries(voz || {}).filter(([k, v]) => !['atualizado_em', 'fontes'].includes(k) && v && (typeof v !== 'object' || (Array.isArray(v) ? v.length : v.valor)))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.map((x) => x.valor || x).join(', ') : (v.valor ?? v)}`).join('\n');
  return [
    `Escreva o cronograma de conteúdo de ${nome}${esp ? ` (${esp.nome})` : ''} da quinzena de ${periodoEmTexto(cron.inicio, cron.fim)}.`,
    'Responda só com os blocos abaixo, na mesma ordem e com os mesmos cabeçalhos (### dd.mm · TIPO), preenchendo cada campo depois dos dois-pontos. Não acrescente comentários.',
    '',
    '## Regras',
    '- Escreva no tom do cliente (ficha e voz abaixo).',
    `- Toda legenda termina com a assinatura exata: ${assinatura || '(a ficha ainda não tem assinatura)'}`,
    '- Português do Brasil, primeira pessoa do cliente, frases curtas, sem jargão, sem travessão, sem hashtag (a não ser que a ficha peça), sem promessa de resultado.',
    '- Nunca use "entre uma coisa e outra" nem "vamos lá".',
    ...(semRqe ? ['- O registro do cliente não tem RQE: nunca o chame de especialista nem pelo nome da especialidade (ex.: "psiquiatra"); use o registro da assinatura.'] : []),
    `- ${regraDoCta(esp?.nome || nicho)}`,
    '- Carrossel: capa + 4 a 7 cards. Capa com cena reconhecível ou pergunta direta; primeiro card com a situação real da pessoa; cards do meio com uma ideia cada, frases ligadas por vírgula no ritmo da fala; penúltimo com o risco de não agir; último com a chamada. Sem emoji nas lâminas. "Slides:" com uma lâmina por linha: "Slide 01 | Capa (indicação de foto): texto".',
    '- Legenda do carrossel: resume em 4 a 6 frases, fecha com uma frase-assinatura e depois a assinatura com o registro. Emoji só na legenda e pontual.',
    '- Reel: "Texto da capa:" curto, separado da legenda, para o cliente revisar.',
    '- Stories: de 3 a 5 telas que vendem uma coisa só (quase sempre a consulta). Ordem: 1 gancho (pergunta ou frase que a pessoa reconhece; em dia de post, a tela 1 é o repost do post do dia), 2 interação (enquete com as duas opções ou caixinha, logo no começo), 3 virada (o que o profissional faz diferente, em primeira pessoa), 4 prova concreta (um dado real do atendimento), 5 chamada (a última tela sempre tem o link para agendar). Uma ideia por tela: título de até 12 palavras | apoio de no máximo duas linhas. "Por cima:" lista, separado por ";", o que entra por cima (repost do post do dia; enquete Opção A / Opção B; caixinha de perguntas; link de agendamento).',
    '',
    '## Ficha do cliente',
    texto(fichaTexto, 8000) || '(sem ficha)',
    ...(vozTexto ? ['', '## Voz do cliente', vozTexto] : []),
    ...(datas.length ? ['', '## Datas do período', ...datas.map((d) => `- ${ddmm(d.data)}: ${d.nome}`)] : []),
    ...(prontas.length ? ['', '## Já prontas (não reescreva)', ...prontas.map((p) => `- ${tituloDaPeca(p)}${p.tema ? `: ${p.tema}` : ''}`)] : []),
    '',
    '## Escreva',
    ...faltando.map((p) => `${blocoModelo(p)}\n`),
  ].join('\n').trim();
}

const CAMPOS = [
  ['tema', /^tema$/], ['legenda', /^legenda$/], ['slides', /^(slides?|laminas?|copy das laminas)$/], ['video', /^(link do video|video)$/],
  ['capa', /^(texto da capa|capa)$/], ['figurinha', /^(figurinha|por cima|interacao|enquete|caixinha)$/],
];
const semAcentoMin = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function campoDaLinha(linha) {
  const limpa = linha.replace(/^\s*[-*]?\s*/, '');
  if (/^\**\s*tela\s*\d+/i.test(limpa)) return { campo: 'telas', linha: limpa.replace(/\*\*/g, '').trim() };
  const m = limpa.replace(/^\**/, '').match(/^([A-Za-zÀ-ú0-9 ]{2,24}?)\**\s*:\**\s*(.*)$/);
  if (!m) return null;
  const nome = semAcentoMin(m[1]);
  const campo = CAMPOS.find(([, re]) => re.test(nome));
  if (!campo) return null;
  return { campo: campo[0], resto: campo[0] === 'figurinha' && /^(enquete|caixinha)$/.test(nome) ? `${nome} ${m[2]}`.trim() : m[2] };
}

const RE_CAB = /^\s*#{2,4}\s*(\d{1,2})[./-](\d{1,2})\s*[·•|\-–—]\s*([^·•|]+?)\s*(?:[·•|]\s*(.+))?\s*$/;

// Lê a resposta do Claude e põe cada campo na peça certa (mesma data e mesmo tipo, na ordem).
// Devolve { pecas, lidas, sobras } sem apagar o que já estava escrito nos campos que não vieram.
export function lerRespostaDoClaude(textoColado, pecas) {
  const linhas = String(textoColado || '').replace(/\r\n?/g, '\n').split('\n');
  const blocos = [];
  let atual = null;
  for (const linha of linhas) {
    const cab = linha.match(RE_CAB);
    if (cab) {
      atual = { dia: cab[1].padStart(2, '0'), mes: cab[2].padStart(2, '0'), rotulo: semAcentoMin(cab[3]).toUpperCase(), campos: {}, campo: null };
      blocos.push(atual);
      continue;
    }
    if (!atual) continue;
    const c = campoDaLinha(linha);
    if (c?.campo === 'telas') {
      (atual.campos.telas ||= []).push(c.linha);
      atual.campo = null;
    } else if (c) {
      atual.campo = c.campo;
      atual.campos[c.campo] = c.resto ? [c.resto] : [];
    } else if (atual.campo) {
      atual.campos[atual.campo].push(linha);
    }
  }
  const usadas = new Set();
  const novas = pecas.map((p) => ({ ...p }));
  let lidas = 0;
  const sobras = [];
  for (const b of blocos) {
    const tipo = /BOM DIA/.test(b.rotulo) ? 'bomdia' : /REEL/.test(b.rotulo) ? 'reels' : /STOR/.test(b.rotulo) ? 'story' : 'post';
    const alvo = novas.find((p) => !usadas.has(p.id) && p.data.slice(8, 10) === b.dia && p.data.slice(5, 7) === b.mes && p.tipo === tipo);
    if (!alvo) { sobras.push(`${b.dia}.${b.mes} · ${b.rotulo}`); continue; }
    usadas.add(alvo.id);
    for (const [campo, linhasCampo] of Object.entries(b.campos)) {
      const valor = texto(linhasCampo.join('\n').replace(/\*\*/g, ''), campo === 'slides' || campo === 'telas' ? 8000 : 4000);
      if (valor) alvo[campo] = ['tema', 'capa', 'figurinha'].includes(campo) ? limpo(valor, 200) : valor;
    }
    lidas += 1;
  }
  return { pecas: novas, lidas, sobras };
}

// ---------------------------------------------------------------------------
// Saídas: WhatsApp, Trello e Drive
// ---------------------------------------------------------------------------

function textoDaPeca(p, { whatsapp = false } = {}) {
  const n = (t) => (whatsapp ? `*${t}*` : t);
  const cab = n(`${nomeDoDia(p.data)}, ${ddBarraMm(p.data)} · ${formatoDaPeca(p)}`);
  if (ehFeed(p)) {
    return [cab, ...(p.tipo === 'reels' && p.capa ? [`Texto da capa: ${p.capa}`] : []), 'Legenda:', p.legenda, ...(p.tipo === 'reels' && p.video ? [`Vídeo: ${p.video}`] : [])].filter((l) => l !== '').join('\n');
  }
  const acoes = acoesDaFigurinha(p.figurinha);
  return [cab, ...lerTelas(p.telas).map((t) => `${t.n}. ${t.titulo}${t.apoio ? ` · ${t.apoio}` : ''}`), ...(acoes.length ? [`Por cima: ${acoes.map((a) => rotuloDaAcao(a).replace(/\s*\/\s*/g, ' · ')).join('; ')}`] : [])].join('\n');
}

export function textoWhatsApp(cron, { abertura = '', fechamento = 'Para pedir ajuste, é só responder citando a data do post ou do story.' } = {}) {
  return [
    `*Cronograma de conteúdo · ${cron.nome}*`,
    `*${periodoEmTexto(cron.inicio, cron.fim)}*`,
    ...(abertura ? ['', abertura] : []),
    ...cron.pecas.map((p) => `\n${textoDaPeca(p, { whatsapp: true })}`),
    '',
    fechamento,
  ].join('\n').trim();
}

// Descrição do card do designer no Trello da R7 (manual): a orientação só quando muda a estética, depois a
// copy em "**Capa**" e "**Card N**". Nome do card: carrossel ou estático; entrega na quinta às 10h.
export function textoParaTrello(p, { orientacao = '' } = {}) {
  const laminas = lerLaminas(p.slides);
  const blocos = laminas.length
    ? laminas.map((l, i) => `**${i === 0 ? 'Capa' : `Card ${i}`}**\n${l.texto}`)
    : [p.legenda || ''];
  return [...(orientacao.trim() ? [orientacao.trim(), ''] : []), blocos.join('\n\n')].join('\n').trim();
}

// Quinta-feira da semana do envio, às 10h (a entrega do designer).
export function entregaDoDesigner(hoje) {
  const d = diaDaSemana(hoje);
  return `${somarDias(hoje, d <= 4 ? 4 - d : 11 - d)}T10:00`;
}

const nomeDePasta = (t) => String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const ddTracoMm = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

// Entrega no Drive (manual da R7): uma pasta por peça, numerada na ordem de postagem
// ("01 · 23-11 seg · Stories · tema"), e os nomes dos arquivos de cada uma.
export function nomesDaEntrega(cron) {
  let sequencia = 0;
  return cron.pecas.map((p, i) => {
    const tema = p.tema || (ehStory(p) ? lerTelas(p.telas)[0]?.titulo || '' : '');
    const pasta = [String(i + 1).padStart(2, '0'), `${ddTracoMm(p.data)} ${CURTOS_DIA[diaDaSemana(p.data)].toLowerCase()}`, formatoDaPeca(p), tema && nomeDePasta(tema)].filter(Boolean).join(' · ');
    let arquivos;
    if (p.tipo === 'post' && p.formato === 'carrossel') {
      const n = Math.max(1, lerLaminas(p.slides).length);
      arquivos = [...Array.from({ length: n }, (_, k) => `${String(k + 1).padStart(2, '0')}.jpg`), 'Legenda'];
    } else if (p.tipo === 'reels') {
      arquivos = [`capa-reel-${ddTracoMm(p.data)}.jpg`, 'video.MP4', 'Legenda'];
    } else if (p.tipo === 'post') {
      arquivos = ['01.jpg', 'Legenda'];
    } else {
      sequencia += 1;
      const telas = Math.max(1, lerTelas(p.telas).length);
      const acoes = acoesDaFigurinha(p.figurinha);
      arquivos = Array.from({ length: telas }, (_, k) => {
        const aqui = acoes.filter((a) => telaDaAcao(a, telas, acoes) === k + 1).map((a) => (a.tipo === 'enquete' && a.opcoes.length ? `enquete ${a.opcoes.join(' ou ')}` : a.tipo === 'repost' ? 'repost do post do dia' : a.tipo === 'link' ? 'link' : a.tipo === 'caixinha' ? 'caixinha' : nomeDePasta(a.texto)));
        return `S${sequencia}_${k + 1}${aqui.length ? ` - ${aqui.join(' e ')}` : ''}.jpg`;
      });
    }
    return { pasta, arquivos };
  });
}

// Pedido das artes de uma sequência de stories, para colar no projeto do cliente no Claude (Carol, 17/11/2026:
// cada cliente tem a própria fonte, então a arte é feita lá, com a identidade dele). Leva as regras de design do
// manual da R7, as telas com a função e o fundo sugerido, o direcionamento escrito e o nome de cada arquivo.
export function pedidoDasArtesDosStories(cron, p) {
  const telas = lerTelas(p.telas);
  const acoes = acoesDaFigurinha(p.figurinha);
  const i = cron.pecas.indexOf(p);
  const arquivos = (i >= 0 ? nomesDaEntrega(cron)[i]?.arquivos : null) || [];
  const n = telas.length;
  return [
    `Crie as artes dos stories de ${cron.nome} para ${nomeDoDia(p.data).toLowerCase()}, ${ddBarraMm(p.data)} (${plural(n, 'tela', 'telas')}).`,
    '',
    '## Regras de design (manual da R7)',
    '- Arte em 1080 × 1920 px, em JPG, com cara de Instagram orgânico.',
    '- Uma fonte só: a da identidade visual deste cliente (veja o projeto). Título 66 a 84 px em semibold, apoio 38 a 40 px regular, direcionamento 30 px semibold.',
    '- Cores da identidade do cliente: uma escura, uma clara e uma de acento, só na expressão de destaque (uma por título).',
    '- Fundos alternando na sequência: liso escuro (gancho, virada), liso claro (prova, chamada sem foto), foto com sombra curta e clara só atrás das letras (quando o rosto ajuda) e foto com caixa quadrada na cor escura (última tela, com link).',
    '- Deixe livres os 250 px do topo e os 340 px de baixo. Margem lateral de 96 px. Título, apoio e direcionamento alinhados à esquerda na mesma linha, o apoio logo abaixo do título.',
    '- Linhas equilibradas, sem palavra sozinha na última linha. Na foto, o texto fica onde não há rosto.',
    '- A arte não leva figurinha: só uma linha de texto de 30 px, sem seta, tracejado ou caixa, no lugar onde ela entra.',
    '- Não fazer: fundo branco atrás de cada linha, sombra grande e escura, figurinha de verdade na arte.',
    '',
    '## Telas',
    ...telas.map((t, k) => {
      const aqui = acoes.filter((a) => telaDaAcao(a, n, acoes) === k + 1);
      return [
        `### Tela ${t.n}${t.funcao ? ` · ${t.funcao}` : ''} · fundo sugerido: ${telaEscura(t, k, n) ? 'liso escuro' : 'liso claro ou foto'}`,
        `Título: ${t.titulo}`,
        ...(t.apoio ? [`Apoio: ${t.apoio}`] : []),
        ...aqui.map((a) => `Direcionamento: "${direcionamentoDe(a)}" (${rotuloDaAcao(a)})`),
        ...(arquivos[k] ? [`Arquivo: ${arquivos[k]}`] : []),
      ].join('\n');
    }),
  ].join('\n').trim();
}

export function textoDaEntrega(cron) {
  return nomesDaEntrega(cron).map((x) => `${x.pasta}\n${x.arquivos.map((a) => `  ${a}`).join('\n')}`).join('\n\n');
}

// ---------------------------------------------------------------------------
// Slides do PDF/PPTX (manual, parte 1): fundo branco, poucos elementos, tipografia organizada
// ---------------------------------------------------------------------------

export const CORES_CRONOGRAMA = { fundo: '#FFFFFF', texto: '#1F1F1F', suave: '#6B6B6B', claro: '#9A9A9A', linha: '#E8E8E8', caixa: '#F2F3F5', telaClara: '#EFEDE8', branco: '#FFFFFF', acentoPadrao: '#34505C' };

// A cor da ficha vira o acento só se ler bem no branco (4,5:1); senão escurece até ler.
const luz = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export function acentoDoCronograma(c) {
  let cor = /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c.toUpperCase() : CORES_CRONOGRAMA.acentoPadrao;
  for (let i = 0; i < 20 && 1.05 / (luz(cor) + 0.05) < 4.5; i += 1) {
    cor = `#${[1, 3, 5].map((k) => Math.round(parseInt(cor.slice(k, k + 2), 16) * 0.85).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
  return cor;
}

function caber(medir, t, tam, largura, f, negrito = true, minimo = 14) {
  let s = tam;
  while (s > minimo && medir(t, s, negrito, f) > largura) s -= 1;
  return s;
}

function paragrafosQueCabem(blocos, x, y, w, h, medir, { f = 'isans', tam = 13, minimo = 8, entrelinha = 1.4, espaco = 0.55 } = {}) {
  let s = tam;
  const altura = (t) => blocos.reduce((soma, b) => soma + quebrar(b.map((r) => ({ ...r, f: r.f || f })), w, t, medir).length * t * entrelinha, 0) + (blocos.length - 1) * t * espaco;
  while (s > minimo && altura(s) > h) s -= 0.25;
  return { tipo: 'paragrafos', x, y, w, h, tam: s, f, entrelinha, espaco: s * espaco, paragrafos: blocos };
}

const paragrafosDe = (t, cor = CORES_CRONOGRAMA.texto) => String(t || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => [{ t: l, cor }]);
const rotulo = (t, x, y, w = 300, cor = CORES_CRONOGRAMA.suave) => ({ tipo: 'texto', x, y, w, tam: 8.5, f: 'isans', alinhar: 'l', runs: [{ t: t.toUpperCase(), b: 600, cor }] });
const MARGEM = 40;
const LARG = 1200 - MARGEM * 2;

// Cabeçalho e rodapé de toda página: o nome do cliente, o contador da peça e a linha do cronograma.
function moldura(cron, A, contador, rodape) {
  const C = CORES_CRONOGRAMA;
  return [
    { tipo: 'texto', x: MARGEM, y: 26, w: 600, tam: 9, f: 'isans', alinhar: 'l', runs: [{ t: String(cron.nome || '').toUpperCase(), b: 700, cor: A }] },
    ...(contador ? [{ tipo: 'texto', x: 600, y: 26, w: 600 - MARGEM, tam: 9, f: 'isans', alinhar: 'r', runs: [{ t: contador, cor: C.claro }] }] : []),
    { tipo: 'texto', x: MARGEM, y: 640, w: 800, tam: 8.5, f: 'isans', alinhar: 'l', runs: [{ t: rodape, cor: C.claro }] },
  ];
}

// Cabeçalho das páginas de peça: data grande, dia e formato embaixo, título ao lado e a linha.
function cabecalhoDaPeca(p, A, medir) {
  const C = CORES_CRONOGRAMA;
  const titulo = p.tema || (ehStory(p) ? lerTelas(p.telas)[0]?.titulo : '') || formatoDaPeca(p);
  return [
    { tipo: 'texto', x: MARGEM, y: 66, w: 190, tam: 50, f: 'serif', alinhar: 'l', runs: [{ t: ddBarraMm(p.data), cor: A }] },
    rotulo(`${nomeDoDia(p.data)} · ${formatoDaPeca(p)}`, MARGEM, 128, 190, A),
    { tipo: 'texto', x: 240, y: 80, w: LARG - 200, tam: caber(medir, titulo, 28, LARG - 200, 'serif', false, 16), f: 'serif', alinhar: 'l', runs: [{ t: titulo, cor: C.texto }] },
    { tipo: 'retangulo', x: MARGEM, y: 160, w: LARG, h: 1, cor: C.linha },
  ];
}

// "Dr. Nome | Médico | CRM-XX 0000" → nome em negrito numa linha e o registro na outra.
function assinaturaEmDuasLinhas(assinatura) {
  const [nome, ...resto] = String(assinatura || '').split(/\s*\|\s*/);
  return [[{ t: nome, b: 700, cor: CORES_CRONOGRAMA.texto }], ...(resto.length ? [[{ t: resto.join(' | '), cor: CORES_CRONOGRAMA.texto }]] : [])];
}

const ehSaude = (assinatura) => /\b(CRM|CRO|CRP|CRN|CREFITO|CREFONO|COREN|CRF|CRBM|RQE)\b/i.test(assinatura || '');
const avisoDaSaude = (assinatura) => `Este conteúdo tem caráter educativo e não substitui uma consulta${/\bCRM\b/i.test(assinatura) ? ' médica' : ''}.`;

function legendaEmBlocos(p, assinatura) {
  const C = CORES_CRONOGRAMA;
  const tem = assinatura && p.legenda.includes(assinatura);
  const blocos = paragrafosDe(String(p.legenda || '').replace(tem ? assinatura : '\u0000', '').trim());
  if (tem) blocos.push(...assinaturaEmDuasLinhas(assinatura));
  if (ehSaude(assinatura)) blocos.push([{ t: avisoDaSaude(assinatura), i: true, cor: C.claro }]);
  return blocos;
}

function blocoDaLegenda(p, assinatura, x, y, w, h, medir) {
  return [rotulo('Legenda', x, y), paragrafosQueCabem(legendaEmBlocos(p, assinatura), x, y + 24, w, h - 24, medir, { tam: 12.5, minimo: 8 })];
}

// Telas dos stories (manual): liso escuro no gancho, na interação e na virada; liso claro na prova e na chamada.
const telaEscura = (t, k, total) => (/gancho|intera|pergunta|virada|dor|resposta|sinais/i.test(t.funcao) ? true : /prova|chamada|solu/i.test(t.funcao) ? false : k < total - 1 && k % 2 === 0);

export function montarSlidesDoCronograma(cron, { cor = '', assinatura = '' } = {}, medir) {
  const C = CORES_CRONOGRAMA;
  const A = acentoDoCronograma(cor);
  const rodape = `Cronograma ${ddBarraMm(cron.inicio)} a ${ddBarraMm(cron.fim)} · R7 Estratégias Digitais`;
  const slides = [];
  // Capa: rótulo pequeno, nome em destaque, período por extenso, um fio e o total.
  slides.push({ id: 'capa', fundo: C.fundo, elementos: [
    { tipo: 'texto', x: 90, y: 196, w: 1000, tam: 10.5, f: 'isans', alinhar: 'l', runs: [{ t: 'CRONOGRAMA DE CONTEÚDO', b: 700, cor: A }] },
    { tipo: 'texto', x: 90, y: 224, w: 1020, tam: caber(medir, cron.nome || '', 62, 1020, 'serif', false, 30), f: 'serif', alinhar: 'l', runs: [{ t: cron.nome || '', cor: C.texto }] },
    { tipo: 'texto', x: 90, y: 318, w: 1000, tam: 15, f: 'isans', alinhar: 'l', runs: [{ t: periodoEmTexto(cron.inicio, cron.fim, { zeros: true }), cor: C.suave }] },
    { tipo: 'retangulo', x: 90, y: 384, w: 48, h: 1, cor: C.claro },
    { tipo: 'texto', x: 90, y: 400, w: 1000, tam: 10.5, f: 'isans', alinhar: 'l', runs: [{ t: totaisDoCronograma(cron), cor: C.claro }] },
    { tipo: 'texto', x: 90, y: 590, w: 1000, tam: 9, f: 'isans', alinhar: 'l', runs: [{ t: 'Rascunho para aprovação · R7 Estratégias Digitais', cor: C.claro }] },
  ] });
  // Resumo da quinzena: data e dia, formato, tema e página; feed em negrito (formato no acento), stories em cinza.
  const POR_PAGINA = 16;
  const paginasResumo = Math.max(1, Math.ceil(cron.pecas.length / POR_PAGINA));
  for (let i = 0; i < Math.max(1, cron.pecas.length); i += POR_PAGINA) {
    const els = [
      ...moldura(cron, A, 'Resumo da quinzena', rodape),
      { tipo: 'texto', x: MARGEM, y: 70, w: LARG, tam: 30, f: 'serif', alinhar: 'l', runs: [{ t: 'Resumo da quinzena', cor: C.texto }] },
      ...[['Data', MARGEM], ['Formato', 200], ['Tema', 400], ['Página', 1100]].map(([t, x]) => rotulo(t, x, 166, 160, C.claro)),
      { tipo: 'retangulo', x: MARGEM, y: 186, w: LARG, h: 1, cor: C.texto },
    ];
    cron.pecas.slice(i, i + POR_PAGINA).forEach((p, k) => {
      const y = 194 + k * 26;
      const story = ehStory(p);
      const b = story ? 400 : 700;
      const cor = story ? C.claro : C.texto;
      const tema = p.tema || (story ? lerTelas(p.telas)[0]?.titulo || '' : '');
      els.push(
        { tipo: 'texto', x: MARGEM, y, w: 150, tam: 10.5, f: 'isans', alinhar: 'l', runs: [{ t: `${ddBarraMm(p.data)} ${CURTOS_DIA[diaDaSemana(p.data)].toLowerCase()}`, b, cor }] },
        { tipo: 'texto', x: 200, y, w: 190, tam: 10.5, f: 'isans', alinhar: 'l', runs: [{ t: formatoDaPeca(p), b, cor: story ? cor : A }] },
        { tipo: 'texto', x: 400, y, w: 680, tam: caber(medir, tema, 10.5, 680, 'isans', b, 8), f: 'isans', alinhar: 'l', runs: [{ t: tema, b, cor }] },
        { tipo: 'texto', x: 1100, y, w: 60, tam: 10.5, f: 'isans', alinhar: 'l', runs: [{ t: String(cron.pecas.indexOf(p) + 2 + paginasResumo).padStart(2, '0'), b: 400, cor: C.claro }] },
        { tipo: 'retangulo', x: MARGEM, y: y + 21, w: LARG, h: 1, cor: C.linha },
      );
    });
    slides.push({ id: `resumo:${i}`, fundo: C.fundo, elementos: els });
  }
  // Uma página por peça, na ordem de postagem, com o contador ("Post 2 de 6 · Carrossel", "Stories 3 de 6").
  const feed = cron.pecas.filter(ehFeed);
  const stories = cron.pecas.filter(ehStory);
  for (const p of cron.pecas) {
    const contador = ehFeed(p) ? `Post ${feed.indexOf(p) + 1} de ${feed.length} · ${formatoDaPeca(p)}` : `Stories ${stories.indexOf(p) + 1} de ${stories.length}`;
    const els = [...moldura(cron, A, contador, rodape), ...cabecalhoDaPeca(p, A, medir)];
    const topo = 186;
    const altura = 620 - topo;
    if (p.tipo === 'post' && p.formato === 'carrossel') {
      // Grade com todas as lâminas na ordem (o texto de cada uma) e a legenda completa ao lado.
      const laminas = lerLaminas(p.slides);
      els.push(rotulo(`Lâminas (${laminas.length})`, MARGEM, topo));
      const area = { x: MARGEM, y: topo + 24, w: 580, h: altura - 24 };
      const col = 4;
      const lin = Math.max(2, Math.ceil(laminas.length / col));
      const lw = (area.w - (col - 1) * 8) / col;
      const lh = Math.min(lw * 1.25, (area.h - (lin - 1) * 8) / lin);
      laminas.forEach((l, k) => {
        const x = area.x + (k % col) * (lw + 8);
        const y = area.y + Math.floor(k / col) * (lh + 8);
        els.push({ tipo: 'retangulo', x, y, w: lw, h: lh, cor: C.caixa });
        els.push({ tipo: 'texto', x: x + 8, y: y + 8, w: lw - 16, tam: 8, f: 'isans', alinhar: 'l', runs: [{ t: String(l.n).padStart(2, '0'), b: 700, cor: A }] });
        els.push(paragrafosQueCabem([[{ t: l.texto, cor: C.suave }]], x + 8, y + 24, lw - 16, lh - 30, medir, { tam: 8.5, minimo: 6, entrelinha: 1.3 }));
      });
      els.push(...blocoDaLegenda(p, assinatura, 680, topo, 480, altura, medir));
    } else if (p.tipo === 'reels') {
      // Capa clicável (abre o vídeo), "Assistir ao vídeo", o texto da capa separado e a legenda.
      const w = 200;
      const h = Math.min(w * 16 / 9, altura);
      els.push({ tipo: 'retangulo', x: MARGEM, y: topo, w, h, cor: C.caixa, ...(p.video ? { link: p.video } : {}) });
      if (p.capa) els.push(paragrafosQueCabem([[{ t: p.capa, cor: C.texto }]], MARGEM + 16, topo + h * 0.18, w - 32, h * 0.5, medir, { tam: 22, minimo: 11, f: 'serif', entrelinha: 1.1 }));
      const xm = 290;
      els.push(rotulo('Vídeo', xm, topo));
      els.push({ tipo: 'texto', x: xm, y: topo + 22, w: 300, tam: 11.5, f: 'isans', alinhar: 'l', runs: [{ t: p.video ? 'Assistir ao vídeo ↗' : 'Falta o link do vídeo', b: 600, cor: p.video ? A : C.claro, ...(p.video ? { link: p.video } : {}) }] });
      if (p.video) els.push({ tipo: 'texto', x: xm, y: topo + 44, w: 300, tam: 9, f: 'isans', alinhar: 'l', runs: [{ t: 'Clique na capa ou no link. O vídeo já está editado.', cor: C.claro }] });
      if (p.capa) {
        els.push(rotulo('Texto da capa', xm, topo + 92));
        els.push(paragrafosQueCabem([[{ t: p.capa, cor: C.texto }]], xm, topo + 116, 300, 180, medir, { tam: 17, minimo: 10, f: 'serif', entrelinha: 1.25 }));
      }
      els.push(...blocoDaLegenda(p, assinatura, 640, topo, 520, altura, medir));
    } else if (p.tipo === 'post') {
      els.push(...blocoDaLegenda(p, assinatura, MARGEM, topo, 760, altura, medir));
    } else {
      // Sequência de stories: as telas lado a lado na ordem (liso escuro ou claro, como a arte vai sair), com o
      // direcionamento escrito onde entra a figurinha; embaixo, o número e a função e o que entra por cima.
      const telas = lerTelas(p.telas);
      const n = Math.max(1, telas.length);
      const acoes = acoesDaFigurinha(p.figurinha);
      const th = 330;
      const tw = Math.min(th * 9 / 16, (LARG - (n - 1) * 18) / n);
      const x0 = MARGEM + (LARG - (n * tw + (n - 1) * 18)) / 2;
      const y0 = topo + 14;
      telas.forEach((t, k) => {
        const x = x0 + k * (tw + 18);
        const escura = telaEscura(t, k, n);
        const corTexto = escura ? C.branco : C.texto;
        const aqui = acoes.filter((a) => telaDaAcao(a, n, acoes) === k + 1);
        // Enquadramento do manual em 1080 × 1920: 96 de lado, 250 livres no topo e 340 embaixo.
        const mx = tw * 96 / 1080;
        const yTexto = y0 + th * 0.36;
        const blocos = [[{ t: t.titulo, b: 600, cor: corTexto }], ...(t.apoio ? [[{ t: t.apoio, cor: corTexto }]] : []), ...aqui.map((a) => [{ t: direcionamentoDe(a), b: 600, cor: escura ? '#D0D0D0' : C.claro }])];
        els.push({ tipo: 'retangulo', x, y: y0, w: tw, h: th, cor: escura ? A : C.telaClara });
        els.push(paragrafosQueCabem(blocos, x + mx, yTexto, tw - mx * 2, y0 + th * (1 - 340 / 1920) - yTexto, medir, { tam: 12.5, minimo: 6, entrelinha: 1.2, espaco: 0.5 }));
        els.push({ tipo: 'texto', x, y: y0 + th + 10, w: tw, tam: 8, f: 'isans', alinhar: 'l', runs: [{ t: `${t.n}${t.funcao ? ` · ${t.funcao.toUpperCase()}` : ''}`, b: 700, cor: C.texto }] });
        if (aqui.length) els.push(paragrafosQueCabem([[{ t: aqui.map(rotuloDaAcao).join(' · '), cor: C.claro }]], x, y0 + th + 26, tw, 30, medir, { tam: 8, minimo: 6, entrelinha: 1.25 }));
      });
    }
    slides.push({ id: `peca:${p.id}`, fundo: C.fundo, elementos: els });
  }
  // Para aprovar: o que o cliente confere e como pedir ajuste.
  slides.push({ id: 'final', fundo: C.fundo, elementos: [
    ...moldura(cron, A, 'Para aprovar', rodape),
    { tipo: 'texto', x: MARGEM, y: 70, w: LARG, tam: 30, f: 'serif', alinhar: 'l', runs: [{ t: 'Para aprovar', cor: C.texto }] },
    { tipo: 'retangulo', x: MARGEM, y: 160, w: LARG, h: 1, cor: C.linha },
    { tipo: 'paragrafos', x: MARGEM, y: 196, w: 900, h: 360, tam: 15, f: 'isans', entrelinha: 1.5, espaco: 16, paragrafos: [
      'Conferir datas, artes, legendas e textos dos stories.',
      'Confirmar a assinatura e o registro.',
      'Confirmar o link usado nos stories.',
      'Para pedir ajuste: responder citando a data do post ou do story.',
    ].map((t, i) => [{ t: `${String(i + 1).padStart(2, '0')}   `, b: 700, cor: A }, { t, cor: C.texto }]) },
  ] });
  return slides;
}

export const nomeDoArquivoDoCronograma = (cron, ext) => `Cronograma-${String(cron.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}-${ddmm(cron.inicio)}-a-${ddmm(cron.fim)}.${ext}`;

export function cronogramasDoCliente(config = [], cliente) {
  return config.filter((c) => !c.excluido_em && String(c.chave).startsWith(`${PREFIXO_CRONOGRAMA}${cliente}:`))
    .map((c) => normalizarCronograma(c.valor))
    .sort((a, z) => String(z.inicio).localeCompare(String(a.inicio)));
}
