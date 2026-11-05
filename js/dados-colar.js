// "Colar demandas" (Caixa de entrada, decisão da Carol em 05/11/2026): um texto colado (mensagem,
// e-mail, lista) vira várias tarefas, distribuídas nos próximos dias de trabalho com horário, sem
// cobrir compromisso nem hora protegida e sem passar das horas por dia. Sem DOM: a separação simples
// (sem IA, também a reserva sem internet), a conferência do que a IA devolveu e a distribuição.

import { AREAS_TAREFA, lerTarefaRapida } from './dados-tarefas.js';
import { organizarSimples, paraMin } from './dados-organizar.js';

export const MAX_ITENS_COLAR = 25;
const AREAS = AREAS_TAREFA.map((a) => a.id);
const limpo = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const dataOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
const horaOk = (h) => (paraMin(h) !== null && /^\d{2}:\d{2}$/.test(h || '') ? h : null);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const maiuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// Confere cada item (da IA ou do jeito simples): título, área, datas e números no formato certo.
export function conferirDemandas(itens) {
  return (Array.isArray(itens) ? itens : []).map((x) => ({
    titulo: maiuscula(limpo(x?.titulo, 140)),
    area: AREAS.includes(x?.area) ? x.area : 'trabalho',
    quem: limpo(x?.quem, 60) || null,
    prazo: dataOk(x?.prazo),
    hora: horaOk(x?.hora),
    minutos: Math.max(15, Math.min(240, Math.round((Number(x?.minutos) || 30) / 15) * 15)),
    prioridade: [0, 1, 2].includes(Number(x?.prioridade)) ? Number(x.prioridade) : 0,
    trecho: limpo(x?.trecho, 300),
  })).filter((x) => x.titulo.length >= 3).slice(0, MAX_ITENS_COLAR);
}

// Linhas que não são pedido: cumprimento, agradecimento, assinatura.
const RUIDO = /^(oi+|ola|ola+|bom dia|boa tarde|boa noite|tudo bem|obrigad[ao]|valeu|beijos?|bjs?|abs|abracos?|att|atenciosamente|segue[m]?( abaixo)?|qualquer duvida.*|fico no aguardo.*|ok|blz|beleza)[\s!.,:;?]*$/;
// Cumprimento curto ("Oi Carol, tudo bem?"), abertura ("Seguem as demandas:") e título de lista.
const ehRuido = (plano, linha) => /:\s*$/.test(linha)
  || (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|obrigad|segue|seguem|qualquer duvida|fico no aguardo|beijo|abraco)\b/.test(plano) && plano.split(/\s+/).length <= 8);
const PALAVRAS_TRABALHO = /\b(dra?\.?|doutora?|cliente|post|posts|arte|artes|legenda|reels?|stories|carrossel|roteiro|copy|briefing|pauta|trello|notion|instagram|aprova[cç][aã]o|design)\b/;

function quemNo(texto) {
  const m = String(texto).match(/\b(Dra?\.?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+)?)/);
  return m ? m[1].replace(/\s+/g, ' ') : null;
}

// Sem IA: uma demanda por linha (ou por ";" quando vem tudo numa linha só).
export function separarSimples(texto, hoje) {
  let linhas = String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 1) linhas = linhas[0].split(/;|\s(?=\d+[.)]\s)/).map((l) => l.trim()).filter(Boolean);
  const itens = [];
  for (const original of linhas) {
    const linha = original.replace(/^([-*•·▪◦–]|\d+[.)-]|\[\s?[x ]?\s?\])\s*/i, '').trim();
    const plano = semAcento(linha);
    if (linha.length < 4 || RUIDO.test(plano) || ehRuido(plano, linha)) continue;
    const r = lerTarefaRapida(linha.replace(/\b(at[eé]|pra|para)\s+(?=(hoje|amanh|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|dia\s\d|\d{1,2}\/))/gi, ''), hoje);
    const titulo = r.titulo.replace(/\s*[,.;:-]+$/, '').replace(/\burgente\b/i, '').trim();
    itens.push({
      titulo, area: r.area || (PALAVRAS_TRABALHO.test(plano) ? 'trabalho' : 'pessoal'), quem: quemNo(linha),
      prazo: r.data, hora: r.hora, minutos: 30,
      prioridade: /\burgente|\bhoje sem falta|\bpra ontem/.test(plano) ? 2 : r.prioridade, trecho: original,
    });
  }
  return conferirDemandas(itens);
}

// Distribui nos dias: "base" é a entrada da semana (dias livres, compromissos, horas protegidas e
// o que já está marcado). Devolve os itens com dia e horário sugeridos (ou "semEspaco").
export function distribuir(itens, base) {
  const entrada = {
    ...base,
    itens: itens.map((x, i) => ({
      id: `c:${i}`, demanda_id: null, tarefa_id: null, titulo: x.titulo, quem: x.quem, onde: null, tipo: null,
      prazo: x.prazo, hora: x.hora, minutos: x.minutos, prioridade: x.prioridade, atual: null,
    })),
  };
  const plano = entrada.dias.length ? organizarSimples(entrada) : { blocos: [], naoCabe: entrada.itens.map((x) => ({ item_id: x.id, sugestao: null, mensagem: '' })) };
  return itens.map((x, i) => {
    const b = plano.blocos.find((y) => y.item_id === `c:${i}`);
    if (b) return { ...x, data: b.data, inicio: b.inicio, fim: b.fim, semEspaco: null };
    const n = plano.naoCabe.find((y) => y.item_id === `c:${i}`);
    return { ...x, data: n?.sugestao || x.prazo || null, inicio: x.hora || null, fim: null, semEspaco: { sugestao: n?.sugestao || null, mensagem: n?.mensagem || '' } };
  });
}

export const somaHora = (hora, min) => {
  const t = paraMin(hora);
  if (t === null) return null;
  const f = Math.min(23 * 60 + 59, t + min);
  return `${String(Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`;
};
