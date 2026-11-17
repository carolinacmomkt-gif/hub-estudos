# Conteúdo da quinzena para a Bússola (R7)

Instrução para o Claude neste projeto: quando a Carol pedir o conteúdo da quinzena (ou o documento para a Bússola), entregue **um único documento**, em texto corrido, seguindo exatamente o formato abaixo. Pode ser em PDF, Word ou texto. A Bússola lê esse documento sozinha e monta o cronograma no visual da R7, com o que falta conferido pelo manual.

- Use a assinatura e o registro deste cliente, exatamente como estão na ficha do projeto.
- Siga o manual da R7 (cronograma, stories, carrosséis e Trello) e a identidade visual do cliente.
- Escreva cada campo numa linha própria, com o nome do campo e dois-pontos. Nada de tabela.
- As artes não vão no documento: elas entram depois, pelo Trello (carrosséis e estáticos) ou anexadas na Bússola (stories e capa do reel).

```
FORMATO DO CONTEÚDO DA QUINZENA (para a Bússola ler sozinha)

Regras:
- Uma peça por bloco, na ordem de postagem.
- Cada bloco começa com uma linha só com a data e o tipo: 23.11 · CARROSSEL (pode ter ### na frente).
- Tipos aceitos: CARROSSEL, ESTÁTICO, REEL, STORIES, STORIES DE BOM DIA.
- Cada campo começa com o nome e dois-pontos, numa linha própria. Pode ocupar várias linhas.
- Não use tabela: a Bússola lê linha por linha.
- Carrossel: capa + 4 a 7 cards, o último é a chamada, sem emoji nas lâminas.
- Stories: de 3 a 5 telas, na ordem gancho, interação, virada, prova, chamada; o link sempre na última.
- Toda legenda termina com a assinatura e o registro do cliente.

Topo do documento:
Cliente: Dr. Nome Sobrenome
Período: 23/11 a 04/12

### 23.11 · CARROSSEL
Tema: Eu sou ansiosa?
Slides:
Slide 01 | Capa (foto do cliente sorrindo): Eu sou ansiosa?
Slide 02 | Card 1: Texto do card 1.
Slide 03 | Card 2: Texto do card 2.
Legenda:
Texto da legenda em parágrafos curtos.
Frase-assinatura.
Dr. Nome Sobrenome | Médico | CRM-UF 00000

### 24.11 · STORIES
Tema: A consulta de uma hora
Tela 1 (gancho): Título da tela | Texto de apoio
Tela 2 (interação): Título | Apoio
Tela 3 (virada): Título | Apoio
Tela 4 (prova): Título | Apoio
Tela 5 (chamada): Título | Apoio
Por cima: repost do post do dia; enquete Sim / Não; link de agendamento

### 25.11 · REEL
Tema: Antidepressivo vicia?
Texto da capa: Antidepressivo vicia? Em geral, não.
Link do vídeo: https://drive.google.com/...
Legenda:
Texto da legenda.
Dr. Nome Sobrenome | Médico | CRM-UF 00000

### 26.11 · ESTÁTICO
Tema: Circulação em viagens longas
Texto da arte: O texto que vai na arte.
Legenda:
Texto da legenda.
Dr. Nome Sobrenome | Médico | CRM-UF 00000
```

## Como a Bússola identifica cada peça

| No documento | Na Bússola |
|---|---|
| A linha `23.11 · CARROSSEL` (com ou sem `###`) | Abre uma peça no dia 23/11, do tipo carrossel |
| `Slide 01 \| Capa (foto): texto` | Lâmina 1 (a indicação entre parênteses é para o designer) |
| `Tela 1 (gancho): título \| apoio` | Tela 1 do story, com a função e o texto de apoio |
| `Por cima: …` | O que entra por cima: repost na tela 1, enquete ou caixinha na 2, link na última |
| `Texto da capa:` e `Link do vídeo:` | Capa e vídeo do reel |
| `Texto da arte:` | O texto da arte do estático |
| `Período: 23/11 a 04/12` | O período do cronograma (sem essa linha, vale da primeira à última data) |

Se você subir de novo um documento do mesmo período, a Bússola atualiza o cronograma: a peça do mesmo dia e tipo recebe o texto novo, e as artes que já estavam ficam.
