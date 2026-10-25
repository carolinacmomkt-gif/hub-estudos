// Avisos de prazo no aparelho (Web Push): o que avisar agora e o envio em si.
// Marcos: 3 dias antes, 1 dia antes e no dia, sempre no horário escolhido pela Carol
// (no fuso dela). Cada prazo sai uma vez em cada marco; se a função atrasar, o aviso
// ainda sai mais tarde no mesmo dia.

import webpush from 'web-push';

// Igual a AVISOS_PADRAO em js/avisos.js.
export const AVISOS_PADRAO = {
  hora: '08:00',
  fuso: 'America/Sao_Paulo',
  marcos: { '3d': true, '1d': true, dia: true },
  tipos: { prova: true, trabalho: true, atividade: true, revisao: true, youtube: true, substack: true, aula: false, feriado: false, pessoal: false },
};

const DIAS_DO_MARCO = { 3: '3d', 1: '1d', 0: 'dia' };
const ANTECEDENCIA_NO_DIA = 120; // no dia, o aviso sai pelo menos 2h antes de um compromisso cedo
const CEDO = 6 * 60; // mas nunca antes das 6h

export function configDeAvisos(valor) {
  const v = valor || {};
  return {
    hora: /^\d{2}:\d{2}$/.test(v.hora || '') ? v.hora : AVISOS_PADRAO.hora,
    fuso: v.fuso || AVISOS_PADRAO.fuso,
    marcos: { ...AVISOS_PADRAO.marcos, ...(v.marcos || {}) },
    tipos: { ...AVISOS_PADRAO.tipos, ...(v.tipos || {}) },
  };
}

// Data ("AAAA-MM-DD") e minutos desde a meia-noite de um instante, no fuso dado.
export function noFuso(instante, fuso) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instante)).map((p) => [p.type, p.value]));
  return { data: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const chaveEnviado = (eventoId, marco, inicio) => `${eventoId}|${marco}|${new Date(inicio).toISOString()}`;

// O que precisa sair agora. enviados: Set de chaveEnviado já mandadas.
export function avisosDevidos({ eventos, config, agora = Date.now(), enviados = new Set() }) {
  const cfg = configDeAvisos(config);
  const hoje = noFuso(agora, cfg.fuso);
  const alvo = minutos(cfg.hora);
  const devidos = [];
  for (const e of eventos) {
    if (e.excluido_em || !e.inicio || e.status === 'entregue' || !cfg.tipos[e.tipo]) continue;
    const quando = noFuso(e.inicio, cfg.fuso);
    const marco = DIAS_DO_MARCO[diasEntre(hoje.data, quando.data)];
    if (!marco || !cfg.marcos[marco]) continue;
    let hora = alvo;
    if (marco === 'dia' && !e.dia_inteiro) {
      if (Date.parse(e.inicio) <= agora) continue; // já passou
      hora = Math.max(CEDO, Math.min(alvo, quando.minutos - ANTECEDENCIA_NO_DIA));
    }
    if (hoje.minutos < hora) continue;
    if (enviados.has(chaveEnviado(e.id, marco, e.inicio))) continue;
    devidos.push({ evento: e, marco, chave: chaveEnviado(e.id, marco, e.inicio) });
  }
  return devidos;
}

const ROTULO_MARCO = { '3d': 'Em 3 dias', '1d': 'Amanhã', dia: 'Hoje' };

function linhaDoEvento(evento, nomeDisciplina, fuso, marco) {
  const disciplina = nomeDisciplina(evento.disciplina_id);
  const hora = evento.dia_inteiro ? '' : ` às ${new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).format(new Date(evento.inicio))}`;
  return `${evento.titulo}${disciplina ? ` (${disciplina})` : ''}${marco === 'dia' || marco === '1d' ? hora : ''}`;
}

// Uma notificação por marco, com até 3 prazos no texto.
export function montarNotificacoes(devidos, { nomeDisciplina = () => '', fuso = AVISOS_PADRAO.fuso } = {}) {
  const porMarco = new Map();
  for (const d of devidos) {
    if (!porMarco.has(d.marco)) porMarco.set(d.marco, []);
    porMarco.get(d.marco).push(d.evento);
  }
  return [...porMarco.entries()].map(([marco, eventos]) => {
    eventos.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    const linhas = eventos.slice(0, 3).map((e) => linhaDoEvento(e, nomeDisciplina, fuso, marco));
    if (eventos.length > 3) linhas.push(`e mais ${eventos.length - 3}`);
    const prova = eventos.some((e) => e.tipo === 'prova');
    const titulo = `${ROTULO_MARCO[marco]}: ${eventos.length === 1 ? (prova ? 'prova' : 'prazo') : `${eventos.length} prazos`}`;
    return {
      marco,
      titulo,
      texto: linhas.join('\n'),
      tag: `prazos-${marco}-${noFuso(eventos[0].inicio, fuso).data}`,
      url: `/#calendario/${noFuso(eventos[0].inicio, fuso).data}`,
    };
  });
}

export class ErroPush extends Error {}

function configurarVapid() {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) throw new ErroPush('Faltam VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY na Netlify.');
  webpush.setVapidDetails(process.env.URL || 'https://hub-estudos.netlify.app', publica, privada);
}

// Manda para um aparelho. Devolve 'ok', 'expirada' (o aparelho desativou; apagar) ou 'erro'.
export async function enviarPush(assinatura, notificacao, { enviar = (s, p, o) => webpush.sendNotification(s, p, o) } = {}) {
  configurarVapid();
  try {
    await enviar(
      { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
      JSON.stringify(notificacao),
      { TTL: 12 * 60 * 60, urgency: 'high' },
    );
    return 'ok';
  } catch (erro) {
    if (erro?.statusCode === 404 || erro?.statusCode === 410) return 'expirada';
    console.error('push:', erro?.statusCode || '', String(erro?.body || erro?.message || '').slice(0, 160));
    return 'erro';
  }
}

export { chaveEnviado };
