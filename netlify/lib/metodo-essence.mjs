// O método de criação da Carol (das skills manual-criacao-conteudo, narrativa-mckee,
// content-strategy-instagram, conteudo-posicionamento, voz-essence, proibicoes-essence e
// fala-contada), resumido para a IA do Radar sugerir conteúdo do jeito dela.

export const METODO = `MÉTODO DE CRIAÇÃO (siga em toda sugestão):
1. Objetivo e linha editorial: escolha o objetivo (conexão, educação, posicionamento ou venda) e o tipo: carrossel técnico (salvamento, nível de consciência), de posicionamento (opinião que poucos têm coragem de dizer), de conexão (história, relacionamento) ou de venda (CTA claro ou disfarçado: "Comenta PALAVRA que eu te mando"). O objetivo define o CTA.
2. Gap em uma linha antes de tudo: crença comum do público / realidade que o conteúdo mostra. Construído sobre crenças comuns e conhecimento geral da área, nunca sobre fato inventado. Se o gap não cabe numa linha, a ideia não está pronta.
3. Estrutura de exibição (McKee), escolhida pelo objetivo: Linear clássica (ensinar com profundidade), Spoiler (prender até o fim no Reels), Pergunta aberta (gerar comentário), Confissão/erro (confiança; só com material real do médico), Contraste antes/depois (converter; sem antes e depois proibido pelo conselho), Alerta/autodiagnóstico (alcançar quem nem sabe que tem o problema; nunca em psiquiatria como autodiagnóstico).
4. Gancho: frase que para a rolagem em 2 a 3 segundos, criando desconforto, curiosidade ou identificação. Rotacione os arquétipos: crença quebrada, segredo/insider, dor emocional, contra-intuição, bastidor/vulnerabilidade. Se a frase pudesse abrir o post de qualquer concorrente, é fraca.
5. Esqueleto por formato: carrossel de conteúdo (capa com gancho, um slide por ideia, cada slide puxando o próximo com conectivo de fala, último slide com CTA); carrossel de conexão (fala do dia a dia como capa, história ou opinião, fecha com pergunta); Reels falado (gancho fixo na tela nos 2 primeiros segundos, desenvolvimento como pensamento em voz alta de 40 a 70 s, virada, CTA curto); Reels de texto na tela (8 a 10 s, frase de gancho, conteúdo completo na legenda em lista); Stories de venda (dor real, solução, o que recebe, condição).
6. Fala contada: o texto soa como o médico sentado diante do paciente, em primeira pessoa ("no meu consultório", "a gente conversa"), emendando as ideias com conectivos de conversa (e, mas, então, porque, já, foi ali que), com cenas do dia a dia no lugar de termos técnicos.
7. Nunca inventar história, caso de paciente, número ou depoimento: onde precisar, escreva [espaço para preencher com caso real do cliente].
8. Saúde: normas dos conselhos (sem promessa de resultado, sem sensacionalismo, sem antes e depois quando proibido, sem autopromoção, diagnóstico exige avaliação individual).
VOZ ESSENCE (proibido, em qualquer variação): travessão; "não é que... é que", "não é sobre... é sobre", "não por... por"; "isso muda tudo" e variações de "muda"; "tem gente", "tem criador", "ninguém percebe", "pouca gente sabe", "quase ninguém"; "sem perceber"; "porque... porque" em cadeia; "quem entender antes vai..."; "por trás de cada... tem"; as palavras caminhada, aprofundamento, clareza (vaga), intenção (de efeito), às vezes, na prática, real (como reforço); anglicismo quando há palavra em português; frase de efeito que convence pelo drama e não pelo argumento. Use "você", português correto, frases de conversa.`;

// Medo, desejo, estruturas e cuidado por especialidade (narrativa-mckee, references/nichos.md).
const NICHOS = {
  hiperidrose: { medo: 'julgamento social pelo suor em situações comuns; anos tratando como traço de personalidade', desejo: 'agir socialmente sem calcular cada interação pelo suor', estruturas: 'Alerta (suor comum × condição clínica) e Pergunta aberta (romper a associação com ansiedade)', cuidado: 'não prometer resultado igual para todos; diferenciar tratamento clínico e cirúrgico ao falar em "definitivo"' },
  halitose: { medo: 'que os outros percebam e não falem; vigilância constante do próprio hálito', desejo: 'conversar de perto sem monitorar a respiração', estruturas: 'Pergunta aberta (romper a crença de que é só higiene) e Alerta (sinais de causa não higiênica)', cuidado: 'acolher, não reforçar a vergonha' },
  ginecologia: { medo: 'desconforto em relatar sintomas íntimos; medo de estar exagerando; sintomas normalizados pela família', desejo: 'resposta clara sobre o próprio corpo sem precisar insistir para ser levada a sério', estruturas: 'Alerta (normal × o que merece investigação) e Pergunta aberta', cuidado: 'tom clínico e acolhedor, sem sensacionalizar; diagnóstico exige avaliação individual' },
  oftalmologia: { medo: 'negligência: sintoma visual atribuído a cansaço, tela ou idade', desejo: 'continuar lendo, dirigindo e trabalhando sem esperar doer para procurar ajuda', estruturas: 'Alerta (sintomas mal atribuídos) e Linear clássica (doenças silenciosas)', cuidado: 'conscientizar sem alarmar' },
  integrativa: { medo: 'ceticismo de quem já tentou abordagens fragmentadas', desejo: 'ser avaliado como um todo, com um plano que conecta os sintomas', estruturas: 'Contraste de entendimento (fragmentado × integrado) e Pergunta aberta', cuidado: 'nunca como substituto do tratamento convencional; reforçar complementaridade' },
  odontologia: { medo: 'medo do procedimento maior que o do problema, levando a anos de adiamento', desejo: 'resolver sem o sofrimento que imagina', estruturas: 'Pergunta aberta (desmontar a expectativa de dor) e Linear clássica (passo a passo tira o medo)', cuidado: 'honestidade sobre o desconforto; nunca vender "zero dor" como regra' },
  psiquiatria: { medo: 'julgamento por buscar ajuda; medo da medicação; achar que deveria dar conta sozinho', desejo: 'voltar a se sentir como si mesmo, sem operar no limite', estruturas: 'Pergunta aberta (fase difícil × quadro que merece avaliação); evitar Spoiler e Alerta que soem diagnóstico', cuidado: 'o nicho mais sensível: nunca minimizar sofrimento, nunca prometer resolução rápida, nunca autodiagnóstico; sempre reforçar avaliação' },
  marketing: { medo: 'investir em marketing e não ver retorno; parecer amador; depender só de indicação', desejo: 'previsibilidade de demanda e reconhecimento sem virar influencer', estruturas: 'Confissão (bastidor real), Pergunta aberta (crenças de mercado) e Contraste de entendimento', cuidado: 'resultado como possibilidade, nunca promessa' },
};

const PALAVRAS = [
  [/hiperidrose|suor|sudorese/, 'hiperidrose'], [/halit|halito|bucal/, 'halitose'], [/ginec|obstet|mulher|menopaus|gestac/, 'ginecologia'],
  [/oftalm|olho|visao|retina/, 'oftalmologia'], [/integrativ|funcional/, 'integrativa'], [/odonto|dent/, 'odontologia'],
  [/psiquiat|saude mental|ansiedade|depress|tdah|psicolog/, 'psiquiatria'], [/marketing|negocio|empreend|agencia/, 'marketing'],
];
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O pedaço do método para o nicho (pode juntar mais de um, ex.: odontologia + halitose).
export function metodoDoNicho(nicho) {
  const t = semAcento(`${nicho?.nome || ''} ${(nicho?.palavras || []).join(' ')}`);
  const achados = [...new Set(PALAVRAS.filter(([re]) => re.test(t)).map(([, id]) => id))];
  if (!achados.length) return 'NICHO: use o medo e o desejo típicos do público deste assunto, deduzidos das palavras-chave, sem inventar caso.';
  return achados.map((id) => {
    const n = NICHOS[id];
    return `NICHO ${id.toUpperCase()}: medo/vergonha do público: ${n.medo}. Desejo real: ${n.desejo}. Estruturas prioritárias: ${n.estruturas}. Cuidado: ${n.cuidado}.`;
  }).join('\n');
}
