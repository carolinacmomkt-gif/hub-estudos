// Caixa de demandas sem tela: o que conta como "já feito" no Trello e no Notion, a sugestão sem IA
// (prazo, tempo e prioridade), o que mudou na origem e a tarefa que nasce de uma demanda aceita.
// Roda no app e nas funções da Netlify (netlify/lib/demandas.mjs).

export const ORIGENS_DEMANDA = {
  trello: 'Trello',
  notion: 'Notion',
  compartilhado: 'Mensagem',
  manual: 'Anotada',
};

// Listas do Trello e status do Notion que querem dizer "pronto": essas demandas não entram.
const FEITO = /\b(conclu[ií]d[oa]s?|feit[oa]s?|done|pront[oa]s?|entregue|publicad[oa]s?|arquivad[oa]s?|finalizad[oa]s?|complete[d]?|cancelad[oa]s?)\b/i;
export const pareceFeito = (nome) => FEITO.test(String(nome || ''));

export const AREAS_DEMANDA = ['pessoal', 'casa', 'consultoria', 'criacao', 'saude', 'financas']; // as de AREAS_TAREFA
const limpo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const DIA_MS = 864e5;
const dataOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
const horaOk = (h) => (/^\d{2}:\d{2}$/.test(h || '') ? h : null);
const diasAte = (prazo, hoje) => Math.round((Date.parse(`${prazo}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / DIA_MS);

// O que vem da origem e importa para a Carol: se mudar, a demanda avisa.
export function assinaturaDe(item) {
  return [limpo(item.titulo, 200), item.prazo || '', item.hora || '', limpo(item.onde, 120)].join('|');
}

// Prazo e hora de uma data ISO da origem (Trello "due", data do Notion), no fuso dela.
export function prazoDaOrigem(valor, fuso = 'America/Sao_Paulo') {
  if (!valor) return { prazo: null, hora: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { prazo: valor, hora: null };
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return { prazo: null, hora: null };
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const hora = `${partes.hour}:${partes.minute}`;
  // Meia-noite (ou 23:59) é "o dia todo" no Trello e no Notion.
  return { prazo: `${partes.year}-${partes.month}-${partes.day}`, hora: hora === '00:00' || hora === '23:59' ? null : hora };
}

// Sugestão sem IA (sem internet, sem chave ou se a IA falhar): urgência pelo prazo.
export function sugestaoSimples(item, hoje) {
  const dias = item.prazo ? diasAte(item.prazo, hoje) : null;
  let prioridade = 0;
  if (dias !== null && dias <= 1) prioridade = 2;
  else if (dias !== null && dias <= 3) prioridade = 1;
  if (/\b(urgente|hoje|asap|agora)\b/i.test(`${item.titulo} ${item.detalhe || ''}`)) prioridade = 2;
  const tamanho = String(item.detalhe || '').length;
  return {
    titulo: limpo(item.titulo, 120) || 'Demanda',
    prazo: item.prazo || null,
    hora: item.hora || null,
    minutos: tamanho > 600 ? 90 : tamanho > 200 ? 60 : 30,
    prioridade,
    quem: limpo(item.quem, 80) || null,
    area: item.origem === 'compartilhado' ? 'pessoal' : 'consultoria',
    motivo: dias === null ? '' : dias < 0 ? 'Prazo já passou.' : dias === 0 ? 'Vence hoje.' : dias === 1 ? 'Vence amanhã.' : '',
  };
}

// Mensagem compartilhada (WhatsApp e outros): primeira linha vira título, o resto é detalhe.
export function demandaDoTexto(texto, titulo = '') {
  const linhas = String(texto || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const primeira = limpo(titulo, 120) || limpo(linhas[0], 120);
  return { titulo: primeira || 'Mensagem', detalhe: String(texto || '').trim().slice(0, 2000) };
}

// Junta o que a IA devolveu com o item original (a IA nunca inventa a origem nem o link).
export function aplicarSugestao(item, s, hoje) {
  const base = sugestaoSimples(item, hoje);
  if (!s) return base;
  const minutos = Math.round(Number(s.minutos));
  const prioridade = Number(s.prioridade);
  return {
    titulo: limpo(s.titulo, 120) || base.titulo,
    // O prazo da origem vale mais que o que a IA leu do texto.
    prazo: item.prazo || dataOk(s.prazo) || null,
    hora: item.hora || horaOk(s.hora) || null,
    minutos: Number.isFinite(minutos) && minutos >= 5 ? Math.min(480, minutos) : base.minutos,
    prioridade: [0, 1, 2].includes(prioridade) ? prioridade : base.prioridade,
    quem: limpo(s.quem, 80) || base.quem,
    area: AREAS_DEMANDA.includes(s.area) ? s.area : base.area,
    motivo: limpo(s.motivo, 140),
  };
}

// As que esperam o OK da Carol: primeiro as urgentes, depois pelo prazo.
export function demandasAbertas(demandas) {
  return (demandas || []).filter((d) => !d.excluido_em && d.status === 'nova')
    .sort((a, b) => (Number(b.prioridade) || 0) - (Number(a.prioridade) || 0)
      || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))
      || String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
}

// Aceitas cuja origem mudou depois (prazo ou nome): a Carol decide se a tarefa acompanha.
export const demandasMudadas = (demandas) => (demandas || []).filter((d) => !d.excluido_em && d.status === 'aceita' && d.mudou);

// O que mudou entre o que estava guardado e o que veio agora da origem.
export function mudancaDe(antiga, nova) {
  const mudou = {};
  if ((antiga.prazo || null) !== (nova.prazo || null)) mudou.prazo = { de: antiga.prazo || null, para: nova.prazo || null };
  if (limpo(antiga.dados?.titulo_origem || antiga.titulo, 200) !== limpo(nova.titulo, 200)) mudou.titulo = { de: antiga.dados?.titulo_origem || antiga.titulo, para: nova.titulo };
  return Object.keys(mudou).length ? mudou : null;
}

// Tarefa que nasce da demanda aceita. O dia de fazer é o prazo (ou hoje, se já passou).
export function tarefaDaDemanda(d, hoje) {
  const prazo = d.prazo || null;
  const notas = [d.detalhe, d.quem ? `Pedido de: ${d.quem}` : '', d.origem_url ? `Abrir: ${d.origem_url}` : ''].filter(Boolean).join('\n\n');
  return {
    titulo: limpo(d.titulo, 200) || 'Demanda',
    notas: notas.slice(0, 4000) || null,
    area: d.dados?.area || 'consultoria',
    data: prazo ? (prazo < hoje ? hoje : prazo) : null,
    prazo,
    hora: d.hora || null,
    prioridade: Number(d.prioridade) || 0,
    dados: { demanda_id: d.id, origem: d.origem, url: d.origem_url || null, minutos: d.minutos || null },
  };
}
