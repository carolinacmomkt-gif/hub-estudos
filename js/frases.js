// Frases do dia (Metas e o Hoje). Escolhidas para a Carol: escrever e criar, estudar, coragem,
// recomeçar e dinheiro. Só frases com autoria conhecida e conferida (nada de citação de internet
// atribuída a quem nunca disse). Muda uma vez por dia, na mesma ordem em todos os aparelhos.

export const FRASES = [
  { texto: 'Recria tua vida, sempre, sempre. Remove pedras e planta roseiras e faz doces. Recomeça.', autor: 'Cora Coralina', obra: 'Aninha e suas pedras' },
  { texto: 'A vida só é possível reinventada.', autor: 'Cecília Meireles', obra: 'Reinvenção' },
  { texto: 'O que ela quer da gente é coragem.', autor: 'Guimarães Rosa', obra: 'Grande Sertão: Veredas' },
  { texto: 'Tudo vale a pena se a alma não é pequena.', autor: 'Fernando Pessoa', obra: 'Mar Português' },
  { texto: 'Sonhar é acordar-se para dentro.', autor: 'Mario Quintana' },
  { texto: 'Liberdade é pouco. O que eu desejo ainda não tem nome.', autor: 'Clarice Lispector', obra: 'Perto do Coração Selvagem' },
  { texto: 'Enquanto eu tiver perguntas e não houver resposta continuarei a escrever.', autor: 'Clarice Lispector', obra: 'A Hora da Estrela' },
  { texto: 'Ninguém ignora tudo. Ninguém sabe tudo. Todos nós sabemos alguma coisa. Todos nós ignoramos alguma coisa. Por isso aprendemos sempre.', autor: 'Paulo Freire' },
  { texto: 'É preciso ter esperança, mas ter esperança do verbo esperançar.', autor: 'Paulo Freire', obra: 'Pedagogia da Esperança' },
  { texto: 'Ostra feliz não faz pérola.', autor: 'Rubem Alves' },
  { texto: 'Tenho apenas duas mãos e o sentimento do mundo.', autor: 'Carlos Drummond de Andrade', obra: 'Sentimento do Mundo' },
  { texto: 'Não quero faca nem queijo. Quero a fome.', autor: 'Adélia Prado' },
  { texto: 'Diga-me, o que você planeja fazer com sua única vida, selvagem e preciosa?', autor: 'Mary Oliver', obra: 'The Summer Day' },
  { texto: 'Instruções para viver uma vida: preste atenção. Deixe-se maravilhar. Conte sobre isso.', autor: 'Mary Oliver', obra: 'Sometimes' },
  { texto: 'Como passamos nossos dias é, claro, como passamos nossas vidas.', autor: 'Annie Dillard', obra: 'The Writing Life' },
  { texto: 'Se há um livro que você quer ler, mas que ainda não foi escrito, então você deve escrevê-lo.', autor: 'Toni Morrison' },
  { texto: 'Não há agonia maior do que carregar uma história não contada dentro de você.', autor: 'Maya Angelou', obra: 'Eu sei por que o pássaro canta na gaiola' },
  { texto: 'Você pode encontrar muitas derrotas, mas não deve ser derrotada.', autor: 'Maya Angelou' },
  { texto: 'Uma mulher precisa ter dinheiro e um teto todo seu se quiser escrever ficção.', autor: 'Virginia Woolf', obra: 'Um teto todo seu' },
  { texto: 'A coragem começa quando a gente aparece e se deixa ser vista.', autor: 'Brené Brown', obra: 'A coragem de ser imperfeito' },
  { texto: 'A vulnerabilidade é o berço da inovação, da criatividade e da mudança.', autor: 'Brené Brown', obra: 'A coragem de ser imperfeito' },
  { texto: 'Quase tudo volta a funcionar se você desligar por alguns minutos, inclusive você.', autor: 'Anne Lamott' },
  { texto: 'Viva as perguntas agora.', autor: 'Rainer Maria Rilke', obra: 'Cartas a um jovem poeta' },
  { texto: 'Comece onde você está. Use o que você tem. Faça o que você pode.', autor: 'Arthur Ashe' },
  { texto: 'Uma jornada de mil léguas começa com um único passo.', autor: 'Lao-Tsé', obra: 'Tao Te Ching' },
  { texto: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', autor: 'Sêneca', obra: 'Cartas a Lucílio' },
  { texto: 'Não são as coisas que nos perturbam, mas a opinião que temos sobre elas.', autor: 'Epicteto', obra: 'Manual' },
  { texto: 'Quem tem um porquê para viver suporta quase qualquer como.', autor: 'Friedrich Nietzsche', obra: 'Crepúsculo dos Ídolos' },
  { texto: 'Você não sobe ao nível das suas metas. Você cai ao nível dos seus sistemas.', autor: 'James Clear', obra: 'Hábitos Atômicos' },
  { texto: 'A melhor maneira de prever o futuro é inventá-lo.', autor: 'Alan Kay' },
  { texto: 'Feito é melhor que perfeito.', autor: 'Sheryl Sandberg', obra: 'Faça Acontecer' },
  { texto: 'Pessoas como nós fazem coisas assim.', autor: 'Seth Godin', obra: 'Isso é marketing' },
  { texto: 'Riqueza é o que você não vê.', autor: 'Morgan Housel', obra: 'A psicologia financeira' },
  { texto: 'Gastar dinheiro para mostrar às pessoas quanto dinheiro você tem é o jeito mais rápido de ter menos dinheiro.', autor: 'Morgan Housel', obra: 'A psicologia financeira' },
  { texto: 'Todos estes que aí estão atravancando meu caminho, eles passarão… Eu passarinho!', autor: 'Mario Quintana', obra: 'Poeminho do Contra' },
];

// Mesma frase o dia inteiro; no dia seguinte, a próxima.
export function fraseDoDia(data = new Date()) {
  const dia = Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / 864e5);
  return FRASES[((dia % FRASES.length) + FRASES.length) % FRASES.length];
}
