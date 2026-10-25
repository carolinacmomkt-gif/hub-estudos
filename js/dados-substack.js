// Substack: pautas em etapas (ideia → rascunho → revisão → publicado), meta e o texto.

import { contarPalavras } from './dados-biblioteca.js';

export const ETAPAS_SUBSTACK = [
  { id: 'ideia', nome: 'Ideia' },
  { id: 'rascunho', nome: 'Rascunho' },
  { id: 'revisao', nome: 'Revisão' },
  { id: 'publicado', nome: 'Publicado' },
];
export const CHECKLIST_SUBSTACK = [
  { id: 'titulo', texto: 'Título forte e subtítulo que puxa a leitura' },
  { id: 'abertura', texto: 'Primeiro parágrafo prende (sem rodeio)' },
  { id: 'revisao', texto: 'Revisão de português e de ritmo (ler em voz alta)' },
  { id: 'links', texto: 'Links e referências conferidos' },
  { id: 'imagem', texto: 'Imagem de capa' },
  { id: 'cta', texto: 'Convite para assinar ou comentar no fim' },
  { id: 'previa', texto: 'Prévia do e-mail conferida no Substack' },
];
export const META_PADRAO = { porMes: 4 };
export const PALAVRAS_MINUTO_LEITURA = 220;

export const nomeEtapaSubstack = (id) => ETAPAS_SUBSTACK.find((e) => e.id === id)?.nome || 'Ideia';

export function pautasAtivas(estado) {
  return (estado.pautas || []).filter((p) => !p.excluido_em);
}

export function pautaPeloId(estado, id) {
  return pautasAtivas(estado).find((p) => p.id === id) || null;
}

export function pautasDaEtapa(estado, etapa) {
  return pautasAtivas(estado).filter((p) => (p.etapa || 'ideia') === etapa).sort((a, b) => {
    // Agendadas primeiro (pela data); depois as mexidas por último.
    if (a.agendado_para && b.agendado_para) return String(a.agendado_para).localeCompare(String(b.agendado_para));
    if (a.agendado_para || b.agendado_para) return a.agendado_para ? -1 : 1;
    return String(b.atualizado_em).localeCompare(String(a.atualizado_em));
  });
}

export function etapaVizinhaSubstack(etapa, passo) {
  const i = ETAPAS_SUBSTACK.findIndex((e) => e.id === etapa);
  return ETAPAS_SUBSTACK[Math.max(0, Math.min(ETAPAS_SUBSTACK.length - 1, i + passo))].id;
}

export function configSubstack(estado) {
  const v = (estado.config || []).find((c) => c.chave === 'substack' && !c.excluido_em)?.valor || {};
  return { porMes: Math.max(1, Math.min(30, Number(v.porMes) || META_PADRAO.porMes)), nome: v.nome || '' };
}

export function publicadosNoMesSubstack(estado, agora = Date.now()) {
  const d = new Date(agora);
  return pautasAtivas(estado).filter((p) => {
    if (p.etapa !== 'publicado' || !p.publicado_em) return false;
    const t = new Date(p.publicado_em);
    return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
  });
}

export function proximaAgendada(estado, agora = Date.now()) {
  return pautasAtivas(estado)
    .filter((p) => p.etapa !== 'publicado' && p.agendado_para && new Date(p.agendado_para).getTime() >= agora - 24 * 60 * 60 * 1000)
    .sort((a, b) => String(a.agendado_para).localeCompare(String(b.agendado_para)))[0] || null;
}

export function estatisticasDoTexto(texto) {
  const palavras = contarPalavras(texto);
  return {
    palavras,
    minutos: palavras ? Math.max(1, Math.round(palavras / PALAVRAS_MINUTO_LEITURA)) : 0,
    paragrafos: String(texto || '').split(/\n\s*\n/).filter((p) => p.trim()).length,
  };
}

export function progressoChecklistSubstack(pauta) {
  const feitos = CHECKLIST_SUBSTACK.filter((c) => pauta.checklist?.[c.id]).length;
  return { feitos, total: CHECKLIST_SUBSTACK.length, fracao: feitos / CHECKLIST_SUBSTACK.length };
}

// ---------------------------------------------------------------------------
// Markdown simples (o que o editor do Substack aceita colar): títulos, negrito, itálico,
// citações, listas e links. Tudo é escapado antes; só links http(s) viram <a>.
// ---------------------------------------------------------------------------

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function emLinha(t) {
  return escapar(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, txt, url) => `<a href="${url}">${txt}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
}

export function markdownParaHtml(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n');
  const saida = [];
  let lista = null; // 'ul' | 'ol'
  let paragrafo = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) saida.push(`<p>${paragrafo.map(emLinha).join('<br>')}</p>`);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) saida.push(`</${lista}>`);
    lista = null;
  };
  for (const linha of linhas) {
    const t = linha.trim();
    let m;
    if (!t) {
      fecharParagrafo();
      fecharLista();
    } else if ((m = t.match(/^(#{1,3})\s+(.+)$/))) {
      fecharParagrafo();
      fecharLista();
      const n = Math.min(4, m[1].length + 1);
      saida.push(`<h${n}>${emLinha(m[2])}</h${n}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      fecharParagrafo();
      fecharLista();
      saida.push('<hr>');
    } else if ((m = t.match(/^>\s?(.*)$/))) {
      fecharParagrafo();
      fecharLista();
      saida.push(`<blockquote><p>${emLinha(m[1])}</p></blockquote>`);
    } else if ((m = t.match(/^[-*•]\s+(.+)$/)) || (m = t.match(/^\d+[.)]\s+(.+)$/))) {
      fecharParagrafo();
      const tipo = /^\d/.test(t) ? 'ol' : 'ul';
      if (lista !== tipo) {
        fecharLista();
        saida.push(`<${tipo}>`);
        lista = tipo;
      }
      saida.push(`<li>${emLinha(m[1])}</li>`);
    } else {
      fecharLista();
      paragrafo.push(t);
    }
  }
  fecharParagrafo();
  fecharLista();
  // Junta as citações seguidas num bloco só.
  return saida.join('\n').replace(/<\/blockquote>\n<blockquote>/g, '\n');
}

// O texto completo da pauta, em Markdown (título, subtítulo e corpo).
export function markdownDaPauta(pauta) {
  return [`# ${pauta.titulo}`, pauta.subtitulo ? `*${pauta.subtitulo}*` : '', pauta.texto || ''].filter(Boolean).join('\n\n');
}

export function htmlDaPauta(pauta) {
  return [`<h1>${escapar(pauta.titulo)}</h1>`, pauta.subtitulo ? `<h3>${escapar(pauta.subtitulo)}</h3>` : '', markdownParaHtml(pauta.texto)].filter(Boolean).join('\n');
}

// Texto puro (sem marcações), para quem cola em lugar que não aceita formatação.
export function textoPuroDaPauta(pauta) {
  const div = markdownParaHtml(pauta.texto).replace(/<\/(p|h\d|li|blockquote)>/g, '\n\n').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
  const sem = div.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [pauta.titulo, pauta.subtitulo, sem.replace(/\n{3,}/g, '\n\n').trim()].filter(Boolean).join('\n\n');
}

// Data agendada vira evento do Calendário (tipo "substack").
export function eventoDaPauta(pauta) {
  if (!pauta.agendado_para || pauta.etapa === 'publicado') return null;
  return {
    origem_id: `${pauta.id}:publicar`,
    titulo: `Publicar no Substack: ${pauta.titulo}`.slice(0, 140),
    inicio: new Date(pauta.agendado_para).toISOString(),
    fim: null,
    dia_inteiro: false,
    descricao: pauta.subtitulo || null,
  };
}
