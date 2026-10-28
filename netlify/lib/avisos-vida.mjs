// Avisos do dia a dia (Web Push): resumo da manhã, contas que vencem hoje e hábitos que
// ficaram para trás. Cada um tem horário próprio e liga/desliga; o horário de silêncio segura
// todos. Cada aviso sai uma vez por dia (as marcas ficam em config "avisos_vida_enviados").

import { tarefasDeHoje } from '../../js/dados-tarefas.js';
import { habitosDoDia, feitoNoDia, valorNoDia } from '../../js/dados-habitos.js';
import { situacaoDasContas, cartoes, fatura, mesDe, somarMeses } from '../../js/dados-financas.js';
import { noFuso } from './avisos.mjs';

// Igual a VIDA_PADRAO em js/avisos.js.
export const VIDA_PADRAO = {
  manha: { ativo: true, hora: '07:30' },
  contas: { ativo: true, hora: '09:00' },
  habitos: { ativo: true, hora: '20:00' },
  blocos: { ativo: true },
  silencio: { ativo: true, de: '22:00', ate: '07:00' },
};

const horaOk = (h, padrao) => (/^\d{2}:\d{2}$/.test(h || '') ? h : padrao);
const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

export function configVida(valor) {
  const v = valor || {};
  const item = (id) => ({
    ativo: v[id]?.ativo ?? VIDA_PADRAO[id].ativo,
    hora: horaOk(v[id]?.hora, VIDA_PADRAO[id].hora),
  });
  return {
    manha: item('manha'),
    contas: item('contas'),
    habitos: item('habitos'),
    blocos: { ativo: v.blocos?.ativo ?? VIDA_PADRAO.blocos.ativo },
    silencio: {
      ativo: v.silencio?.ativo ?? VIDA_PADRAO.silencio.ativo,
      de: horaOk(v.silencio?.de, VIDA_PADRAO.silencio.de),
      ate: horaOk(v.silencio?.ate, VIDA_PADRAO.silencio.ate),
    },
  };
}

// Dentro do horário de silêncio? (pode atravessar a meia-noite, como 22:00 → 07:00)
export function emSilencio(agoraMin, silencio) {
  if (!silencio?.ativo) return false;
  const de = minutos(silencio.de);
  const ate = minutos(silencio.ate);
  if (de === ate) return false;
  return de < ate ? agoraMin >= de && agoraMin < ate : agoraMin >= de || agoraMin < ate;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const dinheiro = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

// Contas fixas e faturas que vencem hoje e ainda não foram pagas.
export function contasDeHoje(financas, hoje) {
  const mes = mesDe(hoje);
  const contas = situacaoDasContas(financas, mes, hoje).filter((x) => x.estado !== 'paga' && x.vence === hoje)
    .map((x) => ({ nome: x.conta.descricao, valor: x.conta.valor }));
  for (const c of cartoes(financas)) {
    // A fatura que vence hoje pode ser a do mês anterior (fecha num mês e vence no outro).
    for (const m of [mes, somarMeses(mes, -1)]) {
      const f = fatura(financas, c, m);
      if (f.vencimento === hoje && !f.paga && f.total > 0) contas.push({ nome: `Fatura ${c.descricao}`, valor: f.total });
    }
  }
  return contas;
}

export function habitosPendentes(habitos, registros, hoje) {
  return habitosDoDia(habitos, registros, hoje).lista.filter((h) => !feitoNoDia(registros, h, hoje)).map((h) => {
    const meta = Math.max(1, Number(h.meta) || 1);
    return `${h.icone ? `${h.icone} ` : ''}${h.nome}${meta > 1 ? ` (${valorNoDia(registros, h, hoje)}/${meta})` : ''}`;
  });
}

// O que precisa sair agora. dados: { tarefas, financas, habitos, registros, eventos }; enviados: Set de chaves de hoje.
export function avisosDaVida({ dados, config, fuso = 'America/Sao_Paulo', agora = Date.now(), enviados = new Set() }) {
  const cfg = configVida(config);
  const { data: hoje, minutos: agoraMin } = noFuso(agora, fuso);
  if (emSilencio(agoraMin, cfg.silencio)) return [];
  // O resumo da manhã só vale até 4h depois do horário (um "bom dia" à noite não ajuda).
  const LIMITE = { manha: 4 * 60, contas: 24 * 60, habitos: 24 * 60 };
  const devido = (id) => cfg[id].ativo && agoraMin >= minutos(cfg[id].hora) && agoraMin < minutos(cfg[id].hora) + LIMITE[id]
    && !enviados.has(`${id}:${hoje}`);
  const saida = [];

  const contas = contasDeHoje(dados.financas || [], hoje);
  if (devido('contas') && contas.length) {
    const total = contas.reduce((t, c) => t + (Number(c.valor) || 0), 0);
    saida.push({
      chave: `contas:${hoje}`,
      titulo: contas.length === 1 ? `Vence hoje: ${contas[0].nome}` : `${contas.length} contas vencem hoje`,
      texto: contas.length === 1 ? `${dinheiro(contas[0].valor)}. Toque em "Paguei" quando pagar.` : `${contas.slice(0, 3).map((c) => c.nome).join(', ')}${contas.length > 3 ? ` e mais ${contas.length - 3}` : ''} · ${dinheiro(total)}`,
      tag: `contas-${hoje}`,
      url: '/#financas/contas',
    });
  }

  if (devido('habitos')) {
    const pendentes = habitosPendentes(dados.habitos || [], dados.registros || [], hoje);
    if (pendentes.length) {
      saida.push({
        chave: `habitos:${hoje}`,
        titulo: pendentes.length === 1 ? 'Falta 1 hábito hoje' : `Faltam ${pendentes.length} hábitos hoje`,
        texto: `${pendentes.slice(0, 3).join(' · ')}${pendentes.length > 3 ? ` e mais ${pendentes.length - 3}` : ''}. Ainda dá tempo, sem culpa.`,
        tag: `habitos-${hoje}`,
        url: '/#habitos',
      });
    }
  }

  if (devido('manha')) {
    const t = tarefasDeHoje(dados.tarefas || [], hoje);
    const eventosHoje = (dados.eventos || []).filter((e) => !e.excluido_em && e.inicio && e.status !== 'entregue' && noFuso(e.inicio, fuso).data === hoje);
    const provas = eventosHoje.filter((e) => e.tipo === 'prova').length;
    const prazos = eventosHoje.length - provas;
    const habitos = habitosDoDia(dados.habitos || [], dados.registros || [], hoje).total;
    const partes = [
      t.hoje.length && plural(t.hoje.length, 'tarefa', 'tarefas'),
      t.atrasadas.length && plural(t.atrasadas.length, 'atrasada', 'atrasadas'),
      provas && plural(provas, 'prova', 'provas'),
      prazos && plural(prazos, 'prazo', 'prazos'),
      contas.length && plural(contas.length, 'conta', 'contas'),
      habitos && plural(habitos, 'hábito', 'hábitos'),
    ].filter(Boolean);
    if (partes.length) {
      saida.push({
        chave: `manha:${hoje}`,
        titulo: 'Bom dia, Carol.',
        texto: `Hoje: ${partes.join(', ')}.${t.hoje[0] ? ` Primeiro: ${t.hoje[0].titulo}.` : ''}`,
        tag: `manha-${hoje}`,
        url: '/#inicio',
      });
    }
  }
  // Começo de cada bloco do "Planejar meu dia" aceito (o aviso sai na rodada de 15 min do começo).
  const plano = dados.meuDia?.plano;
  if (cfg.blocos.ativo && plano?.aceito && plano.data === hoje) {
    for (const b of plano.blocos || []) {
      const ini = minutos(b.inicio);
      if (b.tipo === 'compromisso' || agoraMin < ini || agoraMin >= ini + 15 || enviados.has(`bloco:${hoje}:${b.inicio}`)) continue;
      saida.push({ chave: `bloco:${hoje}:${b.inicio}`, titulo: `Agora: ${b.titulo}`, texto: `Até ${b.fim}.${b.motivo ? ` ${b.motivo}` : ''}`, tag: `bloco-${hoje}`, url: '/#inicio' });
    }
  }
  const ORDEM = ['manha', 'contas', 'habitos', 'bloco'];
  return saida.sort((a, b) => ORDEM.indexOf(a.chave.split(':')[0]) - ORDEM.indexOf(b.chave.split(':')[0]));
}
