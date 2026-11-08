// Revisão dos textos que a IA escreve (Carol, 08/11/2026: "tem várias estruturas proibidas nos
// conteúdos, português também"). Uma volta só, depois da escrita: o revisor do Criar (`revisar`)
// marca as estruturas proibidas da voz Essence, a IA reescreve só o necessário e corrige o
// português, e o travessão que sobrar sai sem IA. Se a revisão falhar, fica o texto original.

import { pedirJson, lista, objeto, texto, ErroIa } from './ia-comum.mjs';
import { revisar } from '../../js/dados-trabalho.js';

// Travessão (e meia-risca usada como travessão) vira vírgula; no começo da frase, sai.
export function semTravessao(t) {
  return String(t ?? '')
    .replace(/(^|\n)\s*[—–]\s*/g, '$1')
    .replace(/\s*[—–]\s*([.!?])/g, '$1')
    .replace(/\s+[—–]\s+|\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ');
}

export const REGRAS_DA_VOZ = `Estruturas proibidas da voz Essence (em qualquer variação) e como trocar:
- travessão: troque por vírgula, ponto ou dois-pontos;
- "não é que... é que", "não é sobre... é sobre", "não por... por" (negação + revelação): diga direto só o que é ("não é sobre o sol, é sobre a pele" vira "o cuidado é com a pele");
- "isso muda tudo" e variações de "muda" como efeito: diga o que muda, com contexto;
- "tem gente", "tem criador", "ninguém percebe", "pouca gente sabe", "quase ninguém": troque por um sujeito concreto ("muitas pacientes", "quem tem X");
- "sem perceber", "engole": diga o que acontece;
- "porque... porque" em cadeia; "quem entender antes vai..."; "por trás de cada... tem";
- as palavras caminhada, aprofundamento, clareza (vaga), intenção (de efeito), às vezes, na prática, real (como reforço), "cê";
- anglicismo quando há palavra em português; frase de efeito que convence pelo drama e não pelo argumento.`;

const SISTEMA = `Você é a revisora de texto da Agência Essence. Recebe textos curtos de conteúdo para Instagram (ganchos, slides, roteiros, legendas) e devolve cada um revisado.
Em cada texto:
1. Tire as estruturas proibidas da voz Essence (abaixo). Os alertas que vêm junto apontam o trecho; reescreva só o necessário.
2. Corrija o português do Brasil: ortografia, acentuação, crase, concordância, regência, pontuação e vírgula.
Mantenha o sentido, o tom de fala (primeira pessoa, "você", conectivos de conversa), os nomes, os números, os links e os [espaços para preencher]. Não acrescente informação nem frase nova. Texto que já está certo volta igual. Devolva todos os ids, cada um com o seu texto.

${REGRAS_DA_VOZ}`;

const ESQUEMA = objeto({ textos: lista('Textos revisados', objeto({ id: texto, texto })) });

// textos: [{ id, texto }] → Map(id → texto revisado). Sem IA ou com resposta estranha, o original.
export async function revisarTextos(textos, { saude = false, cliente, maxTokens = 12000 } = {}) {
  const entrada = textos.filter((x) => x.id && String(x.texto || '').trim()).slice(0, 120);
  const saida = new Map(entrada.map((x) => [x.id, x.texto]));
  if (!entrada.length) return saida;
  const pedido = entrada.map((x) => {
    const alertas = revisar(x.texto, { saude }).filter((a) => a.tipo === 'proibido').map((a) => `${a.trecho}: ${a.regra}`);
    return { id: x.id, texto: x.texto, ...(alertas.length ? { alertas } : {}) };
  });
  try {
    const r = await pedirJson({ system: SISTEMA, conteudo: JSON.stringify({ textos: pedido }), esquema: ESQUEMA, maxTokens, esforco: 'low', cliente });
    for (const t of Array.isArray(r?.textos) ? r.textos : []) {
      const original = saida.get(t?.id);
      const novo = String(t?.texto || '').trim();
      // Revisão que encolhe ou incha demais não é revisão: fica o original.
      if (original == null || !novo || novo.length < original.length * 0.5 || novo.length > original.length * 1.6 + 40) continue;
      saida.set(t.id, novo);
    }
  } catch (erro) {
    if (!(erro instanceof ErroIa)) console.warn('revisão de texto:', erro?.message);
  }
  for (const [id, t] of saida) saida.set(id, semTravessao(t));
  return saida;
}

// Os campos de texto das sugestões e do radar, achatados com um id cada (e de volta).
const CAMPOS_SUGESTAO = ['titulo', 'gancho', 'caso', 'gap', 'cta', 'cuidado', 'porque_agora'];
export function textosDoRadar(r) {
  const saida = [];
  for (const [cliente, c] of Object.entries(r?.clientes || {})) {
    (c.sugestoes || []).forEach((x, i) => {
      for (const k of CAMPOS_SUGESTAO) if (x[k]) saida.push({ id: `s|${cliente}|${i}|${k}`, texto: x[k] });
      (x.esqueleto || []).forEach((e, j) => saida.push({ id: `s|${cliente}|${i}|esqueleto|${j}`, texto: e }));
    });
  }
  (r?.itens || []).forEach((x, i) => {
    for (const k of ['tema', 'porque', 'gancho']) if (x[k]) saida.push({ id: `i|${i}|${k}`, texto: x[k] });
  });
  if (r?.briefing) saida.push({ id: 'briefing', texto: r.briefing });
  return saida;
}
export function aplicarNoRadar(r, revisados) {
  const pegar = (id, atual) => (revisados.has(id) ? revisados.get(id) : atual);
  const clientes = {};
  for (const [cliente, c] of Object.entries(r?.clientes || {})) {
    clientes[cliente] = {
      ...c,
      sugestoes: (c.sugestoes || []).map((x, i) => {
        const novo = { ...x };
        for (const k of CAMPOS_SUGESTAO) if (x[k]) novo[k] = pegar(`s|${cliente}|${i}|${k}`, x[k]);
        novo.esqueleto = (x.esqueleto || []).map((e, j) => pegar(`s|${cliente}|${i}|esqueleto|${j}`, e));
        return novo;
      }),
    };
  }
  const itens = (r?.itens || []).map((x, i) => {
    const novo = { ...x };
    for (const k of ['tema', 'porque', 'gancho']) if (x[k]) novo[k] = pegar(`i|${i}|${k}`, x[k]);
    return novo;
  });
  return { ...r, itens, clientes, briefing: r?.briefing ? pegar('briefing', r.briefing) : r?.briefing };
}
