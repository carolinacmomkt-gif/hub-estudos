// "Posso comprar?": a Carol digita "tênis 400" (ou "tênis 400 em 3x") e o app responde na hora,
// sem IA e sem internet: cabe, aperta ou não cabe, quanto sobra livre no mês, quanto as parcelas
// pesam nos próximos meses, em quantos dias atrasa cada caixinha com prazo e se dá para resgatar
// com os pontos. "Esperar 48h" guarda o desejo em config "desejos" e o app pergunta de novo depois.

import { lerValor, livreParaGastar, caixinhas, planoDaCaixinha, parcelasEmAberto, mesDe, somarMeses, ultimoDia, progressoCaixinha } from './dados-financas.js';

export const ESPERA_HORAS = 48;
const DIA_MS = 864e5;

// "tênis 400 em 3x" → { descricao, valor, parcelas }
export function lerDesejo(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/(?:em\s+)?(\d{1,2})\s*x\b/i);
  const parcelas = m ? Math.max(1, Math.min(24, Number(m[1]))) : 1;
  const semParcelas = m ? t.replace(m[0], ' ') : t;
  const valorM = semParcelas.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto|pila)?\s*$/i)
    || semParcelas.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  const valor = valorM ? lerValor(valorM[1]) : 0;
  const descricao = (valorM ? semParcelas.replace(valorM[0], ' ') : semParcelas).replace(/\b(r\$|reais|real|por|de|em|comprar|posso)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1), valor, parcelas };
}

// O veredito. "livre" vem de livreParaGastar; a compra à vista sai toda do mês; parcelada, só a
// primeira parcela sai agora e o resto pesa nos próximos meses.
export function avaliarCompra(linhas, hoje, { valor, parcelas = 1 }, { pontos = 0, valorDoPonto = 0 } = {}) {
  if (!(valor > 0)) return null;
  const livre = livreParaGastar(linhas, hoje);
  const porMes = Math.round((valor / parcelas) * 100) / 100;
  const agora = parcelas > 1 ? porMes : valor;
  const sobra = Math.round((livre.livre - agora) * 100) / 100;
  const dias = livre.diasRestantes;
  const sobraPorDia = dias > 0 ? Math.floor((sobra / dias) * 100) / 100 : sobra;
  // Cabe: sobra pelo menos um dia "normal" de gasto para cada dia que falta. Aperta: sobra, mas pouco.
  let veredito = 'nao-cabe';
  if (sobra >= 0 && sobraPorDia >= livre.porDia * 0.5) veredito = 'cabe';
  else if (sobra >= 0) veredito = 'aperta';

  // Parcelas nos próximos meses, somadas às que já existem.
  const abertas = parcelasEmAberto(linhas, hoje);
  const meses = [];
  for (let i = 1; i < parcelas; i += 1) {
    const mes = somarMeses(mesDe(hoje), i);
    const jaTem = abertas.reduce((t, g) => t + g.itens.filter((l) => mesDe(l.data) === mes).reduce((s, l) => s + Number(l.valor), 0), 0);
    meses.push({ mes, nova: porMes, jaTem: Math.round(jaTem * 100) / 100, total: Math.round((jaTem + porMes) * 100) / 100 });
  }

  // Caixinhas com prazo: a compra tira dinheiro que iria para elas; em dias, quanto atrasa cada uma.
  const atrasos = caixinhas(linhas).map((c) => {
    const plano = planoDaCaixinha(c, hoje);
    if (!plano || !(plano.porMes > 0)) return null;
    const porDiaDaCaixinha = plano.porMes / ultimoDia(mesDe(hoje));
    const diasDeAtraso = Math.round(agora / porDiaDaCaixinha);
    return { id: c.id, descricao: c.descricao, dias: diasDeAtraso, ...progressoCaixinha(c) };
  }).filter((x) => x && x.dias >= 1).sort((a, b) => b.dias - a.dias).slice(0, 3);

  // Dá para resgatar com os pontos das recompensas?
  const valePontos = valorDoPonto > 0 ? Math.round(pontos * valorDoPonto * 100) / 100 : 0;
  const comPontos = valePontos >= valor ? { pontos: Math.ceil(valor / valorDoPonto) } : null;

  return { veredito, valor, parcelas, porMes, agora, livre: livre.livre, sobra, sobraPorDia, livrePorDia: livre.porDia, dias, meses, atrasos, comPontos };
}

export const TEXTO_VEREDITO = {
  cabe: { titulo: 'Cabe', texto: 'Dá para comprar sem apertar o mês.' },
  aperta: { titulo: 'Aperta', texto: 'Cabe, mas o resto do mês fica contado.' },
  'nao-cabe': { titulo: 'Não cabe', texto: 'Este mês não fecha com essa compra.' },
};

// --- Desejos (esperar 48h) -----------------------------------------------------------------
// { id, descricao, valor, parcelas, criado_em, lembrar_em, decidido: null | 'comprei' | 'deixei' }

export function novoDesejo({ descricao, valor, parcelas = 1 }, agora = Date.now()) {
  return {
    id: crypto.randomUUID().slice(0, 8), descricao: String(descricao || 'Compra').slice(0, 80), valor, parcelas,
    criado_em: new Date(agora).toISOString(), lembrar_em: new Date(agora + ESPERA_HORAS * 3600 * 1000).toISOString(), decidido: null,
  };
}

export const desejosAbertos = (lista) => (lista || []).filter((d) => !d.decidido);
export const desejosProntos = (lista, agora = Date.now()) => desejosAbertos(lista).filter((d) => Date.parse(d.lembrar_em) <= agora);

export function textoEspera(d, agora = Date.now()) {
  const h = Math.ceil((Date.parse(d.lembrar_em) - agora) / 3600000);
  if (h <= 0) return 'Já deu o tempo: ainda quer?';
  if (h < 24) return `pergunto de novo em ${h}h`;
  const dias = Math.round(h / 24);
  return `pergunto de novo em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

// Quanto "deixou de gastar" ao desistir (para o card celebrar de leve).
export const economizado = (lista) => (lista || []).filter((d) => d.decidido === 'deixei').reduce((t, d) => t + (Number(d.valor) || 0), 0);

export const dinheiro = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const diasAteNome = (dias) => (dias === 1 ? '1 dia' : `${dias} dias`);
export const mesNome = (mes) => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`)).replace('.', '');
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);
