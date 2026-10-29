// Meu cantinho (decisão da Carol, 29/10/2026): o espaço de descanso dentro da Bússola. Sem
// trabalho, sem dinheiro, sem tarefa. Aqui ficam as contas: a calculadora do sono por ciclos, a
// contagem para chegar bem na hora de deitar, a pausa que cabe antes do próximo compromisso e as
// pausas com tempo. O estado fica em config "cantinho".

import { somarDias } from './dados-tarefas.js';

export const CICLO_MIN = 90;
export const ADORMECER_MIN = 15;
export const ACORDAR_PADRAO = '06:30';

export const CANTINHO_PADRAO = {
  acordar: ACORDAR_PADRAO, deitar: null, lembrete: true, lembreteParar: true, mesinhaAuto: true,
  som: 'chuva', ultimaPausa: null, pausas: [],
};

export const cantinhoDe = (config) => ({ ...CANTINHO_PADRAO, ...((config || []).find((c) => c.chave === 'cantinho' && !c.excluido_em)?.valor || {}) });

export const paraMin = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const paraHora = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const textoDuracao = (min) => { const m = Math.round(min); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`; };

// Para acordar às X: as horas de deitar, do mais descansado ao mais curto.
export function horasDeDeitar(acordar) {
  const fim = paraMin(acordar);
  if (fim === null) return [];
  return [6, 5, 4, 3].map((ciclos) => {
    const dormidas = ciclos * CICLO_MIN;
    const hora = paraHora(fim - dormidas - ADORMECER_MIN);
    const tag = ciclos >= 5 ? 'ideal' : ciclos === 4 ? 'dá' : 'curto';
    return { ciclos, hora, dormidas, tag };
  });
}

// Se deitar agora: as horas de acordar.
export function horasDeAcordar(agoraMin) {
  return [4, 5, 6].map((ciclos) => ({ ciclos, hora: paraHora(agoraMin + ADORMECER_MIN + ciclos * CICLO_MIN), dormidas: ciclos * CICLO_MIN }));
}

// Quantas horas faltam para a hora de acordar (considerando que ela é amanhã se já passou).
export function faltaParaAcordar(acordar, agoraMin) {
  const fim = paraMin(acordar);
  if (fim === null) return null;
  return fim > agoraMin ? fim - agoraMin : fim + 1440 - agoraMin;
}

// Para chegar bem na hora de deitar: café, jantar, trabalho, telas.
export function contagemParaDeitar(deitar) {
  const d = paraMin(deitar);
  if (d === null) return [];
  return [
    { id: 'cafe', emoji: '☕', nome: 'último café', hora: paraHora(d - 8 * 60) },
    { id: 'jantar', emoji: '🍽️', nome: 'jantar leve até', hora: paraHora(d - 3 * 60) },
    { id: 'trabalho', emoji: '💻', nome: 'fechar o trabalho', hora: paraHora(d - 60) },
    { id: 'telas', emoji: '📵', nome: 'telas longe', hora: paraHora(d - 30) },
  ];
}

// As pausas do cantinho.
export const PAUSAS = [
  { id: 'respirar', emoji: '🫁', nome: 'Respirar', minutos: 2, texto: '4-7-8, três voltas; a tela escurece e nada te interrompe.' },
  { id: 'alongar', emoji: '🧘‍♀️', nome: 'Alongar', minutos: 5, texto: 'Pescoço, ombros, punhos, costas e pernas: um minuto cada.' },
  { id: 'cochilo', emoji: '😴', nome: 'Cochilo', minutos: 20, texto: 'Som suave para acordar, sem vibrar. A tela fica escura.' },
  { id: 'sair', emoji: '🚶‍♀️', nome: 'Sair um pouco', minutos: 10, texto: 'Caminhar, olhar pela janela, beber água. Sem celular.' },
];

export const ALONGAR_PASSOS = [
  { nome: 'Pescoço', texto: 'Deixe a cabeça pender para um lado, depois para o outro. Devagar.' },
  { nome: 'Ombros', texto: 'Suba os ombros até as orelhas, segure, solte. Gire para trás.' },
  { nome: 'Punhos', texto: 'Estique o braço, puxe os dedos para baixo e para cima. Troque.' },
  { nome: 'Costas', texto: 'Entrelace as mãos, empurre para a frente, arredonde as costas. Depois abra o peito.' },
  { nome: 'Pernas', texto: 'Levante, fique na ponta dos pés, desça. Dobre para a frente sem forçar.' },
];

// Respiração 4-7-8: as fases e quanto duram (em segundos).
export const RESPIRAR_FASES = [
  { nome: 'inspira', segundos: 4 },
  { nome: 'segura', segundos: 7 },
  { nome: 'solta', segundos: 8 },
];
export const RESPIRAR_VOLTA = RESPIRAR_FASES.reduce((t, f) => t + f.segundos, 0);

export function faseDaRespiracao(segundosDecorridos) {
  let s = ((segundosDecorridos % RESPIRAR_VOLTA) + RESPIRAR_VOLTA) % RESPIRAR_VOLTA;
  for (const f of RESPIRAR_FASES) {
    if (s < f.segundos) return { ...f, restante: f.segundos - s, fracao: s / f.segundos };
    s -= f.segundos;
  }
  return { ...RESPIRAR_FASES[0], restante: 4, fracao: 0 };
}

// O próximo compromisso de hoje com hora (eventos e tarefas com hora), em minutos do dia.
export function proximoComHora({ eventos = [], tarefas = [] }, hoje, agoraMin) {
  const itens = [];
  for (const e of eventos) {
    if (e.excluido_em || e.dia_inteiro || !e.inicio) continue;
    const d = new Date(e.inicio);
    const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (data !== hoje) continue;
    itens.push({ titulo: e.titulo, min: d.getHours() * 60 + d.getMinutes(), tipo: 'evento' });
  }
  for (const t of tarefas) {
    if (t.excluido_em || t.feita_em || t.data !== hoje || !t.hora) continue;
    const m = paraMin(t.hora);
    if (m !== null) itens.push({ titulo: t.titulo, min: m, tipo: 'tarefa' });
  }
  return itens.filter((i) => i.min > agoraMin).sort((a, b) => a.min - b.min)[0] || null;
}

// Que pausa cabe agora? Depende do que falta até a próxima coisa com hora.
export function pausaQueCabe(proximo, agoraMin) {
  const livre = proximo ? proximo.min - agoraMin : null;
  if (livre !== null && livre < 7) return { pausa: null, livre };
  const cabe = PAUSAS.filter((p) => livre === null || p.minutos + 5 <= livre);
  const escolhida = livre === null || livre >= 40 ? cabe.find((p) => p.id === 'sair') || cabe[0] : cabe[cabe.length - 1];
  return { pausa: escolhida || null, livre };
}

// Há quanto tempo sem parar (desde a última pausa registrada hoje; senão, desde que o app abriu).
export function minutosSemParar(cantinho, hoje, agora = Date.now(), abriuEm = agora) {
  const ultima = cantinho.ultimaPausa ? Date.parse(cantinho.ultimaPausa) : null;
  const inicio = ultima && new Date(ultima).toDateString() === new Date(agora).toDateString() ? ultima : abriuEm;
  return Math.max(0, Math.round((agora - inicio) / 60000));
}

// Registro de pausa feita (guarda os últimos 60).
export function registrarPausa(cantinho, { tipo, minutos }, agora = Date.now()) {
  const quando = new Date(agora).toISOString();
  return { ...cantinho, ultimaPausa: quando, pausas: [...(cantinho.pausas || []), { quando, tipo, minutos }].slice(-60) };
}

export const pausasDoDia = (cantinho, hoje) => (cantinho.pausas || []).filter((p) => String(p.quando).slice(0, 10) === hoje);

// É noite? (para a mesinha e os tons quentes)
export const ehNoite = (agoraMin) => agoraMin >= 21 * 60 + 30 || agoraMin < 6 * 60;

export const amanha = (hoje) => somarDias(hoje, 1);
