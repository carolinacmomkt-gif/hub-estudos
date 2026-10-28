// Captura por voz (ou texto): o que a Carol falou vira um ou mais itens do app. A IA separa e
// decide o destino; sem internet, o jeito simples usa as leituras rápidas de tarefa e de gasto.
// Sem tela: roda no app e na função da Netlify.

import { lerTarefaRapida, AREAS_TAREFA } from './dados-tarefas.js';
import { lerLancamento, CATEGORIAS_PADRAO } from './dados-financas.js';

export const DESTINOS_CAPTURA = [
  { id: 'tarefa', nome: 'Tarefa' },
  { id: 'evento', nome: 'Compromisso' },
  { id: 'gasto', nome: 'Gasto' },
  { id: 'entrada', nome: 'Entrada de dinheiro' },
  { id: 'video', nome: 'Ideia de vídeo' },
  { id: 'pauta', nome: 'Pauta do Substack' },
  { id: 'demanda', nome: 'Demanda' },
  { id: 'ideia', nome: 'Ideia (caixa de entrada)' },
];
const IDS = DESTINOS_CAPTURA.map((d) => d.id);

const limpo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const dataOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
const horaOk = (h) => (/^\d{2}:\d{2}$/.test(h || '') ? h : null);

// Confere o que a IA devolveu: destino válido, título, data e valor no formato certo.
export function conferirItens(itens, { categorias = CATEGORIAS_PADRAO } = {}) {
  const cats = new Set(categorias.map((c) => c.id));
  return (itens || []).map((x) => {
    const destino = IDS.includes(x.destino) ? x.destino : 'ideia';
    const valor = Number(x.valor);
    return {
      destino,
      titulo: limpo(x.titulo, 200) || 'Sem título',
      data: dataOk(x.data),
      hora: horaOk(x.hora),
      valor: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null,
      categoria: cats.has(x.categoria) ? x.categoria : null,
      prioridade: [0, 1, 2].includes(Number(x.prioridade)) ? Number(x.prioridade) : 0,
      area: AREAS_TAREFA.some((a) => a.id === x.area) ? x.area : null,
      notas: limpo(x.notas, 500) || null,
    };
  }).filter((x) => x.titulo).slice(0, 10);
}

// Sem IA: um item só. Com dinheiro no texto vira gasto; senão, tarefa (com dia e hora lidos).
export function capturaSimples(texto, hoje, { categorias = CATEGORIAS_PADRAO } = {}) {
  const t = String(texto || '').trim();
  if (!t) return [];
  // Dinheiro só com sinal claro ("gastei 40", "R$ 12", "recebi 3500"): "reunião às 15" não é gasto.
  const semAcento = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\d/.test(t) && /r\$|\breais\b|\b(gastei|gasto|paguei|comprei|recebi|ganhei|entrou|caiu|pix)\b/.test(semAcento)) {
    const l = lerLancamento(t, hoje, { categorias });
    if (l?.valor) return conferirItens([{ destino: l.tipo === 'entrada' ? 'entrada' : 'gasto', titulo: l.descricao || t, data: l.data, valor: l.valor, categoria: l.categoria }], { categorias });
  }
  const r = lerTarefaRapida(t, hoje);
  return conferirItens([{ destino: 'tarefa', titulo: r.titulo || t, data: r.data, hora: r.hora, prioridade: r.prioridade, area: r.area }], { categorias });
}

// Para onde cada item vai: { tabela, dados } no formato de cada tela do app.
export function registroDoItem(x, hoje) {
  switch (x.destino) {
    case 'tarefa':
      return { tabela: 'tarefas', dados: { titulo: x.titulo, notas: x.notas, data: x.data || hoje, hora: x.hora, prioridade: x.prioridade, area: x.area || 'pessoal', dados: { origem: 'voz' } } };
    case 'evento': {
      const dia = x.data || hoje;
      const inicio = new Date(`${dia}T${x.hora || '09:00'}:00`);
      return { tabela: 'eventos', dados: { titulo: x.titulo, tipo: 'pessoal', inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(), dia_inteiro: !x.hora, origem: 'manual', descricao: x.notas } };
    }
    case 'gasto':
    case 'entrada':
      return { tabela: 'financas', dados: { tipo: x.destino === 'gasto' ? 'saida' : 'entrada', valor: x.valor || 0, data: x.data || hoje, descricao: x.titulo, categoria: x.destino === 'gasto' ? (x.categoria || 'outros') : null, dados: { origem: 'voz' } } };
    case 'video':
      return { tabela: 'videos', dados: { titulo: x.titulo, etapa: 'ideia', notas: x.notas } };
    case 'pauta':
      return { tabela: 'pautas_substack', dados: { titulo: x.titulo, etapa: 'ideia', notas: x.notas } };
    case 'demanda':
      return { tabela: 'demandas', dados: { origem: 'manual', origem_id: null, titulo: x.titulo, detalhe: x.notas, prazo: x.data, hora: x.hora, prioridade: x.prioridade, minutos: 30, status: 'nova', dados: { area: x.area || 'consultoria', ia: true, motivo: 'Anotada por voz.' } } };
    default:
      return { tabela: 'caixa_entrada', dados: { texto: [x.titulo, x.notas].filter(Boolean).join('\n') } };
  }
}

// "2 tarefas, 1 gasto e 1 ideia de vídeo"
export function resumoDaCaptura(itens) {
  const conta = new Map();
  for (const x of itens) conta.set(x.destino, (conta.get(x.destino) || 0) + 1);
  const PLURAL = { tarefa: ['tarefa', 'tarefas'], evento: ['compromisso', 'compromissos'], gasto: ['gasto', 'gastos'], entrada: ['entrada', 'entradas'], video: ['ideia de vídeo', 'ideias de vídeo'], pauta: ['pauta', 'pautas'], demanda: ['demanda', 'demandas'], ideia: ['ideia', 'ideias'] };
  const partes = [...conta].map(([d, n]) => `${n} ${PLURAL[d][n === 1 ? 0 : 1]}`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0] || '';
}
