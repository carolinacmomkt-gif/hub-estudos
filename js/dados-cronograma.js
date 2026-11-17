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

export function periodoEmTexto(inicio, fim) {
  const [, mi, di] = inicio.split('-').map(Number);
  const [, mf, df] = fim.split('-').map(Number);
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

// Figurinha que entra por cima da sequência, pelo modelo de story da rotina.
const FIGURINHA_DO_MODELO = { contexto_enquete: 'enquete Sim / Não', enquete: 'enquete Sim / Não', caixinha: 'caixinha de perguntas', repost: 'repost do post do dia', bomdia: '' };
export const FUNCOES_TELA = ['gancho', 'pergunta', 'desenvolvimento', 'solução', 'chamada'];

const novoId = (data, tipo, i) => `${data}-${tipo}-${i}`;

export function pecaVazia(data, tipo, extra = {}) {
  return {
    id: extra.id || novoId(data, tipo, Math.random().toString(36).slice(2, 7)),
    data, tipo, formato: tipo === 'post' ? (extra.formato || 'carrossel') : '', modelo: ehStory({ tipo }) ? (extra.modelo || (tipo === 'bomdia' ? 'bomdia' : 'contexto_enquete')) : '',
    tema: '', legenda: '', slides: '', video: '', capa: '', telas: '',
    figurinha: ehStory({ tipo }) ? (FIGURINHA_DO_MODELO[extra.modelo || (tipo === 'bomdia' ? 'bomdia' : 'contexto_enquete')] ?? '') : '',
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
    if (modelo) pecas.push(pecaVazia(dia, modelo === 'bomdia' ? 'bomdia' : 'story', { id: novoId(dia, 'story', 0), modelo }));
  }
  return pecas;
}

export function cronogramaVazio({ cliente, nome, inicio, fim, rotina }) {
  return { cliente, nome, inicio, fim, pecas: gradeDoPeriodo(rotina, inicio, fim), marcas: {}, checklist: {}, criado_em: new Date().toISOString() };
}

// Cronogramas antigos (Story 1/Story 2/enquete) viram sequência de telas.
function migrarStory(p) {
  if (!ehStory(p) || p.telas || !(p.story1 || p.story2 || p.pergunta)) return p;
  const telas = [p.story1 && `Tela 1 (gancho): ${p.story1}`, p.story2 && `Tela 2 (pergunta): ${p.story2}`, p.pergunta && `Tela ${p.story2 ? 3 : 2} (pergunta): ${p.pergunta}`].filter(Boolean).join('\n');
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

export function oQueFalta(p, { assinatura = '', voz = {}, ficha = null } = {}) {
  const falta = [];
  const atencao = [];
  if (ehFeed(p)) {
    if (!p.tema.trim()) atencao.push('sem tema');
    if (!p.legenda.trim()) falta.push('legenda');
    else {
      if (assinatura && !p.legenda.includes(assinatura)) falta.push('assinatura');
      if (/[—–]/.test(p.legenda)) atencao.push('travessão');
      for (const a of checarVoz(p.legenda, voz, ficha).avisos) if (!/assinatura/i.test(a)) atencao.push(a);
    }
    if (p.tipo === 'post' && p.formato === 'carrossel' && !p.slides.trim()) falta.push('lâminas');
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
    if (telas.some((t) => t.apoio.length > 110)) atencao.push('texto de apoio longo (até duas linhas)');
    if (p.tipo === 'story' && !p.figurinha.trim()) atencao.push('sem interação (enquete, caixinha, link ou repost)');
  }
  return { falta, atencao, pronta: !falta.length && (!atencao.length || p.pode) };
}

export function resumoDoQueFalta(cron, contexto) {
  const itens = cron.pecas.map((p) => ({ p, ...oQueFalta(p, contexto) }));
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

// Checklist final do manual (a Carol marca antes de enviar).
export const CHECKLIST_FINAL = [
  'Duplicado do último cronograma e com datas certas',
  'Resumo bate com as páginas',
  'Todas as lâminas, capas e links do vídeo no lugar',
  'Legendas revisadas, no tom e com assinatura',
  'Stories sem palavra sozinha e com contraste',
  'Sombra leve, longe do rosto',
  'Direcionamentos só em texto',
  'Arquivos nomeados e na pasta de cada peça',
];

// ---------------------------------------------------------------------------
// Pedido para o Claude e leitura da resposta
// ---------------------------------------------------------------------------

function blocoModelo(p) {
  const cab = `### ${ddmm(p.data)} · ${rotuloDe(p.tipo)}${p.tipo === 'post' && p.formato && p.formato !== 'post' ? ` · ${formatoDaPeca(p)}` : ''}`;
  if (p.tipo === 'post') return [cab, 'Tema:', 'Legenda:', ...(p.formato === 'carrossel' ? ['Slides:', 'Slide 01 | Capa (indicação de foto): texto'] : [])].join('\n');
  if (p.tipo === 'reels') return [cab, 'Tema:', 'Texto da capa:', 'Legenda:'].join('\n');
  if (p.tipo === 'bomdia') return [cab, 'Tela 1 (gancho): título | texto de apoio'].join('\n');
  return [cab, 'Tela 1 (gancho): título | texto de apoio', 'Tela 2 (pergunta): título | texto de apoio', 'Tela 3 (chamada): título | texto de apoio', `Figurinha: ${p.figurinha || 'enquete Sim / Não'}`].join('\n');
}

// O que vai para o Claude: a ficha, a voz, as regras do manual e os blocos que faltam, no formato que o app
// lê de volta.
export function pedidoParaClaude(cron, { nome, fichaTexto = '', voz = {}, nicho = '', assinatura = '' }, contexto = {}) {
  const r = resumoDoQueFalta(cron, { ...contexto, assinatura, voz });
  const faltando = r.itens.filter((x) => x.falta.length || x.atencao.some((a) => /telas|interação/.test(a))).map((x) => x.p);
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
    '- Português do Brasil, frases curtas, sem travessão, sem hashtag (a não ser que a ficha peça), sem promessa de resultado.',
    `- ${regraDoCta(esp?.nome || nicho)}`,
    '- Carrossel: "Slides:" com a copy lâmina por lâmina, uma por linha: "Slide 01 | Capa (indicação de foto): texto".',
    '- Reel: "Texto da capa:" curto, separado da legenda, para o cliente revisar.',
    '- Stories: de 3 a 5 telas. Abra com um gancho (pergunta ou afirmação), desenvolva em uma ou duas telas e feche com a chamada. Uma ideia por tela: título curto | texto de apoio de no máximo duas linhas. Enquete ou caixinha no começo da sequência, link na última tela, repost do post do feed no dia em que ele sai. "Figurinha:" diz o que entra por cima (enquete com as opções, caixinha, link ou repost).',
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
  ['capa', /^(texto da capa|capa)$/], ['figurinha', /^(figurinha|interacao|enquete|caixinha)$/],
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
  return [cab, ...lerTelas(p.telas).map((t) => `${t.n}. ${t.titulo}${t.apoio ? ` · ${t.apoio}` : ''}`), ...(p.figurinha ? [`Por cima: ${p.figurinha.replace(/\s*\/\s*/g, ' · ')}`] : [])].join('\n');
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

// Copy do carrossel no formato dos designers ("Slide 01 | Capa (foto)" + texto), para colar no cartão do Trello.
export function textoParaTrello(p, nome = '') {
  return [`${nome ? `${nome} · ` : ''}${tituloDaPeca(p)}${p.tema ? ` · ${p.tema}` : ''}`, '', p.slides || p.legenda || ''].join('\n').trim();
}

const nomeDePasta = (t) => String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

// Onde vai a figurinha: enquete e caixinha no começo da sequência, link e repost na última tela.
function telaDaFigurinha(p, total) {
  if (!p.figurinha) return 0;
  return /link|repost/i.test(p.figurinha) ? total : Math.min(2, total);
}

// Entrega no Drive (manual, parte 3): uma pasta por peça, numerada na ordem de postagem, e os nomes dos arquivos.
export function nomesDaEntrega(cron) {
  let sequencia = 0;
  return cron.pecas.map((p, i) => {
    const pasta = `${String(i + 1).padStart(2, '0')} - ${ddmm(p.data)} - ${formatoDaPeca(p)}${p.tema ? ` - ${nomeDePasta(p.tema)}` : ''}`;
    let arquivos;
    if (p.tipo === 'post' && p.formato === 'carrossel') {
      const n = Math.max(1, lerLaminas(p.slides).length);
      arquivos = [...Array.from({ length: n }, (_, k) => `${String(k + 1).padStart(2, '0')}.jpg`), 'Legenda'];
    } else if (p.tipo === 'reels') {
      arquivos = ['video.mp4', 'capa.jpg', 'Legenda'];
    } else if (p.tipo === 'post') {
      arquivos = ['01.jpg', 'Legenda'];
    } else {
      sequencia += 1;
      const telas = Math.max(1, lerTelas(p.telas).length);
      const naFigurinha = telaDaFigurinha(p, telas);
      const acao = p.figurinha.replace(/\s*\/\s*/g, ' ou ').replace(/^repost.*$/i, 'repost do post do dia').trim();
      arquivos = Array.from({ length: telas }, (_, k) => `S${sequencia}_${k + 1}${k + 1 === naFigurinha && acao ? ` - ${acao}` : ''}.jpg`);
    }
    return { pasta, arquivos };
  });
}

export function textoDaEntrega(cron) {
  return nomesDaEntrega(cron).map((x) => `${x.pasta}\n${x.arquivos.map((a) => `  ${a}`).join('\n')}`).join('\n\n');
}

// ---------------------------------------------------------------------------
// Slides do PDF/PPTX (manual, parte 1): fundo branco, poucos elementos, tipografia organizada
// ---------------------------------------------------------------------------

export const CORES_CRONOGRAMA = { fundo: '#FFFFFF', texto: '#1F1F1F', suave: '#6B6B6B', claro: '#9A9A9A', linha: '#E6E6E6', caixa: '#F5F5F5', acentoPadrao: '#1F1F1F' };
const corOk = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : CORES_CRONOGRAMA.acentoPadrao);

function caber(medir, t, tam, largura, f, negrito = true, minimo = 14) {
  let s = tam;
  while (s > minimo && medir(t, s, negrito, f) > largura) s -= 1;
  return s;
}

function paragrafosQueCabem(blocos, x, y, w, h, medir, { f = 'lato', tam = 20, minimo = 11, entrelinha = 1.35 } = {}) {
  let s = tam;
  const altura = (t) => blocos.reduce((soma, b) => soma + quebrar(b.map((r) => ({ ...r, f: r.f || f })), w, t, medir).length * t * entrelinha, 0) + (blocos.length - 1) * t * 0.6;
  while (s > minimo && altura(s) > h) s -= 0.5;
  return { tipo: 'paragrafos', x, y, w, h, tam: s, f, entrelinha, espaco: s * 0.6, paragrafos: blocos };
}

const paragrafosDe = (t, cor = CORES_CRONOGRAMA.texto) => String(t || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => [{ t: l, cor }]);

// Cabeçalho das páginas de peça: data grande, título do post, dia da semana e formato.
function cabecalhoDaPeca(p, A, medir) {
  const C = CORES_CRONOGRAMA;
  const titulo = p.tema || formatoDaPeca(p);
  return [
    { tipo: 'texto', x: 64, y: 44, w: 200, tam: 54, f: 'raleway', alinhar: 'l', runs: [{ t: ddmm(p.data), b: true, cor: A }] },
    { tipo: 'texto', x: 250, y: 50, w: 886, tam: caber(medir, titulo, 30, 886, 'raleway'), f: 'raleway', alinhar: 'l', runs: [{ t: titulo, b: true, cor: C.texto }] },
    { tipo: 'texto', x: 250, y: 92, w: 886, tam: 17, f: 'lato', alinhar: 'l', runs: [{ t: `${nomeDoDia(p.data)} · ${formatoDaPeca(p)}`, cor: C.suave }] },
    { tipo: 'retangulo', x: 64, y: 132, w: 1072, h: 1, cor: C.linha },
  ];
}

function legendaEmBlocos(p, assinatura) {
  const C = CORES_CRONOGRAMA;
  const corpo = String(p.legenda || '').replace(assinatura || '\u0000', '').trim();
  const blocos = paragrafosDe(corpo);
  if (blocos.length) blocos[0] = [{ t: 'Legenda: ', b: true, cor: C.texto }, ...blocos[0]];
  if (assinatura && p.legenda.includes(assinatura)) blocos.push([{ t: assinatura, b: true, cor: C.texto }]);
  return blocos;
}

export function montarSlidesDoCronograma(cron, { cor = '', assinatura = '' } = {}, medir) {
  const C = CORES_CRONOGRAMA;
  const A = corOk(cor);
  const slides = [];
  // Capa: rótulo pequeno, nome em destaque, período por extenso e o total.
  slides.push({ id: 'capa', fundo: C.fundo, elementos: [
    { tipo: 'texto', x: 96, y: 210, w: 1008, tam: 20, f: 'lato', alinhar: 'l', runs: [{ t: 'Cronograma de conteúdo', b: true, cor: A }] },
    { tipo: 'texto', x: 96, y: 246, w: 1008, tam: caber(medir, cron.nome || '', 62, 1008, 'raleway'), f: 'raleway', alinhar: 'l', runs: [{ t: cron.nome || '', b: true, cor: C.texto }] },
    { tipo: 'texto', x: 96, y: 336, w: 1008, tam: 26, f: 'lato', alinhar: 'l', runs: [{ t: periodoEmTexto(cron.inicio, cron.fim), cor: C.texto }] },
    { tipo: 'texto', x: 96, y: 380, w: 1008, tam: 18, f: 'lato', alinhar: 'l', runs: [{ t: totaisDoCronograma(cron), cor: C.suave }] },
  ] });
  // Resumo da quinzena: data com dia da semana, formato, tema e página (feed em negrito, stories em cinza).
  const POR_PAGINA = 13;
  for (let i = 0; i < Math.max(1, cron.pecas.length); i += POR_PAGINA) {
    const els = [
      { tipo: 'texto', x: 64, y: 44, w: 1072, tam: 30, f: 'raleway', alinhar: 'l', runs: [{ t: 'Resumo da quinzena', b: true, cor: C.texto }] },
      ...[['Data', 64], ['Formato', 270], ['Tema', 470], ['Página', 1036]].map(([t, x]) => ({ tipo: 'texto', x, y: 112, w: 180, tam: 14, f: 'lato', alinhar: 'l', runs: [{ t: t.toUpperCase(), b: true, cor: C.claro }] })),
      { tipo: 'retangulo', x: 64, y: 138, w: 1072, h: 1, cor: C.linha },
    ];
    cron.pecas.slice(i, i + POR_PAGINA).forEach((p, k) => {
      const y = 152 + k * 37;
      const cor = ehStory(p) ? C.claro : C.texto;
      const b = !ehStory(p);
      const tema = p.tema || (ehStory(p) ? lerTelas(p.telas)[0]?.titulo || '' : '');
      els.push(
        { tipo: 'texto', x: 64, y, w: 200, tam: 16, f: 'lato', alinhar: 'l', runs: [{ t: `${CURTOS_DIA[diaDaSemana(p.data)]}, ${ddBarraMm(p.data)}`, b, cor }] },
        { tipo: 'texto', x: 270, y, w: 190, tam: 16, f: 'lato', alinhar: 'l', runs: [{ t: formatoDaPeca(p), b, cor }] },
        { tipo: 'texto', x: 470, y, w: 540, tam: caber(medir, tema, 16, 540, 'lato', b, 11), f: 'lato', alinhar: 'l', runs: [{ t: tema, b, cor }] },
        { tipo: 'texto', x: 1036, y, w: 100, tam: 16, f: 'lato', alinhar: 'l', runs: [{ t: String(cron.pecas.indexOf(p) + 2 + Math.ceil(cron.pecas.length / POR_PAGINA)), b, cor }] },
      );
    });
    slides.push({ id: `resumo:${i}`, fundo: C.fundo, elementos: els });
  }
  // Uma página por peça, na ordem de postagem.
  for (const p of cron.pecas) {
    const els = cabecalhoDaPeca(p, A, medir);
    const topo = 164;
    const altura = 675 - topo - 48;
    if (p.tipo === 'post' && p.formato === 'carrossel') {
      // Grade com todas as lâminas, na ordem (o texto de cada uma, enquanto não há arte), e a legenda ao lado.
      const laminas = lerLaminas(p.slides);
      const area = { x: 64, y: topo, w: 560, h: altura };
      const col = laminas.length > 6 ? 4 : 3;
      const lin = Math.max(1, Math.ceil(laminas.length / col));
      const lado = Math.min((area.w - (col - 1) * 10) / col, (area.h - (lin - 1) * 10) / lin);
      laminas.forEach((l, k) => {
        const x = area.x + (k % col) * (lado + 10);
        const y = area.y + Math.floor(k / col) * (lado + 10);
        els.push({ tipo: 'retangulo', x, y, w: lado, h: lado, cor: C.caixa });
        els.push({ tipo: 'texto', x: x + 10, y: y + 8, w: lado - 20, tam: 11, f: 'lato', alinhar: 'l', runs: [{ t: String(l.n).padStart(2, '0'), b: true, cor: A }] });
        els.push(paragrafosQueCabem([[{ t: l.texto, cor: C.texto }]], x + 10, y + 28, lado - 20, lado - 36, medir, { tam: 13, minimo: 7, entrelinha: 1.25 }));
      });
      els.push(paragrafosQueCabem(legendaEmBlocos(p, assinatura), 660, topo, 476, altura, medir, { tam: 17 }));
    } else if (p.tipo === 'reels') {
      // Capa à esquerda, "Assistir ao vídeo" ao lado, texto da capa separado e a legenda à direita.
      const w = 230;
      const h = w * 16 / 9 > altura - 60 ? altura - 60 : w * 16 / 9;
      els.push({ tipo: 'retangulo', x: 64, y: topo, w, h, cor: C.caixa });
      if (p.capa) els.push(paragrafosQueCabem([[{ t: p.capa, b: true, cor: C.texto }]], 84, topo + 24, w - 40, h - 48, medir, { tam: 20, minimo: 11, f: 'raleway' }));
      els.push({ tipo: 'texto', x: 64, y: topo + h + 14, w: w + 40, tam: 15, f: 'lato', alinhar: 'l', runs: [{ t: p.video ? 'Assistir ao vídeo' : '', b: true, cor: A }] });
      if (p.video) els.push({ tipo: 'texto', x: 64, y: topo + h + 36, w: 420, tam: 11, f: 'lato', alinhar: 'l', runs: [{ t: p.video.slice(0, 70), cor: C.suave }] });
      if (p.capa) els.push(paragrafosQueCabem([[{ t: 'Texto da capa: ', b: true, cor: C.texto }, { t: p.capa, cor: C.texto }]], 330, topo, 280, 120, medir, { tam: 16 }));
      els.push(paragrafosQueCabem(legendaEmBlocos(p, assinatura), 660, topo, 476, altura, medir, { tam: 17 }));
    } else if (p.tipo === 'post') {
      els.push(paragrafosQueCabem(legendaEmBlocos(p, assinatura), 64, topo, 1072, altura, medir, { tam: 20 }));
    } else {
      // Sequência de stories: as telas lado a lado na ordem, o número e a função embaixo, e o que entra por cima.
      const telas = lerTelas(p.telas);
      const n = Math.max(1, telas.length);
      const alturaTela = altura - 70;
      const larg = Math.min(alturaTela * 9 / 16, (1072 - (n - 1) * 16) / n);
      telas.forEach((t, k) => {
        const x = 64 + k * (larg + 16);
        els.push({ tipo: 'retangulo', x, y: topo, w: larg, h: alturaTela, cor: C.caixa });
        els.push(paragrafosQueCabem([[{ t: t.titulo, b: true, cor: C.texto, f: 'raleway' }], ...(t.apoio ? [[{ t: t.apoio, cor: C.texto }]] : [])], x + 14, topo + alturaTela * 0.16, larg - 28, alturaTela * 0.66, medir, { tam: 17, minimo: 9 }));
        els.push({ tipo: 'texto', x, y: topo + alturaTela + 10, w: larg, tam: 13, f: 'lato', alinhar: 'l', runs: [{ t: `${t.n}${t.funcao ? ` · ${t.funcao}` : ''}`, b: true, cor: C.suave }] });
      });
      if (p.figurinha) els.push({ tipo: 'texto', x: 64, y: 675 - 48, w: 1072, tam: 15, f: 'lato', alinhar: 'l', runs: [{ t: 'Por cima: ', b: true, cor: C.texto }, { t: p.figurinha.replace(/\s*\/\s*/g, ' · '), cor: C.texto }] });
    }
    slides.push({ id: `peca:${p.id}`, fundo: C.fundo, elementos: els });
  }
  // Para aprovar
  slides.push({ id: 'final', fundo: C.fundo, elementos: [
    { tipo: 'texto', x: 96, y: 150, w: 1008, tam: 40, f: 'raleway', alinhar: 'l', runs: [{ t: 'Para aprovar', b: true, cor: C.texto }] },
    { tipo: 'paragrafos', x: 96, y: 236, w: 900, h: 320, tam: 22, f: 'lato', entrelinha: 1.4, espaco: 14, paragrafos: [
      'Conferir datas, artes, legendas e textos dos stories.',
      'Confirmar assinatura e registro, quando houver.',
      'Confirmar o link usado nos stories.',
      'Para pedir ajuste: responder citando a data do post ou do story.',
    ].map((t, i) => [{ t: `${String(i + 1).padStart(2, '0')}   `, b: true, cor: A }, { t, cor: C.texto }]) },
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
