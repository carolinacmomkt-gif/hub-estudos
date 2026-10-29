// Retrospectiva do mês (decisão da Carol, 29/10/2026): um ritual guiado de 10 minutos no fim do
// mês: os números (foco, leitura, hábitos, tarefas, dinheiro, dias leves, humor), três perguntas e
// três intenções que viram metas. Fica em config "retrospectivas" ({ lista: [{ mes, numeros,
// respostas, intencoes, feita_em }] }).

import { resumoDoMes, mesDe, somarMeses, ultimoDia } from './dados-financas.js';
import { taxa } from './dados-habitos.js';
import { leituraDe, minutosNoMes } from './dados-leitura.js';
import { diaLeveDe } from './dados-dialeve.js';

export const PERGUNTAS = [
  { id: 'funcionou', rotulo: 'O que funcionou?', dica: 'O que você quer repetir no mês que vem.' },
  { id: 'pesou', rotulo: 'O que pesou?', dica: 'Sem culpa: só o que custou mais do que devia.' },
  { id: 'largar', rotulo: 'O que eu largo?', dica: 'Uma coisa que sai da sua lista, do seu dia ou da sua cabeça.' },
];

export const retrospectivasDe = (config) => (config || []).find((c) => c.chave === 'retrospectivas' && !c.excluido_em)?.valor?.lista || [];
export const retrospectivaDoMes = (config, mes) => retrospectivasDe(config).find((r) => r.mes === mes) || null;

const vivos = (l) => (l || []).filter((x) => !x.excluido_em);
const noMes = (iso, mes) => String(iso || '').slice(0, 7) === mes;

export const nomeDoMes = (mes) => {
  const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Está na hora? Nos 3 últimos dias do mês ou nos 4 primeiros do seguinte, se a do mês anterior ainda não foi feita.
export function retrospectivaDevida(config, hoje) {
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  if (dia >= ultimoDia(mes) - 2 && !retrospectivaDoMes(config, mes)) return { mes, quando: 'fim' };
  const anterior = somarMeses(mes, -1);
  if (dia <= 4 && !retrospectivaDoMes(config, anterior)) return { mes: anterior, quando: 'inicio' };
  return null;
}

// Os números do mês, de tudo que o app já sabe.
export function numerosDoMes(estado, mes, hoje) {
  const sessoes = vivos(estado.sessoesFoco).filter((s) => noMes(s.inicio, mes));
  const minutosFoco = sessoes.reduce((t, s) => t + (Number(s.minutos) || 0), 0);
  const leitura = leituraDe(estado.config);
  const livros = vivos(estado.artigos).filter((a) => (a.status === 'lido' || a.status === 'fichado') && noMes(a.lido_em, mes)).map((a) => a.titulo);
  const fimDoMes = `${mes}-${String(ultimoDia(mes)).padStart(2, '0')}`;
  const ateQuando = fimDoMes < hoje ? fimDoMes : hoje;
  const habitos = vivos(estado.habitos).filter((h) => h.ativo !== false);
  const taxas = habitos.map((h) => taxa(estado.habitoRegistros || [], h, ateQuando, Math.min(30, Number(ateQuando.slice(8, 10))))).filter((t) => t !== null);
  const taxaHabitos = taxas.length ? taxas.reduce((a, b) => a + b, 0) / taxas.length : null;
  const tarefasFeitas = vivos(estado.tarefas).filter((t) => noMes(t.feita_em, mes)).length;
  const fin = resumoDoMes(estado.financas || [], mes);
  const diasLeves = (diaLeveDe(estado.config).historico || []).filter((d) => d.startsWith(mes)).length;
  const humores = vivos(estado.diario).filter((d) => noMes(d.data, mes) && Number(d.humor) > 0).map((d) => Number(d.humor));
  const humor = humores.length ? humores.reduce((a, b) => a + b, 0) / humores.length : null;
  const publicados = vivos(estado.pautas).filter((p) => p.etapa === 'publicado' && noMes(p.publicado_em, mes)).length
    + vivos(estado.videos).filter((v) => v.etapa === 'publicado' && noMes(v.data_publicacao, mes)).length;
  const melhorDia = sessoes.reduce((m, s) => { const d = String(s.inicio).slice(0, 10); m[d] = (m[d] || 0) + (Number(s.minutos) || 0); return m; }, {});
  const topo = Object.entries(melhorDia).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    minutosFoco, sessoes: sessoes.length, melhorDia: topo ? { dia: topo[0], minutos: topo[1] } : null,
    minutosLeitura: minutosNoMes(leitura, mes), livros,
    taxaHabitos, tarefasFeitas,
    entrou: fin.entrou, saiu: fin.saiu, sobrou: fin.sobrou,
    diasLeves, humor, publicados,
  };
}

export function novaRetrospectiva({ mes, numeros, respostas, intencoes }) {
  return {
    mes, numeros,
    respostas: Object.fromEntries(PERGUNTAS.map((p) => [p.id, String(respostas?.[p.id] || '').trim().slice(0, 600)])),
    intencoes: (intencoes || []).map((t) => String(t || '').trim().slice(0, 80)).filter(Boolean).slice(0, 3),
    feita_em: new Date().toISOString(),
  };
}

// A intenção vira meta: até o fim do mês seguinte.
export function metaDaIntencao(texto, mes) {
  const prox = somarMeses(mes, 1);
  return { titulo: texto, status: 'ativa', prazo: `${prox}-${String(ultimoDia(prox)).padStart(2, '0')}`, area: '', dados: { origem: 'retrospectiva', mes, tamanho: 'p' } };
}
