// "Organizar minhas demandas": encaixa as demandas (e as tarefas que vieram delas) nos dias de
// trabalho da Carol, com horário, sem passar do limite de horas por dia e sem cobrir compromisso.
// Urgente e aprovação primeiro; o mesmo cliente fica junto (um assunto por vez). O que não cabe
// até o prazo ganha uma sugestão de novo prazo e uma mensagem pronta para o cliente.
// Sem tela: o organizador simples (sem IA, também a reserva sem internet) e a conferência do que
// a IA devolveu são os mesmos aqui e na função da Netlify.

export const PREFS_ORGANIZAR_PADRAO = { horasPorDia: 6, dias: [1, 2, 3, 4, 5], automatico: false };
export const HORIZONTE_DIAS = 14;
const PASSO = 15;
const MIN_BLOCO = 30;
const MAX_BLOCO = 180;
const FOLGA = 10; // minutos entre um assunto e outro

export const paraMin = (hora) => {
  const m = String(hora || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : null;
};
export const paraHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const arredonda = (min) => Math.ceil(min / PASSO) * PASSO;
const limpo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const dataOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const DIA_MS = 864e5;

export function somarDias(data, n) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);

export function prefsOrganizar(valor = {}) {
  const horas = Number(valor.horasPorDia);
  const dias = Array.isArray(valor.dias) ? [...new Set(valor.dias.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : null;
  return {
    horasPorDia: Number.isFinite(horas) && horas >= 1 ? Math.min(12, horas) : PREFS_ORGANIZAR_PADRAO.horasPorDia,
    dias: dias?.length ? dias : PREFS_ORGANIZAR_PADRAO.dias,
    automatico: valor.automatico === true,
  };
}

// O cliente de uma demanda, para juntar o mesmo assunto ("Dra. Karyne", "Sensus"...).
export const clienteDe = (item) => limpo(item.quem || item.onde || '', 60).toLowerCase();

// ---------------------------------------------------------------------------
// Entrada: dias de trabalho com o que já está ocupado, e o que precisa de lugar
// ---------------------------------------------------------------------------

// eventos: [{ data, inicio, fim, titulo }] (minutos do dia; só os que têm hora)
// tarefas: as tarefas abertas (as que vieram de demanda podem mudar de lugar; as outras ocupam)
export function entradaDaSemana({ demandas = [], tarefas = [], eventos = [], hoje, agoraMin = 0, horario, prefs }) {
  const p = prefsOrganizar(prefs);
  const ini = paraMin(horario?.inicio) ?? 8 * 60;
  const fim = paraMin(horario?.fim) ?? 18 * 60;
  const almoco = paraMin(horario?.almoco);
  const vivas = tarefas.filter((t) => !t.excluido_em && !t.feita_em);
  const moveis = vivas.filter((t) => t.dados?.demanda_id);
  const dias = [];
  for (let i = 0; i < HORIZONTE_DIAS; i += 1) {
    const data = somarDias(hoje, i);
    if (!p.dias.includes(diaDaSemana(data))) continue;
    const ocupado = eventos.filter((e) => e.data === data && Number.isFinite(e.inicio))
      .map((e) => ({ inicio: e.inicio, fim: Math.max(e.inicio + 15, e.fim ?? e.inicio + 60), titulo: limpo(e.titulo, 80) }));
    if (almoco !== null && almoco >= ini && almoco + 60 <= fim) ocupado.push({ inicio: almoco, fim: almoco + 60, titulo: 'Almoço' });
    let usado = 0;
    for (const t of vivas) {
      if (t.dados?.demanda_id || t.data !== data) continue;
      const min = Number(t.dados?.minutos) || 30;
      usado += min;
      if (t.hora && paraMin(t.hora) !== null) ocupado.push({ inicio: paraMin(t.hora), fim: paraMin(t.hora) + min, titulo: limpo(t.titulo, 80) });
    }
    // Hoje: só do agora em diante.
    const comeca = i === 0 ? Math.max(ini, arredonda(agoraMin)) : ini;
    if (comeca + MIN_BLOCO > fim) continue;
    dias.push({ data, inicio: comeca, fim, ocupado: ocupado.sort((a, b) => a.inicio - b.inicio), usado, capacidade: p.horasPorDia * 60 });
  }
  const itens = [
    ...demandas.filter((d) => !d.excluido_em && d.status === 'nova').map((d) => ({
      id: `d:${d.id}`, demanda_id: d.id, tarefa_id: null, titulo: limpo(d.titulo, 120), quem: limpo(d.quem, 60) || null,
      onde: limpo(d.onde, 60) || null, tipo: d.dados?.tipo || null, prazo: d.prazo || null, hora: d.hora || null,
      minutos: Math.max(15, Math.min(480, Number(d.minutos) || 30)), prioridade: Number(d.prioridade) || 0, atual: null,
    })),
    ...moveis.map((t) => ({
      id: `t:${t.id}`, demanda_id: t.dados.demanda_id, tarefa_id: t.id, titulo: limpo(t.titulo, 120), quem: null, onde: null, tipo: null,
      prazo: t.prazo || null, hora: null, minutos: Math.max(15, Math.min(480, Number(t.dados?.minutos) || 30)),
      prioridade: Number(t.prioridade) || 0, atual: t.data ? { data: t.data, hora: t.hora || null } : null,
    })),
  ];
  return { hoje, agoraMin, horario: { inicio: paraHora(ini), fim: paraHora(fim) }, prefs: p, dias, itens };
}

// Quanto mais cedo precisa sair, antes entra: atrasada, aprovação, prazo, prioridade.
function urgencia(item, hoje) {
  // Aprovação: o cliente está esperando, vai antes de tudo (é rápida).
  if (item.tipo === 'aprovacao') return -1000;
  const dias = item.prazo ? diasEntre(hoje, item.prazo) : (item.tipo ? 1 : 30);
  return Math.min(dias, 30) * 10 - item.prioridade * 15;
}

// ---------------------------------------------------------------------------
// Encaixe (usado pelo organizador simples e para o que a IA deixou de fora)
// ---------------------------------------------------------------------------

function estadoDosDias(entrada) {
  return entrada.dias.map((d) => ({ ...d, ocupado: d.ocupado.map((o) => ({ ...o })), usado: d.usado, blocos: [] }));
}

// Primeiro horário livre de pelo menos "min" no dia (a partir de "desde").
function horarioLivre(dia, min, desde = dia.inicio) {
  const ocupado = [...dia.ocupado, ...dia.blocos.map((b) => ({ inicio: b.ini - FOLGA, fim: b.fimMin + FOLGA }))]
    .sort((a, b) => a.inicio - b.inicio);
  let t = arredonda(Math.max(dia.inicio, desde));
  while (t + min <= dia.fim) {
    const bate = ocupado.find((o) => t < o.fim && t + min > o.inicio);
    if (!bate) return t;
    t = arredonda(bate.fim);
  }
  return null;
}

function maiorLivre(dia, desde = dia.inicio) {
  let melhor = null;
  for (let min = MAX_BLOCO; min >= MIN_BLOCO; min -= PASSO) {
    const t = horarioLivre(dia, min, desde);
    if (t !== null) { melhor = { t, min }; break; }
  }
  return melhor;
}

function colocar(dia, item, ini, min, motivo) {
  const bloco = {
    item_id: item.id, demanda_id: item.demanda_id, tarefa_id: item.tarefa_id, titulo: item.titulo, quem: item.quem,
    data: dia.data, inicio: paraHora(ini), fim: paraHora(ini + min), ini, fimMin: ini + min, minutos: min,
    motivo: limpo(motivo, 140), atual: item.atual,
  };
  dia.blocos.push(bloco);
  dia.usado += min;
  return bloco;
}

const cabeNoDia = (dia, min) => dia.usado + min <= dia.capacidade;

// Tenta pôr o item até o prazo: primeiro junto do mesmo cliente, depois no dia mais cedo com espaço.
function tentar(dias, item) {
  const min = Math.min(MAX_BLOCO, item.minutos);
  const ate = item.prazo || null;
  const candidatos = dias.filter((d) => !ate || d.data <= ate);
  const cliente = clienteDe(item);
  if (cliente) {
    for (const d of candidatos) {
      const vizinho = d.blocos.filter((b) => b.quem && b.quem.toLowerCase() === cliente).pop();
      if (!vizinho || !cabeNoDia(d, min)) continue;
      const t = horarioLivre(d, min, vizinho.fimMin);
      if (t !== null) return colocar(d, item, t, min, `Junto com as outras de ${item.quem}.`);
    }
  }
  for (const d of candidatos) {
    if (!cabeNoDia(d, min)) continue;
    const t = horarioLivre(d, min);
    if (t !== null) return colocar(d, item, t, min, [motivoSimples(item, d), min < item.minutos ? 'Começa aqui; o resto você encaixa depois.' : ''].filter(Boolean).join(' '));
    // Não há um horário inteiro livre: começa no maior pedaço livre (o resto vem depois).
    const pedaco = item.minutos > 60 ? maiorLivre(d) : null;
    if (pedaco && pedaco.min >= 45 && cabeNoDia(d, pedaco.min)) return colocar(d, item, pedaco.t, pedaco.min, 'Começa aqui; o resto você encaixa depois.');
  }
  return null;
}

function motivoSimples(item, dia) {
  if (item.tipo === 'aprovacao') return 'Aprovação primeiro: o cliente está esperando.';
  if (item.prazo && item.prazo < dia.data) return 'Já passou do prazo: o quanto antes.';
  if (item.prazo === dia.data) return 'Vence neste dia.';
  if (item.prioridade >= 2) return 'Urgente.';
  return '';
}

const diaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
export const textoDoDia = (data) => diaCurto.format(new Date(`${data}T12:00:00Z`)).replace('-feira', '');

export function mensagemDePrazo(item, novoPrazo) {
  const nome = String(item.quem || '').replace(/\b(dra?|doutora?)\.?\s+/i, '').split(/\s+/)[0];
  const quando = novoPrazo ? textoDoDia(novoPrazo) : 'os próximos dias';
  return `Oi${nome ? `, ${nome}` : ''}! Sobre "${item.titulo}": para entregar com calma e do jeito certo, consigo até ${quando}. Pode ser?`;
}

// Horário marcado na origem (reunião, entrega com hora): fica onde está. O resto, pelo encaixe.
function encaixar(dias, item) {
  if (item.hora && item.prazo) {
    const d = dias.find((x) => x.data === item.prazo);
    const t = paraMin(item.hora);
    if (d && t !== null && t >= d.inicio && t < d.fim) return colocar(d, item, t, Math.min(MAX_BLOCO, item.minutos, d.fim - t), 'Horário marcado na origem.');
  }
  return tentar(dias, item);
}

// Não coube até o prazo: o primeiro dia com espaço depois dele vira a sugestão.
function naoCabe(dias, item, mensagem) {
  const min = Math.min(MAX_BLOCO, item.minutos);
  const depois = dias.find((d) => (!item.prazo || d.data > item.prazo) && cabeNoDia(d, min) && horarioLivre(d, min) !== null);
  const sugestao = depois?.data || null;
  return {
    item_id: item.id, demanda_id: item.demanda_id, tarefa_id: item.tarefa_id, titulo: item.titulo, quem: item.quem,
    prazo: item.prazo, minutos: item.minutos, sugestao, mensagem: limpo(mensagem, 400) || mensagemDePrazo(item, sugestao),
  };
}

function resultadoFinal(dias, foraDoPlano, entrada) {
  const blocos = dias.flatMap((d) => d.blocos).sort((a, b) => a.data.localeCompare(b.data) || a.ini - b.ini)
    .map(({ ini, fimMin, ...b }) => b);
  const resumoDias = dias.filter((d) => d.blocos.length).map((d) => ({ data: d.data, usado: d.usado, capacidade: d.capacidade }));
  return { gerado_em: new Date().toISOString(), hoje: entrada.hoje, blocos, naoCabe: foraDoPlano, dias: resumoDias };
}

export function organizarSimples(entrada) {
  const dias = estadoDosDias(entrada);
  const fora = [];
  const fila = [...entrada.itens].sort((a, b) => urgencia(a, entrada.hoje) - urgencia(b, entrada.hoje));
  for (const item of fila) if (!encaixar(dias, item)) fora.push(naoCabe(dias, item));
  return resultadoFinal(dias, fora, entrada);
}

// ---------------------------------------------------------------------------
// Conferência do que a IA devolveu: o que for válido fica; o resto passa pelo encaixe simples
// ---------------------------------------------------------------------------

export function conferirOrganizacao(r, entrada) {
  const dias = estadoDosDias(entrada);
  const porId = new Map(entrada.itens.map((i) => [i.id, i]));
  const feitos = new Set();
  const mensagens = new Map();
  for (const c of Array.isArray(r?.colocacoes) ? r.colocacoes : []) {
    const item = porId.get(String(c?.item_id || ''));
    if (!item || feitos.has(item.id) || !dataOk(c.data)) continue;
    const d = dias.find((x) => x.data === c.data);
    const t = paraMin(c.inicio);
    const min = Math.min(MAX_BLOCO, item.minutos);
    if (!d || t === null || t < d.inicio || t + min > d.fim) continue;
    if (item.prazo && d.data > item.prazo) continue;
    if (!cabeNoDia(d, min) || horarioLivre(d, min, t) !== t) continue;
    colocar(d, item, t, min, c.motivo);
    feitos.add(item.id);
  }
  for (const n of Array.isArray(r?.nao_cabe) ? r.nao_cabe : []) {
    if (porId.has(String(n?.item_id || ''))) mensagens.set(String(n.item_id), String(n.mensagem || ''));
  }
  const fora = [];
  const resto = entrada.itens.filter((i) => !feitos.has(i.id)).sort((a, b) => urgencia(a, entrada.hoje) - urgencia(b, entrada.hoje));
  for (const item of resto) if (!encaixar(dias, item)) fora.push(naoCabe(dias, item, mensagens.get(item.id)));
  const final = resultadoFinal(dias, fora, entrada);
  return { ...final, resumo: limpo(r?.resumo, 300) };
}

// Pôr no plano um bloco que não cabia (no dia sugerido) ou mudar um bloco de lugar.
export function moverBloco(plano, entrada, itemId, { data, inicio } = {}) {
  const item = entrada.itens.find((i) => i.id === itemId);
  if (!item || !dataOk(data)) return null;
  const min = Math.min(MAX_BLOCO, item.minutos);
  const dias = estadoDosDias(entrada);
  for (const b of plano.blocos) {
    if (b.item_id === itemId) continue;
    const d = dias.find((x) => x.data === b.data);
    if (!d) continue;
    d.blocos.push({ ...b, ini: paraMin(b.inicio), fimMin: paraMin(b.fim) });
    d.usado += b.minutos;
  }
  const d = dias.find((x) => x.data === data);
  if (!d) return null;
  const pedido = paraMin(inicio);
  const t = pedido !== null && pedido >= d.inicio && pedido + min <= d.fim ? pedido : horarioLivre(d, min);
  if (t === null) return null;
  const bloco = colocar(d, item, t, min, 'Você escolheu este dia.');
  const { ini, fimMin, ...limpoBloco } = bloco;
  return {
    ...plano,
    blocos: [...plano.blocos.filter((b) => b.item_id !== itemId), limpoBloco].sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio)),
    naoCabe: plano.naoCabe.filter((n) => n.item_id !== itemId),
  };
}

export function tirarDoPlano(plano, itemId) {
  const b = plano.blocos.find((x) => x.item_id === itemId);
  if (!b) return plano;
  return { ...plano, blocos: plano.blocos.filter((x) => x.item_id !== itemId) };
}

// Precisa reorganizar? Só quando já existe uma semana organizada: chegou demanda urgente (até
// 2 dias) ou uma tarefa de demanda ficou para trás.
export function pedeReorganizar({ demandas = [], tarefas = [], hoje }) {
  if (!tarefas.some((t) => !t.excluido_em && !t.feita_em && t.dados?.organizada)) return null;
  const urgente = demandas.find((d) => !d.excluido_em && d.status === 'nova' && !d.dados?.tipo && d.prazo && diasEntre(hoje, d.prazo) <= 2);
  if (urgente) return { motivo: `Chegou "${limpo(urgente.titulo, 60)}", que vence ${diasEntre(hoje, urgente.prazo) <= 0 ? 'hoje' : diasEntre(hoje, urgente.prazo) === 1 ? 'amanhã' : 'em 2 dias'}.` };
  const atrasada = tarefas.find((t) => !t.excluido_em && !t.feita_em && t.dados?.demanda_id && t.data && t.data < hoje);
  if (atrasada) return { motivo: `"${limpo(atrasada.titulo, 60)}" ficou para trás.` };
  return null;
}
