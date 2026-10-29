// Biblioteca: artigos salvos por link, PDF ou texto colado, com status, destaques e fichamento.

export const STATUS = [
  { id: 'ler', nome: 'Para ler' },
  { id: 'lendo', nome: 'Lendo' },
  { id: 'lido', nome: 'Lido' },
  { id: 'fichado', nome: 'Fichado' },
];
export const CORES_DESTAQUE = [
  { id: 'amarelo', nome: 'Amarelo' },
  { id: 'rosa', nome: 'Rosa' },
  { id: 'ciano', nome: 'Azul' },
  { id: 'verde', nome: 'Verde' },
];
export const PARTES_FICHAMENTO = [
  { id: 'referencia', nome: 'Referência', ajuda: 'Autor, título, onde saiu, ano.' },
  { id: 'tema', nome: 'Tema e objetivo', ajuda: 'Do que o texto trata e o que ele quer mostrar.' },
  { id: 'ideias', nome: 'Ideias principais', ajuda: 'Os argumentos, um por linha.' },
  { id: 'citacoes', nome: 'Citações', ajuda: 'Trechos para usar depois (com a página, se tiver).' },
  { id: 'analise', nome: 'Minha análise', ajuda: 'O que você achou, com o que concorda ou discorda.' },
  { id: 'uso', nome: 'Onde usar', ajuda: 'Trabalho, prova, texto do Substack…' },
];
export const PALAVRAS_POR_MINUTO = 200;

export const nomeStatus = (id) => STATUS.find((s) => s.id === id)?.nome || 'Para ler';

export function artigosAtivos(estado) {
  return (estado.artigos || []).filter((a) => !a.excluido_em);
}

export function artigoPeloId(estado, id) {
  return artigosAtivos(estado).find((a) => a.id === id) || null;
}

export function contarPalavras(texto) {
  return (String(texto || '').match(/\S+/g) || []).length;
}

export function minutosDeLeitura(texto) {
  const p = contarPalavras(texto);
  return p ? Math.max(1, Math.round(p / PALAVRAS_POR_MINUTO)) : 0;
}

// filtros: { busca, status, area, disciplina, tag, favoritos }
export function filtrarArtigos(estado, filtros = {}) {
  const busca = String(filtros.busca || '').trim().toLowerCase();
  return artigosAtivos(estado).filter((a) => {
    if (filtros.status && a.status !== filtros.status) return false;
    if (filtros.area && a.area_id !== filtros.area) return false;
    if (filtros.disciplina && a.disciplina_id !== filtros.disciplina) return false;
    if (filtros.tag && !(a.tags || []).includes(filtros.tag)) return false;
    if (filtros.favoritos && !a.favorito) return false;
    if (busca && !`${a.titulo} ${a.autor || ''} ${(a.tags || []).join(' ')}`.toLowerCase().includes(busca)) return false;
    return true;
  }).sort((a, b) => {
    // Lendo primeiro, depois para ler; dentro de cada um, o mais recente.
    const ordem = { lendo: 0, ler: 1, lido: 2, fichado: 3 };
    return (ordem[a.status] ?? 1) - (ordem[b.status] ?? 1) || String(b.atualizado_em).localeCompare(String(a.atualizado_em));
  });
}

export function tagsDosArtigos(estado) {
  return [...new Set(artigosAtivos(estado).flatMap((a) => a.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function contagemPorStatus(estado) {
  const c = Object.fromEntries(STATUS.map((s) => [s.id, 0]));
  for (const a of artigosAtivos(estado)) c[a.status] = (c[a.status] || 0) + 1;
  return c;
}

// "tag1, tag2 ; tag3" → ['tag1', 'tag2', 'tag3'] (sem repetidas, minúsculas, até 12).
export function lerTags(texto) {
  return [...new Set(String(texto || '').split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 40));
}

export function paragrafos(texto) {
  return String(texto || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=\s*[-•]\s)/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

// Marca os destaques no HTML (já escapado) de um parágrafo. Cada destaque marca a primeira vez
// que o trecho aparece no texto inteiro; os trechos são procurados já escapados.
export function marcarDestaques(htmlParagrafo, destaques, esc) {
  let html = htmlParagrafo;
  for (const d of destaques) {
    const alvo = esc(d.texto);
    if (!alvo || alvo.length < 2) continue;
    const i = html.indexOf(alvo);
    if (i < 0) continue;
    // Não marca por cima de uma marca já aberta (destaques que se sobrepõem).
    const antes = html.slice(0, i);
    if ((antes.match(/<mark/g) || []).length !== (antes.match(/<\/mark>/g) || []).length) continue;
    html = `${antes}<mark class="destaque destaque-${esc(d.cor || 'amarelo')}" data-acao="bib-marca" data-destaque="${esc(d.id)}">${alvo}</mark>${html.slice(i + alvo.length)}`;
  }
  return html;
}

// Texto que vai para a IA gerar questões: o artigo inteiro (até ~100 mil caracteres).
export function textoParaQuestoes(artigo) {
  const partes = [artigo.titulo, artigo.autor && `Autor: ${artigo.autor}`, artigo.resumo && `Resumo: ${artigo.resumo}`, artigo.texto].filter(Boolean);
  return partes.join('\n\n').slice(0, 100000);
}

export function fichamentoVazio(f) {
  return !PARTES_FICHAMENTO.some((p) => String(f?.[p.id] || '').trim());
}

// Fichamento em Markdown, para copiar.
export function fichamentoEmTexto(artigo) {
  const f = artigo.fichamento || {};
  const trechos = (f.trechos || []).map((t) => `“${t.citacao}”${t.onde ? ` (${t.onde})` : ''}${t.minha ? `\n— ${t.minha}` : ''}`);
  return [
    `# Fichamento: ${artigo.titulo}`,
    ...PARTES_FICHAMENTO.filter((p) => String(f[p.id] || '').trim()).map((p) => `## ${p.nome}\n${f[p.id].trim()}`),
    ...(trechos.length ? [`## Pelos destaques\n${trechos.join('\n\n')}`] : []),
  ].join('\n\n');
}

// Fichamento pelos destaques (29/10/2026): cada destaque vira um trecho com a citação, de onde
// veio e uma linha sua. Guarda o que já foi escrito e põe os destaques novos no fim.
export function trechosDosDestaques(artigo) {
  const antigos = new Map((artigo.fichamento?.trechos || []).map((t) => [t.destaque_id, t]));
  const destaques = Array.isArray(artigo.destaques) ? artigo.destaques : [];
  return destaques.map((d) => ({
    destaque_id: d.id, citacao: String(d.texto || '').trim().slice(0, 1200), onde: String(d.onde || '').slice(0, 80),
    nota: String(d.nota || '').slice(0, 600), minha: antigos.get(d.id)?.minha || '',
  }));
}

export const destaquesSemFichar = (artigo) => {
  const no = new Set((artigo.fichamento?.trechos || []).map((t) => t.destaque_id));
  return (artigo.destaques || []).filter((d) => !no.has(d.id)).length;
};

// Referência pronta a partir do que o arquivo trouxe: SOBRENOME, Nome. Título. ano.
export function referenciaPronta(artigo) {
  const autor = String(artigo.autor || '').trim();
  const partes = autor.split(/\s+/);
  const nome = partes.length > 1 ? `${partes[partes.length - 1].toUpperCase()}, ${partes.slice(0, -1).join(' ')}` : autor.toUpperCase();
  const ano = (String(artigo.dados?.ano || artigo.criado_em || '').match(/\d{4}/) || [''])[0];
  return [nome, artigo.titulo, artigo.url, ano].filter(Boolean).join('. ') + (ano ? '.' : '');
}

// Endereço mostrado no cartão: só o domínio.
export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
