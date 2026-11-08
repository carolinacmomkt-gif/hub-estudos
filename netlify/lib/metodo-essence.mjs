import { especialidade, especialidadesNoTexto, regraDoCta } from '../../js/especialidades.js';

// O método de criação da Carol (das skills manual-criacao-conteudo, narrativa-mckee,
// content-strategy-instagram, conteudo-posicionamento, voz-essence, proibicoes-essence e
// fala-contada), resumido para a IA do Radar sugerir conteúdo do jeito dela.

export const METODO = `MÉTODO DE CRIAÇÃO (siga em toda sugestão):
1. Objetivo e linha editorial: escolha o objetivo (conexão, educação, posicionamento ou venda) e o tipo: carrossel técnico (salvamento, nível de consciência), de posicionamento (opinião que poucos têm coragem de dizer), de conexão (história, relacionamento) ou de venda (CTA claro). O objetivo define o CTA, e o CTA precisa fazer sentido para a cliente: no nicho da saúde o convite principal é agendar (consulta, avaliação ou sessão), e salvar, comentar ou compartilhar só entram como segundo convite quando combinam com a peça (veja a regra do CTA do nicho).
2. Gap em uma linha antes de tudo: crença comum do público / realidade que o conteúdo mostra. Construído sobre crenças comuns e conhecimento geral da área, nunca sobre fato inventado. Se o gap não cabe numa linha, a ideia não está pronta.
3. Estrutura de exibição (McKee), escolhida pelo objetivo: Linear clássica (ensinar com profundidade), Spoiler (prender até o fim no Reels), Pergunta aberta (gerar comentário), Confissão/erro (confiança; só com material real do médico), Contraste antes/depois (converter; sem antes e depois proibido pelo conselho), Alerta/autodiagnóstico (alcançar quem nem sabe que tem o problema; nunca em psiquiatria como autodiagnóstico).
4. Gancho: frase que para a rolagem em 2 a 3 segundos, criando desconforto, curiosidade ou identificação. Rotacione os arquétipos: crença quebrada, segredo/insider, dor emocional, contra-intuição, bastidor/vulnerabilidade. Se a frase pudesse abrir o post de qualquer concorrente, é fraca.
5. Esqueleto por formato: carrossel de conteúdo (capa com gancho, um slide por ideia, cada slide puxando o próximo com conectivo de fala, último slide com CTA); carrossel de conexão (fala do dia a dia como capa, história ou opinião, fecha com pergunta); Reels falado (gancho fixo na tela nos 2 primeiros segundos, desenvolvimento como pensamento em voz alta de 40 a 70 s, virada, CTA curto); Reels de texto na tela (8 a 10 s, frase de gancho, conteúdo completo na legenda em lista); Stories de venda (dor real, solução, o que recebe, condição).
6. Fala contada: o texto soa como o médico sentado diante do paciente, em primeira pessoa ("no meu consultório", "a gente conversa"), emendando as ideias com conectivos de conversa (e, mas, então, porque, já, foi ali que), com cenas do dia a dia no lugar de termos técnicos.
7. Nunca inventar história, caso de paciente, número ou depoimento: onde precisar, escreva [espaço para preencher com caso real do cliente].
8. Saúde: normas dos conselhos (sem promessa de resultado, sem sensacionalismo, sem antes e depois quando proibido, sem autopromoção, diagnóstico exige avaliação individual).
VOZ ESSENCE (proibido, em qualquer variação): travessão; "não é que... é que", "não é sobre... é sobre", "não por... por"; "isso muda tudo" e variações de "muda"; "tem gente", "tem criador", "ninguém percebe", "pouca gente sabe", "quase ninguém"; "sem perceber"; "porque... porque" em cadeia; "quem entender antes vai..."; "por trás de cada... tem"; as palavras caminhada, aprofundamento, clareza (vaga), intenção (de efeito), às vezes, na prática, real (como reforço); anglicismo quando há palavra em português; frase de efeito que convence pelo drama e não pelo argumento. Use "você", português correto, frases de conversa.`;

// Medo, desejo, estruturas e cuidado por especialidade (narrativa-mckee, references/nichos.md, e as
// demais especialidades da saúde em js/especialidades.js, a mesma lista do app).
// O pedaço do método para o nicho. Nicho de uma especialidade da lista vem pelo id; nicho escrito à
// mão, pelo nome (e pelas palavras, se o nome não disser), até 2 especialidades (ex.: odontologia + halitose).
export function metodoDoNicho(nicho) {
  let achados = [];
  const doId = especialidade(nicho?.id);
  if (doId) achados = [doId, ...especialidadesNoTexto(nicho?.nome).filter((e) => e !== doId)].slice(0, 2);
  else {
    achados = especialidadesNoTexto(nicho?.nome);
    if (!achados.length) achados = especialidadesNoTexto((nicho?.palavras || []).join(' '));
    achados = achados.slice(0, 2);
  }
  if (!achados.length) return `NICHO: use o medo e o desejo típicos do público deste assunto, deduzidos das palavras-chave, sem inventar caso.\n${regraDoCta(nicho?.nome)}`;
  return [...achados.map((n) => `NICHO ${n.nome.toUpperCase()}: medo/vergonha do público: ${n.medo}. Desejo real: ${n.desejo}. Estruturas prioritárias: ${n.estruturas}. Cuidado: ${n.cuidado}.`), regraDoCta(achados[0].nome)].join('\n');
}
