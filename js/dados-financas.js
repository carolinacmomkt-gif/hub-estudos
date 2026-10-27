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
export function lerLancamento(texto, hoje, { categorias = CATEGORIAS_PADRAO, origens = ORIGENS_PADRAO, cartoes = [] } = {}) {
  let resto = ` ${String(texto || '').trim()} `;
  const tirar = (re) => {
    const m = semAcento(resto).match(re);
    if (!m) return null;
    resto = `${resto.slice(0, m.index)} ${resto.slice(m.index + m[0].length)}`;
    return m;
  };
  const r = { tipo: 'saida', valor: NaN, data: hoje, descricao: '', categoria: null, origem: null, cliente: null, parcelas: 1, conta: null };

  let m;
  // Parcelas: "em 10x", "10x", "em 10 vezes"
  if ((m = tirar(/\s(?:em\s)?(\d{1,2})\s?(?:x|vezes)(?=\s)/))) r.parcelas = Math.min(48, Math.max(1, Number(m[1])));
  // Forma de pagamento: "no cartão nubank", "nubank", "pix", "débito", "dinheiro"
  for (const c of cartoes) {
    const nome = semAcento(c.descricao).trim();
    if (nome && (m = tirar(new RegExp(`\\s(?:no |com o |pelo )?(?:cartao |credito )?${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s)`)))) {
      r.conta = `cartao:${c.id}`;
      break;
    }
  }
  if (!r.conta) {
    if (tirar(/\s(?:no |pelo |via )?pix(?=\s)/)) r.conta = 'pix';
    else if (tirar(/\s(?:no )?debito(?=\s)/)) r.conta = 'debito';
    else if (tirar(/\s(?:em |no )?dinheiro(?=\s)/)) r.conta = 'dinheiro';
    else if (tirar(/\s(?:no )?(?:cartao|credito)(?=\s)/)) r.conta = cartoes[0] ? `cartao:${cartoes[0].id}` : 'credito';
  }
  // Data
  if (tirar(/\santeontem(?=\s)/)) r.data = somarDias(hoje, -2);
  else if (tirar(/\sontem(?=\s)/)) r.data = somarDias(hoje, -1);
  else if (tirar(/\shoje(?=\s)/)) r.data = hoje;
  else if ((m = tirar(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/))) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : deIso(hoje).getFullYear();
    let s = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // Data mais de 6 meses à frente sem ano: é do ano passado; até lá, é planejamento.
    if (!m[3] && s > somarDias(hoje, 183)) s = `${ano - 1}${s.slice(4)}`;
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

// Quanto ainda dá para gastar no mês (ideia do "seguro para gastar" do Copilot e do PocketGuard):
// o que entrou, menos o que já saiu, menos as contas fixas que ainda vão vencer, menos o que foi
// guardado nas caixinhas neste mês. Dividido pelos dias que faltam, vira um valor por dia.
export function livreParaGastar(linhas, hoje) {
  const mes = mesDe(hoje);
  const r = resumoDoMes(linhas, mes);
  const contasAbertas = situacaoDasContas(linhas, mes, hoje).filter((x) => x.estado !== 'paga')
    .reduce((t, x) => t + (Number(x.conta.valor) || 0), 0);
  const guardadoNoMes = caixinhas(linhas).reduce((t, c) => t + (c.dados?.historico || [])
    .filter((h) => mesDe(h.data) === mes).reduce((s, h) => s + (Number(h.valor) || 0), 0), 0);
  const livre = Math.round((r.entrou - r.saiu - contasAbertas - guardadoNoMes) * 100) / 100;
  const diasRestantes = ultimoDia(mes) - Number(hoje.slice(8, 10)) + 1;
  return { livre, porDia: diasRestantes > 0 ? Math.floor((livre / diasRestantes) * 100) / 100 : livre, diasRestantes, contasAbertas, guardadoNoMes };
}

// --- Formas de pagamento, cartões e faturas -----------------------------------------------
export const FORMAS = [
  { id: '', nome: 'Não informar' },
  { id: 'pix', nome: 'Pix' },
  { id: 'debito', nome: 'Débito' },
  { id: 'dinheiro', nome: 'Dinheiro' },
];
export const cartoes = (linhas) => vivos(linhas).filter((l) => l.tipo === 'cartao');
const cartaoDoLancamento = (l) => (String(l.conta || '').startsWith('cartao:') ? l.conta.slice(7) : null);

// Mês de vencimento da fatura em que uma compra cai. Compra depois do fechamento vai para a próxima.
export function mesDaFatura(cartao, data) {
  const fecha = Number(cartao.dados?.fechamento) || 1;
  const vence = Number(cartao.dados?.vencimento) || 10;
  const dia = Number(String(data).slice(8, 10));
  let mesFechamento = mesDe(data);
  if (dia > fecha) mesFechamento = somarMeses(mesFechamento, 1);
  return vence > fecha ? mesFechamento : somarMeses(mesFechamento, 1);
}

export function fatura(linhas, cartao, mes) {
  const itens = lancamentos(linhas).filter((l) => l.tipo === 'saida' && cartaoDoLancamento(l) === cartao.id && mesDaFatura(cartao, l.data) === mes)
    .sort((a, b) => a.data.localeCompare(b.data));
  const total = Math.round(itens.reduce((t, l) => t + (Number(l.valor) || 0), 0) * 100) / 100;
  const paga = vivos(linhas).some((l) => l.tipo === 'pagamento' && l.dados?.cartao_id === cartao.id && l.dados?.mes === mes);
  const vencimento = diaNoMes(mes, Number(cartao.dados?.vencimento) || 10);
  return { mes, itens, total, paga, vencimento };
}

// Limite usado: tudo que ainda não foi pago (faturas abertas, inclusive parcelas futuras).
export function limiteDoCartao(linhas, cartao) {
  const pagas = new Set(vivos(linhas).filter((l) => l.tipo === 'pagamento' && l.dados?.cartao_id === cartao.id).map((l) => l.dados.mes));
  const usado = lancamentos(linhas).filter((l) => l.tipo === 'saida' && cartaoDoLancamento(l) === cartao.id && !pagas.has(mesDaFatura(cartao, l.data)))
    .reduce((t, l) => t + (Number(l.valor) || 0), 0);
  const limite = Number(cartao.valor) || 0;
  return { usado: Math.round(usado * 100) / 100, limite, livre: Math.round((limite - usado) * 100) / 100, fracao: limite ? Math.min(1, usado / limite) : 0 };
}

// Faturas a pagar (abertas) que vencem até "ate" — para o Hoje e as contas da semana.
export function faturasAVencer(linhas, hoje, dias = 7) {
  const ate = (() => { const d = new Date(`${hoje}T12:00:00`); d.setDate(d.getDate() + dias); return iso(d); })();
  const lista = [];
  for (const c of cartoes(linhas)) {
    for (const mes of [somarMeses(mesDe(hoje), -1), mesDe(hoje), somarMeses(mesDe(hoje), 1)]) {
      const f = fatura(linhas, c, mes);
      if (f.total > 0 && !f.paga && f.vencimento <= ate) lista.push({ cartao: c, ...f, atrasada: f.vencimento < hoje });
    }
  }
  return lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// --- Parcelas -----------------------------------------------------------------------------
// Divide uma compra em N lançamentos mensais (a última parcela leva os centavos que sobram).
export function parcelar(base, n, grupo) {
  const total = Math.round(Number(base.valor) * 100);
  const cada = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => {
    const mes = somarMeses(mesDe(base.data), i);
    return {
      ...base,
      valor: (i === n - 1 ? total - cada * (n - 1) : cada) / 100,
      data: diaNoMes(mes, Number(String(base.data).slice(8, 10))),
      descricao: `${base.descricao} (${i + 1}/${n})`,
      dados: { ...(base.dados || {}), parcela: { n: i + 1, de: n, grupo, total: total / 100 } },
    };
  });
}

// Compras parceladas que ainda têm parcelas por vir.
export function parcelasEmAberto(linhas, hoje) {
  const grupos = new Map();
  for (const l of lancamentos(linhas).filter((x) => x.dados?.parcela?.grupo)) {
    const g = grupos.get(l.dados.parcela.grupo) || { grupo: l.dados.parcela.grupo, itens: [] };
    g.itens.push(l);
    grupos.set(g.grupo, g);
  }
  return [...grupos.values()].map((g) => {
    const itens = g.itens.sort((a, b) => a.data.localeCompare(b.data));
    const futuras = itens.filter((l) => mesDe(l.data) > mesDe(hoje));
    const p = itens[0].dados.parcela;
    return {
      grupo: g.grupo, descricao: itens[0].descricao.replace(/\s\(\d+\/\d+\)$/, ''), total: p.total, de: p.de,
      pagas: itens.length - futuras.length, faltam: futuras.length, restante: Math.round(futuras.reduce((t, l) => t + Number(l.valor), 0) * 100) / 100,
      termina: itens.at(-1).data, porMes: Number(itens[0].valor), itens, conta: itens[0].conta,
    };
  }).filter((g) => g.faltam > 0).sort((a, b) => a.termina.localeCompare(b.termina));
}

// Quanto do mês já está comprometido com parcelas.
export function comprometidoNoMes(linhas, mes) {
  return Math.round(lancamentos(linhas).filter((l) => l.dados?.parcela && mesDe(l.data) === mes).reduce((t, l) => t + Number(l.valor), 0) * 100) / 100;
}

// --- Entradas fixas (salários, consultoria) ------------------------------------------------
export const entradasFixas = (linhas) => vivos(linhas).filter((l) => l.tipo === 'receita');

export function situacaoDasEntradas(linhas, mes, hoje) {
  const recebidas = lancamentos(linhas).filter((l) => l.tipo === 'entrada' && l.dados?.receita_id);
  return entradasFixas(linhas).filter((e) => !e.dados?.pausada).map((e) => {
    const dia = diaNoMes(mes, Number(e.recorrencia?.dia) || 1);
    const recebimento = recebidas.find((l) => l.dados.receita_id === e.id && l.dados.mes === mes);
    return { entrada: e, dia, recebimento, estado: recebimento ? 'recebida' : dia < hoje ? 'atrasada' : 'aberta' };
  }).sort((a, b) => a.dia.localeCompare(b.dia));
}

// --- Metas das caixinhas e reserva de emergência -------------------------------------------
// Quanto guardar por mês para bater a meta até o prazo.
export function planoDaCaixinha(c, hoje) {
  const { guardado, meta } = progressoCaixinha(c);
  const prazo = c.dados?.prazo;
  if (!meta || !prazo) return null;
  const falta = Math.max(0, meta - guardado);
  const [ah, mh] = mesDe(hoje).split('-').map(Number);
  const [ap, mp] = mesDe(prazo).split('-').map(Number);
  const meses = Math.max(1, (ap - ah) * 12 + (mp - mh) + 1);
  return { falta, meses, porMes: Math.ceil((falta / meses) * 100) / 100, atrasada: prazo < hoje && falta > 0 };
}

// Reserva: quantos meses dos gastos de costume (média dos últimos 3 meses fechados) estão guardados.
export function mesesDeReserva(linhas, hoje) {
  const reserva = caixinhas(linhas).filter((c) => c.dados?.reserva);
  if (!reserva.length) return null;
  const guardado = reserva.reduce((t, c) => t + progressoCaixinha(c).guardado, 0);
  const meses = [1, 2, 3].map((i) => somarMeses(mesDe(hoje), -i));
  const gastos = meses.map((m) => resumoDoMes(linhas, m).saiu).filter((v) => v > 0);
  const media = gastos.length ? gastos.reduce((a, b) => a + b, 0) / gastos.length : 0;
  return { guardado, media: Math.round(media * 100) / 100, meses: media ? Math.round((guardado / media) * 10) / 10 : null };
}

// --- Sugestões: gasto que se repete todo mês vira conta fixa --------------------------------
const chave = (t) => semAcento(t).replace(/\(\d+\/\d+\)/g, '').replace(/[^a-z]+/g, ' ').trim();

export function sugestoesDeContaFixa(linhas, hoje, ignoradas = []) {
  const fixas = new Set(contasFixas(linhas).map((c) => chave(c.descricao)));
  const meses = [somarMeses(mesDe(hoje), -2), somarMeses(mesDe(hoje), -1), mesDe(hoje)];
  const porChave = new Map();
  for (const l of lancamentos(linhas).filter((x) => x.tipo === 'saida' && !x.dados?.conta_id && !x.dados?.parcela && !x.dados?.recompensa && meses.includes(mesDe(x.data)))) {
    const k = chave(l.descricao);
    if (!k || k.length < 3 || fixas.has(k) || ignoradas.includes(k)) continue;
    const g = porChave.get(k) || { chave: k, meses: new Set(), itens: [] };
    g.meses.add(mesDe(l.data));
    g.itens.push(l);
    porChave.set(k, g);
  }
  return [...porChave.values()].filter((g) => g.meses.size >= 2 && g.meses.has(meses[1])).map((g) => {
    const ultimo = g.itens.sort((a, b) => b.data.localeCompare(a.data))[0];
    return { chave: g.chave, descricao: ultimo.descricao, valor: Number(ultimo.valor), dia: Number(ultimo.data.slice(8, 10)), categoria: ultimo.categoria };
  });
}

export function buscarLancamentos(linhas, texto) {
  const t = semAcento(texto).trim();
  if (!t) return [];
  return lancamentos(linhas).filter((l) => semAcento(`${l.descricao} ${l.dados?.cliente || ''}`).includes(t))
    .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 100);
}
