// Widgets do iPhone (Scriptable) sem tela: as áreas, as paletas no estilo "vidro" e os widgets
// que a Carol monta em Configurações (config "widgets"). Usado pelo app (prévia) e pela função.
// Cada paleta tem as versões clara e escura; o modo "automático" segue o iPhone.

export const AREAS_WIDGET = [
  { id: 'hoje', nome: 'Hoje', simbolo: 'sun.max.fill', descricao: 'Tarefas, próximo compromisso, demandas e hábitos' },
  { id: 'tarefas', nome: 'Tarefas', simbolo: 'checkmark.circle.fill', descricao: 'As de hoje e as atrasadas' },
  { id: 'agenda', nome: 'Agenda', simbolo: 'calendar', descricao: 'O que vem nos próximos dias' },
  { id: 'demandas', nome: 'Demandas', simbolo: 'tray.full.fill', descricao: 'Trello, Notion e posts para aprovação' },
  { id: 'habitos', nome: 'Hábitos', simbolo: 'leaf.fill', descricao: 'Os de hoje, feitos e por fazer' },
  { id: 'financas', nome: 'Finanças', simbolo: 'creditcard.fill', descricao: 'Gasto do mês, quanto dá para gastar e contas' },
  { id: 'faculdade', nome: 'Faculdade', simbolo: 'graduationcap.fill', descricao: 'Próxima prova, quanto preciso tirar e faltas' },
  { id: 'metas', nome: 'Metas', simbolo: 'target', descricao: 'Progresso das metas ativas' },
  { id: 'foco', nome: 'Foco', simbolo: 'timer', descricao: 'Minutos de foco hoje e na semana' },
  { id: 'frase', nome: 'Frase do dia', simbolo: 'quote.opening', descricao: 'A frase do dia' },
  { id: 'youtube', nome: 'YouTube', simbolo: 'play.rectangle.fill', descricao: 'Próximo vídeo e o quadro por etapa' },
  { id: 'substack', nome: 'Substack', simbolo: 'square.and.pencil', descricao: 'Textos do mês e o próximo' },
  { id: 'leituras', nome: 'Leituras', simbolo: 'book.fill', descricao: 'O que está lendo e o que vem' },
];

// fundo: dois tons do degradê; vidro: o cartão translúcido (cor + opacidade); borda: a linha clara.
// Contraste do texto sobre o fundo e sobre o vidro: AA ou mais nas duas versões.
export const PALETAS_WIDGET = [
  { id: 'bussola', nome: 'Bússola',
    claro: { fundo: ['#F6F2EE', '#E7DED5'], texto: '#2B1E16', suave: '#6B5A4E', destaque: '#8C6A4A', vidro: ['#FFFFFF', 0.62], borda: ['#FFFFFF', 0.9], alerta: '#A3301F' },
    escuro: { fundo: ['#2A2420', '#141211'], texto: '#F1E6DA', suave: '#B3A596', destaque: '#E3C9AE', vidro: ['#FFFFFF', 0.08], borda: ['#FFFFFF', 0.16], alerta: '#F7A593' } },
  { id: 'areia', nome: 'Areia',
    claro: { fundo: ['#F7EBDD', '#E8CFB4'], texto: '#3A2616', suave: '#6E5440', destaque: '#9A6B3E', vidro: ['#FFFFFF', 0.55], borda: ['#FFFFFF', 0.85], alerta: '#A3301F' },
    escuro: { fundo: ['#3B2B1E', '#1C140E'], texto: '#F7EBDD', suave: '#C9B39C', destaque: '#E8C9A2', vidro: ['#FFF4E8', 0.1], borda: ['#FFF4E8', 0.18], alerta: '#F7A593' } },
  { id: 'grafite', nome: 'Grafite',
    claro: { fundo: ['#F2F2F4', '#D9DADF'], texto: '#1C1C1E', suave: '#55565C', destaque: '#3A3A3C', vidro: ['#FFFFFF', 0.6], borda: ['#FFFFFF', 0.9], alerta: '#B3261E' },
    escuro: { fundo: ['#2C2C2E', '#0E0E10'], texto: '#F5F5F7', suave: '#A1A1A6', destaque: '#E5E5EA', vidro: ['#FFFFFF', 0.08], borda: ['#FFFFFF', 0.16], alerta: '#FF8A80' } },
  { id: 'salvia', nome: 'Sálvia',
    claro: { fundo: ['#EEF3EC', '#CFDDCB'], texto: '#1F3326', suave: '#4C6353', destaque: '#3F6B4D', vidro: ['#FFFFFF', 0.55], borda: ['#FFFFFF', 0.85], alerta: '#A3301F' },
    escuro: { fundo: ['#263A2D', '#101A14'], texto: '#E6F0E7', suave: '#A9BFAE', destaque: '#A8CBB0', vidro: ['#E6FFE9', 0.08], borda: ['#E6FFE9', 0.16], alerta: '#F7A593' } },
  { id: 'azul-noite', nome: 'Azul-noite',
    claro: { fundo: ['#EDF1F9', '#C9D4EC'], texto: '#16213A', suave: '#4A5877', destaque: '#3A5596', vidro: ['#FFFFFF', 0.55], borda: ['#FFFFFF', 0.85], alerta: '#A3301F' },
    escuro: { fundo: ['#1D2A4A', '#0A0F1E'], texto: '#E6ECFA', suave: '#A5B3D4', destaque: '#9DB6F0', vidro: ['#DDE6FF', 0.09], borda: ['#DDE6FF', 0.18], alerta: '#FF9C8F' } },
  { id: 'rosa', nome: 'Rosa queimado',
    claro: { fundo: ['#F8EAE8', '#E9C7C4'], texto: '#45201F', suave: '#6A4341', destaque: '#9C4F52', vidro: ['#FFFFFF', 0.55], borda: ['#FFFFFF', 0.85], alerta: '#9E2A1D' },
    escuro: { fundo: ['#40262A', '#1A0F11'], texto: '#F8E7E6', suave: '#CFAFAE', destaque: '#EBAAAC', vidro: ['#FFE8E8', 0.09], borda: ['#FFE8E8', 0.17], alerta: '#FFB0A3' } },
];

export const MODOS_WIDGET = [
  { id: 'auto', nome: 'Segue o iPhone' },
  { id: 'claro', nome: 'Sempre claro' },
  { id: 'escuro', nome: 'Sempre escuro' },
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

// "Finanças rosa" → "financas-rosa" (é o que ela escreve no Parâmetro do widget)
export const parametroDoNome = (nome) => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// Luminância relativa (WCAG) e contraste entre duas cores #RRGGBB.
function luz(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a, b) {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Cores próprias: o texto é escolhido para ter contraste com o fundo, se o dela não tiver.
function paletaPropria({ fundo, texto, destaque }) {
  const f = HEX.test(fundo || '') ? fundo : '#2A2420';
  const escuroDeFundo = luz(f) < 0.25;
  const t = HEX.test(texto || '') && contraste(texto, f) >= 4.5 ? texto : (escuroDeFundo ? '#F7F2EC' : '#1E1A17');
  const d = HEX.test(destaque || '') ? destaque : t;
  const versao = {
    fundo: [f, f], texto: t, suave: t, destaque: contraste(d, f) >= 3 ? d : t,
    vidro: escuroDeFundo ? ['#FFFFFF', 0.09] : ['#FFFFFF', 0.5], borda: ['#FFFFFF', escuroDeFundo ? 0.18 : 0.85],
    alerta: escuroDeFundo ? '#FFB0A3' : '#9E2A1D', suaveAlpha: 0.75,
  };
  return { claro: versao, escuro: versao };
}

// O que o script usa: { claro, escuro } já resolvidos pelo modo (sempre claro = as duas iguais).
export function coresDoWidget(w = {}) {
  const base = w.paleta === 'propria' ? paletaPropria(w.cores || {}) : (PALETAS_WIDGET.find((p) => p.id === w.paleta) || PALETAS_WIDGET[0]);
  if (w.modo === 'claro') return { claro: base.claro, escuro: base.claro };
  if (w.modo === 'escuro') return { claro: base.escuro, escuro: base.escuro };
  return { claro: base.claro, escuro: base.escuro };
}

export function widgetsDaConfig(config) {
  const v = (config || []).find((c) => c.chave === 'widgets' && !c.excluido_em)?.valor || {};
  return (Array.isArray(v.itens) ? v.itens : []).filter((w) => w && w.parametro);
}

// Parâmetro vazio: o "Hoje" na paleta Bússola. Parâmetro que é o nome de uma área: essa área.
export function widgetDoParametro(widgets, parametro) {
  const p = parametroDoNome(parametro);
  const achado = (widgets || []).find((w) => w.parametro === p);
  if (achado) return achado;
  const area = AREAS_WIDGET.find((a) => a.id === p) ? p : 'hoje';
  return { nome: AREAS_WIDGET.find((a) => a.id === area).nome, parametro: p || 'hoje', area, paleta: 'bussola', modo: 'auto' };
}
