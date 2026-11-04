// IA do Foco acompanhado (só quando a Carol pede): quebrar o que ela vai fazer em passos pequenos e,
// quando ela trava, sugerir o próximo passo pequeno. Recebe só o título e os passos, nada mais.

import { pedirJson, lista, objeto, texto, limpar } from './ia-comum.mjs';

const SYSTEM = `Você ajuda a Carol a começar e a não travar numa sessão de foco (estudo, trabalho ou vida).
Passos pequenos de verdade: cada um cabe em 5 a 15 minutos, começa com um verbo concreto ("Abrir", "Escrever", "Listar") e tem até 70 letras.
Português do Brasil, tom direto e acolhedor. Sem travessão, sem jargão, sem emoji.`;

export async function dividirEmPassos({ titulo, minutos }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: [{ type: 'text', text: `Ela vai fazer: "${limpar(titulo, 140)}" num foco de ${Number(minutos) || 25} minutos.\nQuebre em 3 a 6 passos pequenos, na ordem. O primeiro precisa ser o mais fácil possível (o empurrão para começar).` }],
    esquema: objeto({ passos: lista('Passos pequenos, na ordem', texto) }),
    maxTokens: 800,
    cliente,
  });
  return { passos: (r.passos || []).map((p) => limpar(p, 80)).filter(Boolean).slice(0, 6) };
}

export async function destravar({ titulo, passo, feitos }, { cliente } = {}) {
  const r = await pedirJson({
    system: SYSTEM,
    conteudo: [{ type: 'text', text: `Ela está fazendo: "${limpar(titulo, 140)}".\n${passo ? `Travou no passo: "${limpar(passo, 100)}".` : 'Travou e não sabe por onde seguir.'}\n${(feitos || []).length ? `Já fez: ${(feitos || []).slice(0, 6).map((f) => `"${limpar(f, 80)}"`).join(', ')}.` : ''}\nSugira um passo menor ainda, que ela consiga fazer nos próximos 5 minutos ("passo"), e uma frase curta de ânimo prático ("dica", até 120 letras).` }],
    esquema: objeto({ passo: texto, dica: texto }),
    maxTokens: 400,
    cliente,
  });
  return { passo: limpar(r.passo, 80), dica: limpar(r.dica, 140) };
}
