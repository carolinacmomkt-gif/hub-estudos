// Ritual de leitura (decisão da Carol, 29/10/2026): meta de minutos por dia, sequência sem culpa
// (uma folga por semana), o livro do momento no Hoje e a tela de fim de livro.
// Os minutos lidos ficam em config "leitura" ({ metaMin, dias: { 'AAAA-MM-DD': minutos } }),
// gravados pelo leitor enquanto o livro está aberto e na tela.

import { somarDias } from './dados-tarefas.js';

export const META_LEITURA_PADRAO = 20;
export const OPCOES_META_LEITURA = [10, 15, 20, 30, 45, 60];

export function leituraDe(config) {
  const v = (config || []).find((c) => c.chave === 'leitura' && !c.excluido_em)?.valor || {};
  const meta = Number(v.metaMin);
  return { metaMin: OPCOES_META_LEITURA.includes(meta) ? meta : META_LEITURA_PADRAO, dias: v.dias && typeof v.dias === 'object' ? v.dias : {} };
}

export const minutosNoDia = (leitura, dia) => Math.round(Number(leitura.dias?.[dia]) || 0);

// Sequência sem culpa: dias seguidos batendo a meta, com uma folga por semana (igual às recompensas).
export function sequenciaLeitura(leitura, hoje) {
  const bateu = (d) => minutosNoDia(leitura, d) >= leitura.metaMin;
  let atual = bateu(hoje) ? hoje : somarDias(hoje, -1);
  if (!bateu(atual)) return { dias: 0, folgaUsada: false };
  let total = 0;
  let ultimaFolga = null;
  let folgaUsada = false;
  for (let i = 0; i < 400; i += 1) {
    if (bateu(atual)) {
      total += 1;
    } else {
      const podeFolgar = !ultimaFolga || (new Date(`${ultimaFolga}T12:00:00`) - new Date(`${atual}T12:00:00`)) / 864e5 >= 7;
      if (!podeFolgar || !bateu(somarDias(atual, -1))) break;
      ultimaFolga = atual;
      folgaUsada = true;
    }
    atual = somarDias(atual, -1);
  }
  return { dias: total, folgaUsada };
}

// Minutos num período (mês: 'AAAA-MM').
export const minutosNoMes = (leitura, mes) => Object.entries(leitura.dias || {}).filter(([d]) => d.startsWith(mes)).reduce((t, [, m]) => t + (Number(m) || 0), 0);

// O livro do momento: o que está "lendo" com a leitura mais recente; senão, o primeiro da fila.
export function livroDoMomento(artigos) {
  const vivos = (artigos || []).filter((a) => !a.excluido_em && a.fonte === 'livro');
  const lendo = vivos.filter((a) => a.status === 'lendo').sort((a, b) => String(b.dados?.ultima_leitura || '').localeCompare(String(a.dados?.ultima_leitura || '')));
  if (lendo[0]) return { livro: lendo[0], comecando: false };
  const fila = vivos.filter((a) => a.status === 'ler').sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
  return fila[0] ? { livro: fila[0], comecando: true } : null;
}

// "Cabe antes da reunião das 15h": o próximo compromisso de hoje depois de agora, em minutos.
export function encaixeDeHoje(eventos, agora = Date.now()) {
  const hoje = new Date(agora);
  const proximos = (eventos || []).filter((e) => !e.excluido_em && !e.dia_inteiro && e.inicio)
    .map((e) => ({ titulo: e.titulo, em: Date.parse(e.inicio) }))
    .filter((e) => e.em > agora && new Date(e.em).toDateString() === hoje.toDateString())
    .sort((a, b) => a.em - b.em);
  if (!proximos[0]) return null;
  const minutos = Math.floor((proximos[0].em - agora) / 60000);
  return { titulo: proximos[0].titulo, minutos, hora: new Date(proximos[0].em).toTimeString().slice(0, 5) };
}

// Corta o mapa de dias para não crescer sem fim (guarda ~1 ano).
export function podarDias(dias, hoje) {
  const limite = somarDias(hoje, -400);
  return Object.fromEntries(Object.entries(dias || {}).filter(([d]) => d >= limite));
}

export const textoMin = (valor) => { const min = Math.round(Number(valor) || 0); return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`; };
