// R7 (quarta casa do Trabalho; decisão da Carol, 16/11/2026). Sem DOM: o cadastro dos clientes,
// a rotina padrão de postagem, os modelos de stories, o contador do contrato, o perfil de voz
// (o que a IA lê) e o checador de voz que roda no aparelho, sem IA.
// Nada de dado real de cliente aqui: nomes, CRM, quadros e links ficam só no banco.

import { especialidade, especialidadeDoTexto } from './especialidades.js';

export const LIMITE_PADRAO = 10; // o contrato fala em até 10; do 11º em diante é "extra"
export const DIAS = [
  { n: 1, curto: 'seg', nome: 'Segunda' }, { n: 2, curto: 'ter', nome: 'Terça' }, { n: 3, curto: 'qua', nome: 'Quarta' },
  { n: 4, curto: 'qui', nome: 'Quinta' }, { n: 5, curto: 'sex', nome: 'Sexta' }, { n: 6, curto: 'sáb', nome: 'Sábado' },
];
export const FORMATOS = [
  { id: 'carrossel', nome: 'Carrossel' }, { id: 'estatico', nome: 'Estático' }, { id: 'video', nome: 'Vídeo' }, { id: 'post', nome: 'Post' },
];
export const TIPOS_VIDEO = [
  { id: 'conteudo', nome: 'Conteúdo' }, { id: 'trend', nome: 'Trend' }, { id: 'caixinha', nome: 'Caixinha de pergunta' },
  { id: 'bastidor', nome: 'Bastidor' }, { id: 'depoimento', nome: 'Depoimento' }, { id: 'podcast', nome: 'Podcast' },
];
export const ESTILO_VISUAL = ['clean', 'elegante', 'colorido', 'minimalista', 'sofisticado', 'divertido'];
export const ESTILO_CONTEUDO = ['técnico', 'acolhedor', 'provocativo', 'didático', 'inspirador', 'próximo'];
// Cada tipo de story é um modelo com os campos dele (a grade do cronograma usa isto na etapa 3).
export const MODELOS_STORY = [
  { id: 'contexto_enquete', nome: 'Story 1 contexto + aprofundamento, Story 2 interação + repost (enquete)', campos: ['story1', 'story2', 'enquete'] },
  { id: 'caixinha', nome: 'Caixinha de pergunta', campos: ['pergunta'] },
  { id: 'bomdia', nome: 'Stories de bom dia', campos: ['texto'] },
  { id: 'enquete', nome: 'Enquete', campos: ['pergunta', 'opcoes'] },
  { id: 'repost', nome: 'Repost', campos: ['texto'] },
];
const IDS_STORY = MODELOS_STORY.map((m) => m.id);
const IDS_FORMATO = FORMATOS.map((f) => f.id);
const IDS_VIDEO = TIPOS_VIDEO.map((t) => t.id);

const limpo = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const texto = (v, max = 4000) => String(v ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const link = (v) => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || '').trim()) ? String(v).trim().slice(0, 500) : '');
const lista = (v, max = 20, tam = 120) => (Array.isArray(v) ? v : String(v || '').split(/\n|,/)).map((x) => limpo(x, tam)).filter(Boolean).slice(0, max);
const umDe = (v, ids, padrao) => (ids.includes(v) ? v : padrao);

// A rotina padrão (Carol, 16/11/2026): post na segunda, quarta e sexta; stories na terça
// (contexto + enquete) e na quinta (caixinha). Ela ajusta por cliente.
export function rotinaPadrao() {
  return {
    feed: [{ dia: 1, formato: 'post', qtd: 1 }, { dia: 3, formato: 'post', qtd: 1 }, { dia: 5, formato: 'post', qtd: 1 }],
    stories: { tem: true, dias: { 2: 'contexto_enquete', 4: 'caixinha' } },
    formatosPreferidos: ['carrossel', 'estatico', 'video'],
    naoGosta: '',
    videos: { tipos: ['conteudo', 'trend'], preferidos: ['conteudo'], porSemana: 2 },
    estilo: { visual: [], conteudo: [], corDestaque: '' },
    grupo: '',            // rodízio: '' (a definir), 'A' ou 'B'
    aprovacao: '',
  };
}

export function fichaR7Vazia() {
  return {
    identificacao: { assinatura: '', especialidade: '', instagram: '', cidade: '', perfil: '' },
    briefing: { publico: '', tom: '', pode: '', naoPode: '', diferenciais: '', procedimentos: '', cta: '', agendamento: '', inspiracoes: [], idVisual: '', observacoes: '' },
    rotina: rotinaPadrao(),
    equipe: { quadro: '', designer: '', lista: '' },
    contato: { grupo: '', aprova: '' },
    links: { drive: '', videos: '', ultimoCronograma: '' },
  };
}

// Confere a ficha que vem do formulário (ou do banco): tamanhos, listas, ids válidos, links só https.
export function conferirFichaR7(f = {}) {
  const v = fichaR7Vazia();
  const id = f.identificacao || {}, b = f.briefing || {}, r = f.rotina || {}, e = f.equipe || {}, c = f.contato || {}, l = f.links || {};
  const feed = (Array.isArray(r.feed) ? r.feed : v.rotina.feed)
    .map((x) => ({ dia: Number(x?.dia), formato: umDe(x?.formato, IDS_FORMATO, 'post'), qtd: Math.max(1, Math.min(5, Number(x?.qtd) || 1)) }))
    .filter((x) => x.dia >= 1 && x.dia <= 6)
    .sort((a, z) => a.dia - z.dia);
  const diasStory = {};
  for (const [dia, modelo] of Object.entries(r.stories?.dias || (r.stories ? {} : v.rotina.stories.dias))) {
    const n = Number(dia);
    if (n >= 1 && n <= 6 && IDS_STORY.includes(modelo)) diasStory[n] = modelo;
  }
  return {
    identificacao: {
      assinatura: limpo(id.assinatura, 160), especialidade: especialidade(id.especialidade) ? id.especialidade : '',
      instagram: limpo(id.instagram, 60).replace(/^@?/, id.instagram ? '@' : ''), cidade: limpo(id.cidade, 80), perfil: link(id.perfil),
    },
    briefing: {
      publico: texto(b.publico, 1200), tom: texto(b.tom, 1200), pode: texto(b.pode, 1200), naoPode: texto(b.naoPode, 1200),
      diferenciais: texto(b.diferenciais, 1200), procedimentos: texto(b.procedimentos, 1200), cta: limpo(b.cta, 200),
      agendamento: link(b.agendamento), inspiracoes: lista(b.inspiracoes, 10, 500).map(link).filter(Boolean),
      idVisual: link(b.idVisual), observacoes: texto(b.observacoes, 2000),
    },
    rotina: {
      feed: feed.length ? feed : v.rotina.feed,
      stories: { tem: r.stories ? r.stories.tem !== false : true, dias: diasStory },
      formatosPreferidos: lista(r.formatosPreferidos, 4, 20).filter((x) => IDS_FORMATO.includes(x)),
      naoGosta: texto(r.naoGosta, 600),
      videos: {
        tipos: lista(r.videos?.tipos, 6, 20).filter((x) => IDS_VIDEO.includes(x)),
        preferidos: lista(r.videos?.preferidos, 6, 20).filter((x) => IDS_VIDEO.includes(x)),
        porSemana: Math.max(0, Math.min(10, Number(r.videos?.porSemana ?? 2) || 0)),
      },
      estilo: {
        visual: lista(r.estilo?.visual, 6, 30), conteudo: lista(r.estilo?.conteudo, 6, 30),
        corDestaque: /^#[0-9a-f]{6}$/i.test(r.estilo?.corDestaque || '') ? r.estilo.corDestaque : '',
      },
      grupo: ['A', 'B'].includes(r.grupo) ? r.grupo : '',
      aprovacao: texto(r.aprovacao, 400),
    },
    equipe: { quadro: limpo(e.quadro, 80), designer: limpo(e.designer, 60), lista: limpo(e.lista, 120) },
    contato: { grupo: limpo(c.grupo, 120), aprova: limpo(c.aprova, 120) },
    links: { drive: link(l.drive), videos: link(l.videos), ultimoCronograma: link(l.ultimoCronograma) },
  };
}

// A ficha em texto, para dados.ficha (é o que o Criar, a Pauta e o Radar já leem).
export function fichaEmTexto(nome, f) {
  const r = f.rotina;
  const esp = especialidade(f.identificacao.especialidade);
  const dia = (n) => DIAS.find((d) => d.n === Number(n))?.curto || '';
  const nomeDe = (lista2, id2) => lista2.find((x) => x.id === id2)?.nome || id2;
  const linhas = [
    `# ${nome} (R7)`,
    f.identificacao.assinatura && `Assinatura: ${f.identificacao.assinatura}`,
    esp && `Especialidade: ${esp.nome}`,
    f.identificacao.instagram && `Instagram: ${f.identificacao.instagram}`,
    f.identificacao.cidade && `Cidade: ${f.identificacao.cidade}`,
    f.briefing.publico && `Público: ${f.briefing.publico}`,
    f.briefing.tom && `Tom de voz: ${f.briefing.tom}`,
    f.briefing.pode && `Pode falar: ${f.briefing.pode}`,
    f.briefing.naoPode && `Não pode falar: ${f.briefing.naoPode}`,
    f.briefing.diferenciais && `Diferenciais: ${f.briefing.diferenciais}`,
    f.briefing.procedimentos && `Procedimentos e métodos: ${f.briefing.procedimentos}`,
    f.briefing.cta && `CTA: ${f.briefing.cta}${f.briefing.agendamento ? ` (agendamento: ${f.briefing.agendamento})` : ''}`,
    `Feed: ${r.feed.map((x) => `${dia(x.dia)} ${nomeDe(FORMATOS, x.formato).toLowerCase()}${x.qtd > 1 ? ` ×${x.qtd}` : ''}`).join(', ')}`,
    r.stories.tem ? `Stories: ${Object.entries(r.stories.dias).map(([d, m]) => `${dia(d)} ${nomeDe(MODELOS_STORY, m)}`).join('; ') || 'sim'}` : 'Sem stories',
    r.formatosPreferidos.length && `Prefere: ${r.formatosPreferidos.map((x) => nomeDe(FORMATOS, x).toLowerCase()).join(', ')}`,
    r.naoGosta && `Não gosta: ${r.naoGosta}`,
    r.videos.tipos.length && `Vídeos: ${r.videos.tipos.map((x) => nomeDe(TIPOS_VIDEO, x).toLowerCase()).join(', ')} (${r.videos.porSemana} por semana)`,
    (r.estilo.visual.length || r.estilo.conteudo.length) && `Estilo: ${[...r.estilo.visual, ...r.estilo.conteudo].join(', ')}`,
    f.briefing.observacoes && `Observações: ${f.briefing.observacoes}`,
  ];
  return linhas.filter(Boolean).join('\n');
}

// O nicho da ficha (vale para as datas da saúde, o Radar e o CTA) sai da especialidade escolhida.
export const nichoDaFicha = (f) => especialidade(f?.identificacao?.especialidade)?.nome || '';
export const especialidadeSugerida = (textoLivre) => especialidadeDoTexto(textoLivre)?.id || '';

// Contador do contrato: X de 10; do 11º em diante (pela ordem de cadastro) é "extra".
export function contadorR7(clientes, limite = LIMITE_PADRAO) {
  const vivos = (clientes || []).filter((c) => !c.excluido_em && c.casa === 'r7')
    .sort((a, z) => String(a.criado_em || '').localeCompare(String(z.criado_em || '')) || String(a.nome).localeCompare(String(z.nome), 'pt-BR'));
  const lim = Math.max(1, Number(limite) || LIMITE_PADRAO);
  return { total: vivos.length, limite: lim, extras: vivos.slice(lim).map((c) => c.chave), dentro: Math.min(vivos.length, lim) };
}

export function chaveDoNome(nome) {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(dra?|dr)\.?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cliente';
}

// Configuração geral da R7 (config "r7"): limite do contrato, quadros dos designers (um por linha;
// ficam só no banco) e o grupo de gestão para onde vai a demanda de vídeos.
export function configR7(linhas) {
  const v = (linhas || []).find((l) => l.chave === 'r7' && !l.excluido_em)?.valor || {};
  return {
    limite: Math.max(1, Number(v.limite) || LIMITE_PADRAO),
    quadros: lista(v.quadros, 12, 80),
    grupoGestao: limpo(v.grupoGestao, 120),
  };
}

// ---------------------------------------------------------------------------
// Perfil de voz (o que a IA lê das fontes; ela confere e edita antes de salvar)
// Cada item: { valor, fonte } (fonte = id do texto de onde saiu; sem base, fica vazio).
// ---------------------------------------------------------------------------

export const CAMPOS_VOZ = [
  { id: 'pessoa', nome: 'Pessoa do discurso', ajuda: 'eu, nós, a clínica' },
  { id: 'formalidade', nome: 'Formalidade' },
  { id: 'frases', nome: 'Tamanho das frases e dos parágrafos' },
  { id: 'abertura', nome: 'Como abre' },
  { id: 'cta', nome: 'CTA e caminho de agendamento' },
  { id: 'assinatura', nome: 'Assinatura' },
  { id: 'hashtags', nome: 'Hashtags' },
];
export const LISTAS_VOZ = [
  { id: 'expressoes', nome: 'Palavras e expressões que se repetem' },
  { id: 'nuncaUsa', nome: 'Palavras que nunca aparecem' },
  { id: 'emojis', nome: 'Emojis que usa' },
  { id: 'temas', nome: 'Temas recorrentes' },
  { id: 'exemplos', nome: 'Trechos-exemplo (copiados das fontes)' },
];

export function conferirVoz(p = {}, idsFontes = null) {
  const fonteOk = (f) => (idsFontes ? idsFontes.includes(f) : typeof f === 'string') ? limpo(f, 80) : '';
  const item = (x) => {
    const valor = limpo(x?.valor, 300);
    const fonte = fonteOk(x?.fonte);
    return valor && (fonte || !idsFontes) ? { valor, fonte } : { valor: '', fonte: '' };
  };
  const saida = {};
  for (const c of CAMPOS_VOZ) saida[c.id] = item(p[c.id]);
  for (const l of LISTAS_VOZ) {
    saida[l.id] = (Array.isArray(p[l.id]) ? p[l.id] : []).map(item).filter((x) => x.valor).slice(0, l.id === 'exemplos' ? 3 : 15);
  }
  saida.usaEmoji = typeof p.usaEmoji === 'boolean' ? p.usaEmoji : null;
  saida.usaHashtag = typeof p.usaHashtag === 'boolean' ? p.usaHashtag : null;
  saida.palavrasPorFrase = Math.max(0, Math.min(60, Math.round(Number(p.palavrasPorFrase) || 0)));
  return saida;
}

// O que mudou entre o perfil salvo e o novo ("Atualizar a voz" mostra isto).
export function diferencaDaVoz(antes = {}, depois = {}) {
  const mudou = [];
  for (const c of CAMPOS_VOZ) if ((antes[c.id]?.valor || '') !== (depois[c.id]?.valor || '')) mudou.push(c.nome);
  for (const l of LISTAS_VOZ) {
    const a = new Set((antes[l.id] || []).map((x) => x.valor)), d = new Set((depois[l.id] || []).map((x) => x.valor));
    if (a.size !== d.size || [...d].some((x) => !a.has(x))) mudou.push(l.nome);
  }
  return mudou;
}

// ---------------------------------------------------------------------------
// Checador de voz: roda no aparelho, sem IA (não gasta crédito). Compara a copy com o perfil.
// ---------------------------------------------------------------------------

const RE_EMOJI = /\p{Extended_Pictographic}/gu;
export function checarVoz(copy, voz = {}, ficha = null) {
  const t = String(copy || '');
  const avisos = [];
  if (!t.trim()) return { estado: 'vazio', avisos };
  const emojis = [...new Set(t.match(RE_EMOJI) || [])];
  const permitidos = new Set((voz.emojis || []).map((x) => x.valor).join('').match(RE_EMOJI) || []);
  if (emojis.length && voz.usaEmoji === false) avisos.push(`Emoji, e o perfil diz que não usa: ${emojis.join(' ')}`);
  else if (emojis.length && permitidos.size) {
    const fora = emojis.filter((e) => !permitidos.has(e));
    if (fora.length) avisos.push(`Emoji que o cliente não costuma usar: ${fora.join(' ')}`);
  }
  const limite = voz.palavrasPorFrase ? Math.round(voz.palavrasPorFrase * 1.8) + 4 : 32;
  const longas = t.split(/(?<=[.!?])\s+|\n+/).filter((f) => f.split(/\s+/).filter(Boolean).length > limite);
  if (longas.length) avisos.push(`${longas.length === 1 ? 'Uma frase longa' : `${longas.length} frases longas`} para o jeito do cliente (mais de ${limite} palavras)`);
  if (voz.usaHashtag === false && /(^|\s)#[\p{L}\d_]+/u.test(t)) avisos.push('Hashtag, e o perfil diz que não usa');
  const assinatura = voz.assinatura?.valor || ficha?.identificacao?.assinatura || '';
  if (assinatura && !t.includes(assinatura)) avisos.push('Falta a assinatura do cliente no fim');
  const nunca = (voz.nuncaUsa || []).map((x) => x.valor).filter((x) => x.length > 2)
    .filter((x) => new RegExp(`(^|[^\\p{L}])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(t));
  if (nunca.length) avisos.push(`Palavra que o cliente nunca usa: ${nunca.join(', ')}`);
  const cta = voz.cta?.valor || ficha?.briefing?.cta || '';
  if (cta && /agend|whats|link/i.test(cta) && !/agend|whats|link|marque|marcar/i.test(t)) avisos.push('O convite para agendar não aparece');
  return { estado: avisos.length ? 'atencao' : 'combina', avisos };
}

// Fontes para ler a voz: as copys aprovadas que já estão na Bússola, a memória e os textos colados.
// Até 30, as mais recentes primeiro (cada uma com até 4.000 letras).
export function fontesDaVoz({ rascunhos = [], memoria = [], coladas = [] }) {
  const saida = [];
  for (const c of coladas) if (String(c.texto || '').trim()) saida.push({ id: c.id, fonte: c.fonte || 'Texto colado', texto: texto(c.texto, 4000), em: c.em || '' });
  for (const r of rascunhos) if (String(r.texto || '').trim()) saida.push({ id: `rascunho:${r.id}`, fonte: `Copy na Bússola${r.tema ? `: ${limpo(r.tema, 60)}` : ''}`, texto: texto(r.texto, 4000), em: r.atualizado_em || '' });
  for (const m of memoria) if (String(m.texto || '').trim()) saida.push({ id: `memoria:${m.id}`, fonte: 'Memória de feedback', texto: texto(m.texto, 1000), em: m.em || '' });
  return saida.sort((a, z) => String(z.em).localeCompare(String(a.em))).slice(0, 30);
}
