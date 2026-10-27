// Finanças sem tela: dinheiro num lugar só, separado pela origem (de onde veio) e pela
// categoria (para onde foi). Leitura rápida ("mercado 120 ontem", "+3500 sensus"), resumo do
// mês, contas fixas e caixinhas. Sem DOM, para dar para testar sozinho.

// Linhas da tabela "financas":
//   tipo 'entrada' | 'saida'  → um lançamento (valor > 0, data, descricao, categoria ou origem)
//   tipo 'conta'              → conta fixa (valor, categoria, recorrencia { dia }); pagar cria uma saída
//   tipo 'caixinha'           → dinheiro guardado para um objetivo (valor = meta, dados.guardado)

export const ORIGENS_PADRAO = [
  { id: 'consultoria', nome: 'Consultoria', palavras: ['consultoria', 'sensus', 'mentoria'] },
  { id: 'freela', nome: 'Freelas', palavras: ['freela', 'freelance', 'freelas', 'job'] },
  { id: 'agencia', nome: 'Salário da agência', palavras: ['agencia', 'agência', 'essence'] },
  { id: 'confluir', nome: 'Salário da Confluir', palavras: ['confluir'] },
  { id: 'criacao', nome: 'Criação (YouTube e Substack)', palavras: ['youtube', 'substack', 'adsense', 'publi'] },
  { id: 'outros', nome: 'Outros', palavras: [] },
];

export const CATEGORIAS_PADRAO = [
  { id: 'casa', nome: 'Casa', palavras: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'internet', 'gas', 'casa', 'faxina'] },
  { id: 'mercado', nome: 'Mercado', palavras: ['mercado', 'supermercado', 'feira', 'hortifruti', 'padaria'] },
  { id: 'comer-fora', nome: 'Comer fora', palavras: ['drive', 'drive-thru', 'ifood', 'lanche', 'restaurante', 'cafe', 'cafeteria', 'almoco', 'jantar', 'pizza', 'mc', 'bk'] },
  { id: 'transporte', nome: 'Transporte', palavras: ['uber', '99', 'gasolina', 'combustivel', 'estacionamento', 'onibus', 'pedagio'] },
  { id: 'saude', nome: 'Saúde', palavras: ['farmacia', 'remedio', 'consulta', 'exame', 'academia', 'plano', 'terapia', 'dentista'] },
  { id: 'faculdade', nome: 'Faculdade', palavras: ['faculdade', 'mensalidade', 'unievangelica', 'curso', 'apostila'] },
  { id: 'lazer', nome: 'Lazer', palavras: ['cinema', 'shopping', 'passeio', 'viagem', 'goiania', 'brasilia', 'livro', 'livros', 'show', 'ingresso'] },
  { id: 'assinaturas', nome: 'Assinaturas', palavras: ['netflix', 'spotify', 'assinatura', 'prime', 'icloud', 'canva', 'chatgpt', 'claude', 'disney', 'max'] },
  { id: 'compras', nome: 'Compras', palavras: ['roupa', 'compra', 'presente', 'maquiagem', 'loja'] },
  { id: 'outros', nome: 'Outros', palavras: [] },
];

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const deIso = (s) => new Date(`${s}T12:00:00`);
function somarDias(s, n) {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export const mesDe = (data) => String(data).slice(0, 7); // AAAA-MM
export function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const ultimoDia = (mes) => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate(); };
export const diaNoMes = (mes, dia) => `${mes}-${String(Math.min(dia, ultimoDia(mes))).padStart(2, '0')}`;

// "1.234,56" | "1234.56" | "120" | "R$ 35,90" → número
export function lerValor(texto) {
  let t = String(texto).replace(/r\$\s*/i, '').trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const DIAS = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };

// Uma linha digitada → { tipo, valor, data, descricao, categoria, origem, cliente }
// Dinheiro olha para trás: "sexta" é a última sexta (gasto já feito).
export function lerLancamento(texto, hoje, { categorias = CATEGORIAS_PADRAO, origens = ORIGENS_PADRAO } = {}) {
  let resto = ` ${String(texto || '').trim()} `;
  const tirar = (re) => {
    const m = semAcento(resto).match(re);
    if (!m) return null;
    resto = `${resto.slice(0, m.index)} ${resto.slice(m.index + m[0].length)}`;
    return m;
  };
  const r = { tipo: 'saida', valor: NaN, data: hoje, descricao: '', categoria: null, origem: null, cliente: null };

  let m;
  // Data
  if (tirar(/\santeontem(?=\s)/)) r.data = somarDias(hoje, -2);
  else if (tirar(/\sontem(?=\s)/)) r.data = somarDias(hoje, -1);
  else if (tirar(/\shoje(?=\s)/)) r.data = hoje;
  else if ((m = tirar(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/))) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : deIso(hoje).getFullYear();
    let s = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (!m[3] && s > hoje) s = `${ano - 1}${s.slice(4)}`;
    if (!Number.isNaN(Date.parse(`${s}T12:00:00`))) r.data = s;
  } else if ((m = tirar(/\sdia (\d{1,2})(?=\s)/))) {
    let s = diaNoMes(mesDe(hoje), Number(m[1]));
    if (s > hoje) s = diaNoMes(somarMeses(mesDe(hoje), -1), Number(m[1]));
    r.data = s;
  } else if ((m = tirar(/\s(?:na |no |nesta |neste |ultima |ultimo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)(?:-feira)?(?=\s)/))) {
    const atras = (deIso(hoje).getDay() - DIAS[m[1]] + 7) % 7;
    r.data = somarDias(hoje, -atras);
  }

  let sinal = null;
  m = tirar(/\s([+-])\s?(?:r\$\s?)?(\d[\d.,]*)(?=\s)/);
  if (m) {
    sinal = m[1];
    r.tipo = sinal === '+' ? 'entrada' : 'saida';
    r.valor = lerValor(m[2]);
  } else if ((m = tirar(/\s(?:r\$\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?=\s)(?!\s*\/)/))) {
    r.valor = lerValor(m[1]);
  }

  // #marcador escolhe a categoria ou a origem
  m = tirar(/\s#([a-z0-9-]+)(?=\s)/);
  const marca = m?.[1];
  const palavras = semAcento(resto).split(/[^a-z0-9-]+/).filter(Boolean);
  const achaOrigem = (lista) => origens.find((o) => (marca && (semAcento(o.id) === marca || semAcento(o.nome).startsWith(marca)))
    || (lista && o.palavras?.some((p) => lista.includes(semAcento(p)))));
  const achaCategoria = (lista) => categorias.find((c) => (marca && (semAcento(c.id) === marca || semAcento(c.nome).startsWith(marca)))
    || (lista && c.palavras?.some((p) => lista.includes(semAcento(p)))));

  const origem = achaOrigem(palavras);
  const categoria = achaCategoria(palavras);
  // Sem sinal: citar uma fonte de dinheiro (e nenhuma categoria de gasto) vira entrada.
  if (!sinal && origem && origem.id !== 'outros' && !categoria) r.tipo = 'entrada';
  if (r.tipo === 'entrada') {
    r.origem = (origem || origens.find((o) => o.id === 'outros') || origens.at(-1))?.id || 'outros';
    if (palavras.includes('sensus')) r.cliente = 'Sensus';
  } else {
    r.categoria = (categoria || categorias.find((c) => c.id === 'outros') || categorias.at(-1))?.id || 'outros';
  }
  r.descricao = resto.replace(/\s+/g, ' ').trim();
  if (!r.descricao) r.descricao = r.tipo === 'entrada' ? (origens.find((o) => o.id === r.origem)?.nome || 'Entrada') : (categorias.find((c) => c.id === r.categoria)?.nome || 'Gasto');
  return r;
}

// --- Resumo -------------------------------------------------------------------------------
const vivos = (linhas) => (linhas || []).filter((l) => !l.excluido_em);
export const lancamentos = (linhas) => vivos(linhas).filter((l) => l.tipo === 'entrada' || l.tipo === 'saida');
export const contasFixas = (linhas) => vivos(linhas).filter((l) => l.tipo === 'conta');
export const caixinhas = (linhas) => vivos(linhas).filter((l) => l.tipo === 'caixinha');
const soma = (lista) => Math.round(lista.reduce((t, l) => t + (Number(l.valor) || 0), 0) * 100) / 100;

function agrupar(lista, campo, nomes) {
  const mapa = new Map();
  for (const l of lista) {
    const id = l[campo] || 'outros';
    mapa.set(id, (mapa.get(id) || 0) + (Number(l.valor) || 0));
  }
  return [...mapa].map(([id, total]) => ({ id, nome: nomes.find((x) => x.id === id)?.nome || 'Outros', total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

export function resumoDoMes(linhas, mes, { categorias = CATEGORIAS_PADRAO, origens = ORIGENS_PADRAO } = {}) {
  const doMes = lancamentos(linhas).filter((l) => mesDe(l.data) === mes);
  const entradas = doMes.filter((l) => l.tipo === 'entrada');
  const saidas = doMes.filter((l) => l.tipo === 'saida');
  const entrou = soma(entradas);
  const saiu = soma(saidas);
  return {
    mes, entrou, saiu, sobrou: Math.round((entrou - saiu) * 100) / 100,
    porOrigem: agrupar(entradas, 'origem', origens),
    porCategoria: agrupar(saidas, 'categoria', categorias),
    quantidade: doMes.length,
  };
}

// Variação em relação ao mês anterior: +0.12 = 12% a mais. null quando não dá para comparar.
export function variacao(atual, anterior) {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}

// Situação de cada conta fixa num mês: paga (com o lançamento), atrasada ou a vencer.
export function situacaoDasContas(linhas, mes, hoje) {
  const pagamentos = lancamentos(linhas).filter((l) => l.tipo === 'saida' && l.dados?.conta_id);
  return contasFixas(linhas).filter((c) => !c.dados?.pausada).map((c) => {
    const vence = diaNoMes(mes, Number(c.recorrencia?.dia) || 1);
    const pagamento = pagamentos.find((l) => l.dados.conta_id === c.id && l.dados.mes === mes);
    const estado = pagamento ? 'paga' : vence < hoje ? 'atrasada' : 'aberta';
    return { conta: c, vence, pagamento, estado, dias: Math.round((deIso(vence) - deIso(hoje)) / 864e5) };
  }).sort((a, b) => a.vence.localeCompare(b.vence));
}

// Contas que pedem atenção agora: atrasadas e as que vencem nos próximos 7 dias (este mês e o próximo).
export function contasDaSemana(linhas, hoje) {
  const mes = mesDe(hoje);
  const lista = [...situacaoDasContas(linhas, mes, hoje), ...situacaoDasContas(linhas, somarMeses(mes, 1), hoje)];
  return lista.filter((x) => x.estado !== 'paga' && x.dias <= 7 && (x.estado === 'atrasada' || x.dias >= 0));
}

export function progressoCaixinha(c) {
  const guardado = Number(c.dados?.guardado) || 0;
  const meta = Number(c.valor) || 0;
  return { guardado, meta, fracao: meta ? Math.min(1, guardado / meta) : 0 };
}

// Planilha simples (separador ";" e vírgula decimal, como o Excel em português abre direto)
export function paraCSV(linhas, { categorias = CATEGORIAS_PADRAO, origens = ORIGENS_PADRAO } = {}) {
  const nome = (lista, id) => lista.find((x) => x.id === id)?.nome || '';
  const campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corpo = lancamentos(linhas).sort((a, b) => a.data.localeCompare(b.data)).map((l) => [
    l.data, l.tipo === 'entrada' ? 'Entrada' : 'Saída', campo(l.descricao), campo(l.tipo === 'entrada' ? nome(origens, l.origem) : nome(categorias, l.categoria)),
    (l.tipo === 'entrada' ? '' : '-') + Number(l.valor).toFixed(2).replace('.', ','),
  ].join(';'));
  return ['Data;Tipo;Descrição;Origem ou categoria;Valor', ...corpo].join('\n');
}
