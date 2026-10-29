// "Padrões que você não vê" (decisão da Carol, 29/10/2026): correlações simples das últimas 8
// semanas, calculadas no aparelho, sem IA: humor × leitura, foco × energia, foco por dia da
// semana, gasto no fim de semana, dia leve e o dia seguinte… Só vira achado com dados de sobra
// (pelo menos 4 dias de cada lado) e diferença que dá para sentir. "Não faz sentido" dispensa
// o achado (config "padroes" { dispensados: [id] }).

import { somarDias } from './dados-tarefas.js';
import { leituraDe, minutosNoDia } from './dados-leitura.js';
import { habitosDoDia, feitoNoDia } from './dados-habitos.js';
import { lancamentos } from './dados-financas.js';
import { diaLeveDe } from './dados-dialeve.js';

export const DIAS_PADROES = 56;
const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const vivos = (l) => (l || []).filter((x) => !x.excluido_em);

export const padroesDe = (config) => (config || []).find((c) => c.chave === 'padroes' && !c.excluido_em)?.valor || { dispensados: [] };

// Uma linha por dia: { dia, semana (0-6), humor, energia, foco, leitura, gasto, habitos (0-1 ou null), leve }
export function seriesDiarias(estado, hoje, dias = DIAS_PADROES) {
  const leitura = leituraDe(estado.config);
  const diario = new Map(vivos(estado.diario).map((d) => [d.data, d]));
  const foco = new Map();
  for (const s of vivos(estado.sessoesFoco)) {
    const d = String(s.inicio || '').slice(0, 10);
    foco.set(d, (foco.get(d) || 0) + (Number(s.minutos) || 0));
  }
  const gasto = new Map();
  for (const l of lancamentos(estado.financas || [])) if (l.tipo === 'saida') gasto.set(l.data, (gasto.get(l.data) || 0) + (Number(l.valor) || 0));
  const leves = new Set(diaLeveDe(estado.config).historico || []);
  const habitos = vivos(estado.habitos);
  const registros = estado.habitoRegistros || [];
  const linhas = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = somarDias(hoje, -i);
    const d = diario.get(dia);
    let hab = null;
    if (habitos.length) {
      const doDia = habitosDoDia(habitos, registros, dia).lista;
      if (doDia.length) hab = doDia.filter((h) => feitoNoDia(registros, h, dia)).length / doDia.length;
    }
    linhas.push({
      dia, semana: new Date(`${dia}T12:00:00`).getDay(),
      humor: Number(d?.humor) > 0 ? Number(d.humor) : null,
      energia: Number(d?.energia) > 0 ? Number(d.energia) : null,
      foco: foco.get(dia) || 0,
      leitura: minutosNoDia(leitura, dia),
      gasto: Math.round((gasto.get(dia) || 0) * 100) / 100,
      habitos: hab,
      leve: leves.has(dia),
    });
  }
  return linhas;
}

const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const MIN = 4;

function comparar(linhas, { id, campo, divide, nomeSim, nomeNao, minimoDiff, texto }) {
  const com = linhas.filter((l) => l[campo] !== null && divide(l)).map((l) => l[campo]);
  const sem = linhas.filter((l) => l[campo] !== null && !divide(l)).map((l) => l[campo]);
  if (com.length < MIN || sem.length < MIN) return null;
  const a = media(com);
  const b = media(sem);
  const diff = a - b;
  if (Math.abs(diff) < minimoDiff) return null;
  return { id, forca: Math.abs(diff) / minimoDiff, texto: texto(a, b, diff, com.length, sem.length, nomeSim, nomeNao) };
}

const humorTxt = (v) => v.toFixed(1).replace('.', ',');

export function acharPadroes(linhas) {
  const achados = [];
  const h = (x) => x !== null && x !== undefined;
  const push = (a) => { if (a) achados.push(a); };

  // Humor nos dias em que leu
  push(comparar(linhas, {
    id: 'humor-leitura', campo: 'humor', divide: (l) => l.leitura >= 10, minimoDiff: 0.5,
    texto: (a, b, d) => (d > 0
      ? `Nos dias em que você lê pelo menos 10 minutos, o humor fica em ${humorTxt(a)}; nos outros, ${humorTxt(b)} (de 5).`
      : `Curioso: nos dias em que você lê, o humor fica em ${humorTxt(a)}; nos outros, ${humorTxt(b)}. Pode ser que leia mais nos dias difíceis.`),
  }));
  // Humor nos dias com foco
  push(comparar(linhas, {
    id: 'humor-foco', campo: 'humor', divide: (l) => l.foco >= 30, minimoDiff: 0.5,
    texto: (a, b, d) => (d > 0
      ? `Dia com pelo menos 30 min de foco termina com humor ${humorTxt(a)}; sem foco, ${humorTxt(b)}.`
      : `Nos dias com mais foco o humor fica mais baixo (${humorTxt(a)} contra ${humorTxt(b)}). Vale olhar se o foco está vindo com pressão.`),
  }));
  // Foco nos dias com energia alta
  push(comparar(linhas, {
    id: 'foco-energia', campo: 'foco', divide: (l) => h(l.energia) && l.energia >= 4, minimoDiff: 25,
    texto: (a, b, d) => (d > 0
      ? `Com energia boa ou cheia você foca ${Math.round(a)} min por dia; com menos energia, ${Math.round(b)}. Deixar o pesado para esses dias ajuda.`
      : `Você foca mais nos dias de energia baixa (${Math.round(a)} contra ${Math.round(b)} min). Pode estar se cobrando justamente quando falta gás.`),
  }));
  // Hábitos × humor
  push(comparar(linhas, {
    id: 'humor-habitos', campo: 'humor', divide: (l) => h(l.habitos) && l.habitos >= 0.7, minimoDiff: 0.5,
    texto: (a, b, d) => (d > 0
      ? `Quando você fecha pelo menos 70% dos hábitos, o humor do dia fica em ${humorTxt(a)}; nos outros, ${humorTxt(b)}.`
      : `Nos dias de hábitos completos o humor fica mais baixo (${humorTxt(a)} contra ${humorTxt(b)}). Talvez tenha hábito demais na lista.`),
  }));
  // Dia seguinte a um dia leve
  const depoisDeLeve = linhas.filter((l, i) => i > 0 && linhas[i - 1].leve && !l.leve);
  if (depoisDeLeve.length >= 3) {
    const normal = linhas.filter((l, i) => !l.leve && !(i > 0 && linhas[i - 1].leve) && l.foco > 0);
    if (normal.length >= MIN) {
      const a = media(depoisDeLeve.map((l) => l.foco));
      const b = media(normal.map((l) => l.foco));
      if (a - b >= 20) achados.push({ id: 'leve-depois', forca: (a - b) / 20, texto: `No dia seguinte a um dia leve você foca ${Math.round(a)} min, contra ${Math.round(b)} num dia comum. Descansar está funcionando.` });
    }
  }
  // Melhor dia da semana para o foco
  const comFoco = linhas.filter((l) => l.foco > 0);
  if (comFoco.length >= 10) {
    const porDia = Array.from({ length: 7 }, (_, d) => comFoco.filter((l) => l.semana === d).map((l) => l.foco));
    const geral = media(comFoco.map((l) => l.foco));
    const melhor = porDia.map((lista, d) => ({ d, n: lista.length, m: media(lista) })).filter((x) => x.n >= 3 && x.m !== null).sort((x, y) => y.m - x.m)[0];
    if (melhor && melhor.m >= geral * 1.4) achados.push({ id: 'foco-dia', forca: melhor.m / geral, texto: `${NOMES_DIA[melhor.d].charAt(0).toUpperCase() + NOMES_DIA[melhor.d].slice(1)} é o seu dia de foco: ${Math.round(melhor.m)} min em média, contra ${Math.round(geral)} nos outros. Vale proteger.` });
  }
  // Gasto no fim de semana
  const fds = linhas.filter((l) => l.semana === 0 || l.semana === 6);
  const uteis = linhas.filter((l) => l.semana >= 1 && l.semana <= 5);
  if (fds.length >= MIN && uteis.length >= MIN && uteis.some((l) => l.gasto > 0)) {
    const a = media(fds.map((l) => l.gasto));
    const b = media(uteis.map((l) => l.gasto));
    if (b > 0 && a >= b * 1.6 && a - b >= 20) achados.push({ id: 'gasto-fds', forca: a / b, texto: `No fim de semana você gasta ${Math.round(a / b * 10) / 10}× mais por dia (R$ ${Math.round(a)} contra R$ ${Math.round(b)}). Um envelope só para sábado e domingo pode ajudar.` });
  }
  // Humor nos dias em que gastou acima da média
  push(comparar(linhas, {
    id: 'humor-gasto', campo: 'gasto', divide: (l) => h(l.humor) && l.humor <= 2, minimoDiff: 25,
    texto: (a, b, d) => (d > 0
      ? `Nos dias difíceis você gasta mais: R$ ${Math.round(a)} contra R$ ${Math.round(b)} nos outros. O "Esperar 48h" é para esses dias.`
      : `Nos dias difíceis você gasta menos (R$ ${Math.round(a)} contra R$ ${Math.round(b)}).`),
  }));
  return achados.sort((x, y) => y.forca - x.forca);
}

export function padroesVisiveis(estado, hoje, { limite = 3 } = {}) {
  const dispensados = new Set(padroesDe(estado.config).dispensados || []);
  const linhas = seriesDiarias(estado, hoje);
  const diasComAlgo = linhas.filter((l) => l.humor !== null || l.foco > 0 || l.leitura > 0 || l.gasto > 0).length;
  return { diasComAlgo, achados: acharPadroes(linhas).filter((a) => !dispensados.has(a.id)).slice(0, limite) };
}
