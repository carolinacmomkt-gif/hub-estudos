// Leitor de tom de voz (R7, Carol 16/11/2026): a IA lê os textos aprovados de um cliente e devolve o
// perfil de voz em campos fixos, cada item com a fonte (o id do texto de onde saiu). Não inventa:
// item sem base fica vazio. A Carol confere e edita antes de salvar.

import { pedirJson, lista, objeto, texto, ErroIa } from './ia-comum.mjs';
import { conferirVoz, CAMPOS_VOZ, LISTAS_VOZ } from '../../js/dados-r7.js';

const item = objeto({ valor: texto, fonte: texto });
const ESQUEMA = objeto({
  ...Object.fromEntries(CAMPOS_VOZ.map((c) => [c.id, item])),
  ...Object.fromEntries(LISTAS_VOZ.map((l) => [l.id, lista(l.nome, item)])),
  usaEmoji: { type: 'boolean' },
  usaHashtag: { type: 'boolean' },
  palavrasPorFrase: { type: 'number' },
});

const SISTEMA = `Você lê textos aprovados de um cliente (legendas, copys, stories, falas transcritas) e descreve o jeito que ele escreve, para outra pessoa escrever igual.
Responda só com o que os textos mostram. Cada item leva em "fonte" o id do texto de onde saiu (um dos ids recebidos). Se os textos não mostram algo, deixe o valor vazio. Nunca invente.
Campos:
- pessoa: eu, nós, a clínica (e como se refere ao paciente: você, vocês).
- formalidade: formal, próxima, informal (com um exemplo curto).
- frases: tamanho das frases e dos parágrafos (curtas, médias, longas; parágrafos de 1 a 3 linhas…).
- abertura: como costuma abrir (pergunta, frase de paciente entre aspas, afirmação forte…).
- cta: o convite que usa e o caminho de agendamento.
- assinatura: a assinatura exatamente como aparece (ex.: nome | CRM).
- hashtags: se usa e quantas.
- expressoes: palavras e expressões que se repetem.
- nuncaUsa: palavras comuns no nicho que NUNCA aparecem nos textos (só se ficar claro pela ausência em vários textos).
- emojis: os emojis que usa (um por item).
- temas: temas recorrentes.
- exemplos: 3 trechos curtos copiados exatamente dos textos, que mostram bem a voz.
- usaEmoji, usaHashtag: verdadeiro ou falso, pelo que os textos mostram.
- palavrasPorFrase: média aproximada de palavras por frase.
Português do Brasil.`;

export async function lerVoz({ nome, textos }, { cliente } = {}) {
  const entrada = (textos || []).filter((t) => t?.id && String(t.texto || '').trim()).slice(0, 30)
    .map((t) => ({ id: String(t.id).slice(0, 80), fonte: String(t.fonte || '').slice(0, 80), texto: String(t.texto).slice(0, 4000) }));
  if (!entrada.length) throw new ErroIa('Escolha pelo menos um texto para ler a voz.');
  const r = await pedirJson({ system: SISTEMA, conteudo: JSON.stringify({ cliente: String(nome || '').slice(0, 120), textos: entrada }), esquema: ESQUEMA, maxTokens: 6000, esforco: 'low', cliente });
  return conferirVoz(r, entrada.map((t) => t.id));
}

export { ErroIa };
