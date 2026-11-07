# Bússola (antigo Hub de Estudos da Carol)

App pessoal de vida, rotina e estudos (uso exclusivo da Carol), instalável como PWA no Galaxy Tab S10 Lite (S Pen) e usado também no computador e no celular.

Áreas do app:
- **Faculdade**: UniEVANGÉLICA, integrada ao AVA (Moodle).
- **Estudos gerais**.
- **Substack**.
- **YouTube** (planejamento do canal).
- **Cadernos** com escrita à mão.
- **Calendário**.
- **Trabalho** (o Pauta dentro da Bússola, 01/11/2026): Clientes, Radar do nicho, Conteúdo, Criar, Aprovar, Pautas e Relatórios.
- **Vida** (fase 2, ver ROTEIRO.md): Hoje, tarefas e projetos, hábitos e rotinas, finanças (com gamificação e recompensas), diário, casa, consultoria (carteira de clientes e produto), metas e lazer.

## Regras gerais

- Todo texto da interface fica em **português do Brasil**, com tom direto e acolhedor, igual à Central de Conteúdo.
- Mantenha o mesmo padrão de arquitetura da Central de Conteúdo (centralconteudo.netlify.app):
  - **HTML + CSS + JavaScript puro**, sem framework e sem etapa de build.
  - Código dividido em módulos pequenos e com nomes em português, como `estado.js`, `persistencia.js`, `views-*.js`, `eventos.js` e `main.js`.
- Nunca coloque chaves, tokens ou senhas no front-end ou no repositório. Tudo que é secreto fica em variáveis de ambiente da Netlify e é usado só nas Netlify Functions.
- Antes de cada módulo novo, descreva o plano em poucas linhas e espere o OK da Carol. Ao terminar, diga como testar.
- A usabilidade precisa ser fluida e gostosa: resposta imediata ao toque, movimento leve (respeitando "reduzir animações") e nada de tela pulando com a sincronização.
- **Nunca use `window.confirm`, `window.prompt` ou `alert`**: eles travam a tela e ficam fora do tema. Use `confirmar(texto, { titulo, botao, perigo })` e `perguntarTexto(rotulo, { padrao, maximo })` de `js/confirmar.js` (os dois devolvem Promise; num handler síncrono, use `.then`). A primeira frase até o "?" vira o título, o resto a explicação, e o verbo da pergunta vira o botão ("Excluir", "Mandar para a lixeira"); ações que apagam ganham o botão de perigo. É folha de baixo no toque e cartão no meio no computador. O `ligarConfirmar()` também redireciona qualquer `window.confirm` esquecido.
- Toque de 44px vale também para abas (`.segmentado`), chips de filtro e botões de ícone no celular e no tablet (regra `@media (pointer: coarse)` em `padroes.css`).
- Teste sempre em largura de tablet na horizontal e na vertical (1340×800 / 800×1340) e no celular (375px).

## Stack

| Parte | Tecnologia |
|---|---|
| Front-end | HTML/CSS/JS puro, PWA (manifest + service worker, funciona offline) |
| Hospedagem | Netlify |
| Backend | Netlify Functions (Node) |
| Banco e sincronização | Supabase (Postgres + Auth com login só da Carol + Storage para PDFs, imagens e páginas de caderno) |
| Cache local | IndexedDB, para abrir rápido e funcionar sem internet; sincroniza com o Supabase quando volta a conexão |
| Escrita à mão | `perfect-freehand` (traço com pressão) sobre canvas, usando Pointer Events |
| IA | API da Anthropic (modelo `claude-sonnet-5-5`) com a ferramenta de web search, chamada só pelas funções (`ia-background`, que lê PDFs da Biblioteca, `calendario-ler-background`, que lê o calendário acadêmico, `youtube-ia`, `planejar-dia`, que monta os blocos do "Planejar meu dia", `demandas`, que sugere prazo, tempo e prioridade das demandas e organiza a semana com elas, `perguntar`, que responde o "Pergunte à Bússola", `capturar`, que separa a fala da captura por voz em itens e, no modo `demandas`, o texto colado do "Colar demandas" em tarefas, `foco-ia`, que quebra o que ela vai fazer em passos pequenos e sugere um passo menor quando ela trava no Foco acompanhado, `livro-ia`, que explica um trecho e resume um capítulo no leitor de livros, `trabalho` (ação `ia`), que escreve peças no método da Essence com a memória de cada cliente, e ação `relatorio-consideracoes`), `radar-background`, que cruza os sinais do Radar do nicho com a pesquisa na web, `relatorio-ler-background`, que lê os prints do Instagram para o relatório de métricas, e `pauta-legenda-background`, que escreve a legenda da pauta olhando as artes) |
| AVA | API de web services do Moodle 5.1 (Open LMS) da UniEVANGÉLICA |

## Visual

A base é a identidade da Central de Conteúdo.

- **Tema escuro (padrão da Central)**: fundo grafite neutro (`#191919`, escolhido pela Carol em 27/10/2026 no lugar do marrom `#17110D`, que cansava), cards em grafite um pouco mais claro (`#242424`), destaque bege/areia (`#E8D3BF`) e texto creme.
- **Tema claro (novo)**: fundo cinza claro neutro (`#F1F1F1`, no lugar do creme `#F5EEE5`), cards brancos, texto marrom-café (`#2B1E16`) e o mesmo bege como destaque, com contraste mínimo AA.
- Contraste revisado em 27/10/2026: texto principal ~13:1 (não no máximo, para não cansar), campos com borda de 3:1 (`--cor-borda-campo`), cards um pouco mais claros que o fundo no escuro. Linhas (opção B, escolhida pela Carol): cards e divisórias com `--cor-linha` bem suave e relevo pela sombra (`--sombra-card`); campos preenchidos com a linha de baixo em 3:1; botões, chips e controles mantêm `--cor-borda`.
- Bege no escuro em dois papéis (opção C, escolhida pela Carol em 27/10/2026): superfícies grandes (botão principal, "+", Próximo passo, aba ativa) usam `--cor-preenchido` (tom quente escuro) com `--cor-sobre-preenchido` (creme); detalhes pequenos (barras, bolinhas, dia de hoje) usam `--cor-destaque` (bege apagado). No claro, `--cor-preenchido` é o próprio bege.
- Alternância entre **claro, escuro e automático** (segue o sistema), com a escolha salva no aparelho.
- **Vidro** (decisão da Carol, 29/10/2026, inspirado no iOS 26/27; `css/vidro.css`, carregado por último): só a camada de navegação e controle é translúcida com desfoque (`--vidro*` em `temas.css`): barra de baixo do celular (flutuante, com margem de 16px e o "+" dentro dela na ponta direita; ao rolar para baixo fica baixa, só com ícones, `body[data-rolando="baixo"]`), a lupa do celular flutuando no canto de cima, menu lateral (trilho solto com margem; no modo só ícones há um botão para voltar aos nomes e outro para esconder, sem passar por todos os modos), folhas, avisos. Cards, listas e campos continuam opacos; nunca vidro sobre vidro. Cantos menos redondos e concêntricos: card 16 (`--raio-lg`), botão 12 (`--raio`), folha 20 (`--raio-folha`); o de dentro é o de fora menos a margem. "Reduzir transparência" do sistema e a chave Vidro em Configurações (`hub.vidro`, `html[data-vidro="nao"]`) deixam tudo opaco; "reduzir animações" tira os movimentos.
  - **Mais vidro** (03/11/2026, prévia aprovada; fim de `vidro.css`): uma luz suave no fundo do `body`; no tablet e no computador (≥701 px) o topo da tela (`.cabecalho`) fica preso ao rolar, em vidro (com `scroll-padding-top` e solto enquanto o Hoje é arrumado), e as abas e os filtros ganham vidro leve; os cards Prioridades da semana, alertas e datas do Trabalho ganham vidro levemente colorido. O Próximo passo continua preenchido. Tudo respeita "reduzir transparência" e a chave Vidro.
  - **Enquadramento** (Carol, 03/11/2026): o topo em vidro tem as bordas nas mesmas linhas dos cards e o título alinhado ao texto de dentro deles (padding 16/22); título e ações ficam na mesma linha sempre que cabe; subtítulos e textos corridos em até ~68 caracteres por linha (alvo de 50–75); a largura máxima do conteúdo é 1.240 px, e 1.540 px em telas de 1.600 px ou mais (opção 3 da Carol: o vão entre o menu e o conteúdo fica em ~100 px num monitor de 1.890 px); grades de cards com linhas cheias (Projetos: 3 colunas no computador, 2 no tablet em pé, 1 no celular, cards da mesma altura); o farol do Painel de projetos ocupa a largura toda.
- **Enquadramento** (varredura do app todo, 07/11/2026; `css/enquadramento.css`, carregado depois de `padroes.css`, e `js/rolagem.js`): nenhuma tela rola para o lado em 1340, 800 e 375; faixas que rolam (`.segmentado`, quadros do YouTube e do Aprovar) ganham esmaecido na ponta que continua (`data-rola`, `marcarRolagens`); no Hoje, o último card de uma linha incompleta estica até o fim (`fecharLinhas`); grades com colunas iguais (opções da Aparência em 3, dias em pílula em 4 + 3 no celular, copos de água 4 + 4, sons 2 × 2); o último card sozinho numa grade de 2 do Cantinho ocupa a linha; textos de ajuda em até 68 caracteres. Correção nova vai para `enquadramento.css`, não espalhada.
- **Topo das telas** (Carol, 03/11/2026): o botão principal da tela fica no topo, ao lado da lupa (`cabecalho(titulo, sub, acao)`): Novo evento, Adicionar leitura, Novo caderno, Nova pauta, Nova ideia de vídeo, Nova trilha, Novo hábito, Novo projeto. A escolha de tema saiu do topo e fica em Configurações → Geral. A Entrada tem as Demandas em 2/3 e a Caixa de entrada em 1/3.
- **Celular limpo** (decisão da Carol, 03/11/2026; `css/celular.css`, carregado depois do vidro e só até 700 px), pelos guias da Apple e do Material 3: margem de 16 e ritmo de 8; título de 28 px e subtítulo menor em `--cor-texto-fraco`; três níveis de botão (principal preenchido, secundário em tom `--cor-superficie-2` sem contorno, ícones × e setas sem caixa); abas e chips em tom com o escolhido preenchido; no claro o tom é um véu do texto (7%), para aparecer sobre o fundo e sobre o card; card com 16 de respiro; a peça em atraso do Conteúdo sem borda colorida; "Continuar de onde parou" com pílula pequena; nomes inteiros na barra de baixo. Campos de formulário mantêm a linha de 3:1. No Cantinho, as ações ficam acima da saudação no celular.
- **Ícone do app** (escolha da Carol, 03/11/2026; `icones/*-v4.*`): a estrela da marca em vidro líquido (estilo iOS 26, borda de luz e brilho) sobre um degradê caramelo → cacau. `icone-v4.svg` com cantos arredondados (aba e "any"); `icone-maskable-v4.svg` quadrado para o Android (maskable) e o iPhone (apple-touch), que arredondam sozinhos.
- Todas as cores ficam definidas como variáveis CSS em `:root` e `[data-tema="claro"]` / `[data-tema="escuro"]`. Nenhuma cor deve ficar escrita direto nos componentes.
- Padrões da Central que se repetem no app:
  - saudação com a data no topo ("Boa tarde, Carol.");
  - card grande de **"Próximo passo"**;
  - cards numerados com barra de progresso;
  - tipografia do sistema;
  - bordas arredondadas.
- A área de toque mínima é de 44px, pensando no uso com o dedo e com a S Pen.
- **Jeito de tablet** (`tablet.js`, `tablet.css`, só quando `body[data-aparelho="tablet"]`): toque de 48px, folha lateral direita em paisagem (≥1000px, fecha deslizando para a direita), dica do nome do botão ao passar a S Pen, atalhos de teclado físico ("?" mostra a lista) e atalhos do ícone no manifest (`#inicio/planejar`, `#tarefas/nova`, `#financas/lancar`). O aparelho é decidido pelo tamanho da tela, não da janela, para a tela dividida continuar tablet.

## Estrutura de telas

1. **Início (Hoje)**: painel-resumo geral, com um arranjo próprio para cada aparelho (celular, tablet e computador, em `config` "inicio-<aparelho>"), com:
   - os próximos prazos (7 dias) e as provas;
   - o card "Próximo passo";
   - as últimas notas do AVA;
   - os cadernos recentes;
   - o progresso por área.
2. **Faculdade**: painel geral e um painel por disciplina, com materiais, atividades e prazos, notas, frequência (se disponível), avisos e cadernos daquela disciplina. A calculadora de média tem o "E se eu tirar…" (só simula), e o Hoje tem o card "Quanto preciso tirar" (`listaQuantoPrecisa` em `dados-faculdade.js`).
3. **Estudos gerais**: painel com trilhas ou temas, a biblioteca filtrada, cadernos e o progresso.
4. **Substack**: painel com pautas (ideia → rascunho → revisão → publicado), rascunhos com editor de texto, referências da biblioteca ligadas a cada texto e uma meta de publicação.
5. **YouTube**: painel do canal (próximo vídeo, meta semanal, "precisa de atenção"), quadro por etapas com arrastar (ideia → pesquisa → roteiro → gravação → edição → thumb e SEO → agendado → publicado), calendário de publicação, banco de ideias com nota (potencial × esforço) e pilares de conteúdo, desempenho (médias de CTR, retenção e visualizações). Cada vídeo: ideia, roteiro em blocos com modelos e teleprompter, gravação (cenas e takes), edição (marcações), thumbnail (até 3 imagens no Storage para comparar), publicação (título final, descrição pelo modelo do canal, tags, hashtags, capítulos, comentário fixado, tudo com copiar), cortes que viram Shorts ligados ao vídeo, checklist (com itens próprios) e resultados. A IA sugere títulos, ganchos, roteiro, descrição e tags, conceitos de thumbnail e cortes, só quando a Carol pede. As datas de gravação e de publicação viram eventos do Calendário (com avisos).
6. **Biblioteca**: livros (PDF e EPUB, com o leitor estilo Kindle, abaixo) e artigos por link (extrai o texto), por PDF ou por texto colado, com tags, área, status (ler / lendo / lido / fichado), destaques e notas.
7. **Cadernos**: estantes e cadernos de escrita à mão (detalhes abaixo).
9. **Calendário**: visão de mês, semana e lista, com eventos da faculdade e eventos próprios.
10. **Pergunte à Bússola** (`#buscar`, lupa no topo de todas as telas): busca no aparelho em tudo (`js/dados-busca.js`) e "Perguntar", que manda à IA só o resumo da pergunta (`contextoDaPergunta`) e mostra a resposta com links para os itens.
11. **Trabalho** (grupo próprio no menu; detalhes em "Trabalho (o Pauta dentro da Bússola)"): Conteúdo, Aprovar, Clientes, Criar, Pautas e Relatórios.

## Organização do app (Configurações e menu)

- **Configurações em seções** (decisão da Carol, 03/11/2026; `SECOES_CONFIG` em `js/views-configuracoes.js`, `css/configuracoes.css`): índice com busca (por palavras de cada seção, sem redesenhar) e o que pede atenção (conexões que pararam, sincronização com erro, com o número na seção); cada seção é `#configuracoes/<seção>`: **Geral** (conta, aparência, menu), **Avisos**, **Rotina** (horas protegidas, ritual de leitura, plano de estudo), **Calendário** (datas especiais), **Trabalho**, **Conexões** (AVA, Lyceum, Trello e Notion das demandas), **Dados** (sincronização, cópias, backup) e **Widgets**. Endereços antigos caem na seção certa (`#configuracoes/demandas` → Conexões). No computador e no tablet deitado (≥1000 px) o índice fica ao lado; no celular, a seção abre com "← Configurações".
- **Menu pelo fluxo** (03/11/2026; `GRUPOS_PADRAO` em `js/menu.js` e a ordem de `ROTAS`): **Hoje** (Hoje, Calendário, Foco, Pergunte), **Planejar** (Tarefas e projetos, Projetos, Painel de projetos, Revisão da semana, Metas, Hábitos, Resumo da semana), **Trabalho** na ordem do fluxo (Clientes, Conteúdo, Criar, Aprovar, Pautas, Relatórios), **Estudos** (Biblioteca, Estudos gerais, Cadernos, Faculdade), **Criação** e **Vida**. Grupo sem tela não aparece. O menu arrumado à mão continua; "Voltar ao menu padrão" (Configurações → Geral) refaz só os grupos.

## Projetos com painel (03/11/2026)

- Decisão da Carol: uma aba **Projetos** (`#projetos`, grupo Planejar; `js/modelos-projeto.js`, `dados-projetos.js`, `views-projetos.js`, `eventos-projetos.js`, `css/projetos.css`) onde ela cria um projeto pelo tipo e pelo método e o app monta o painel certo.
- **Tipos e métodos** (`TIPOS` em `modelos-projeto.js`; um tipo novo é só mais um modelo): **Mentoria** (em grupo, individual), **Infoproduto** (lançamento semente, com aquecimento, relâmpago, perpétuo), **Serviço ou pacote**, **Evento ou aula ao vivo** (online, presencial), **Livro ou e-book** (capítulo por semana) e **Projeto livre** (as fases que ela escrever). Cada método tem a data principal (início da mentoria, abertura do carrinho, dia do evento, publicação…), as fases em dias contados a partir dela, as tarefas de cada fase (as que marcam datas são marcos) e a "janela" do número principal.
- **Novo projeto** (`#projetos/novo`, ou `#projetos/novo:<id>` para dar um painel a um projeto que já existe): 1) tipo, 2) método, 3) nome, data, área e as perguntas do tipo (preço, vagas, duração, meta de vendas, dias de carrinho, capítulos…), com a **prévia** das fases e das tarefas com datas (redesenhada sozinha sem tirar o foco; dá para desmarcar tarefas; o que cairia antes de hoje vai para hoje, com aviso). "Criar" grava o projeto, as tarefas de verdade (`dados.fase`, `dados.marco`, `dados.origem = 'projeto'`) e os marcos como eventos do dia inteiro no Calendário (`link` = `#projetos/<id>`). O rascunho fica em `estado.projetoNovo`.
- **Painel** (`#projetos/<id>`): farol, contagem até a data principal, fase atual, progresso e o próximo passo com "Feito"; **Números** (`kpisDoProjeto`: os do tipo, lançados por dia ou calculados das seções, com meta e barra; "+ Número" cria um próprio; gráfico dos últimos 14 dias; "Lançar os números" soma no dia) e o **ritmo** do número principal na janela (abaixo de 60% do esperado depois de 30% do tempo = Em risco, também no Painel de projetos); **Fases** (faixa que rola, a atual marcada, checklist da fase com nova tarefa já na fase); **Seções** do tipo: pessoas e funil (conversa → chamada → fechou), propostas, encontros, módulos e aulas, capítulos (com palavras) e materiais (checklist); **Aprendizados**.
- Dados em `projetos.dados` (sem migração): `{ modelo { tipo, metodo, versao }, chave, respostas, fases [{ id, nome, inicio, fim }], numeros { kpi: { dia: n } }, extras [{ id, nome, meta }], itens { secao: [...] }, eventos [ids], aprendizados }`; o `prazo` do projeto é o fim da última fase.
- Junções: o Painel de projetos e a tela do projeto em Tarefas levam ao painel ("Abrir o painel" / "Dar um painel"); metas continuam ligando a projetos. Fora por enquanto: IA montando o plano, ligação com as Finanças e páginas de venda.

## Gestão de projetos (03/11/2026)

- **Painel de projetos** (`#portfolio`, grupo Planejar; `js/dados-portfolio.js`, `views-portfolio.js`, `eventos-portfolio.js`, `css/portfolio.css`): os projetos por área (`AREAS_TAREFA`) com farol (`statusDoProjeto`): **Atrasado** (prazo passou ou tarefa vencida), **Em risco** (prazo em até 7 dias com menos de 70% feito, parado há 14 dias ou sem tarefas), **No prazo**, Pausado e Concluído; progresso, próximo passo e as metas que o projeto move. No topo, a contagem do farol. (A capacidade da semana e a área de Consultoria foram feitas e tiradas a pedido da Carol, 03/11/2026.)
- **Quadro do projeto**: na tela do projeto, "Lista | Quadro" (lembrado no aparelho, `hub.projeto.visao`): A fazer → Fazendo → Feito, com botões (o "Fazendo" é `tarefas.dados.fazendo`; Feito usa o mesmo concluir das tarefas, com Desfazer).
- **Revisão da semana** (`#revisao`): 5 passos com o número do que falta (esvaziar a entrada, resolver as atrasadas, projetos em risco, datas das clientes em 30 dias, escolher as 3 prioridades), cada um com o link da tela; as **3 prioridades da semana** (aparecem no Hoje, bloco `prioridades`) e as datas das clientes. `config` "revisao_semanal" `{ [segunda]: { passos, prioridades, feita_em } }`, guarda 12 semanas.
- **Entrada** (`#entrada`, grupo Hoje): as capturas e as demandas novas num lugar só (os mesmos cards da Caixa de entrada e das Demandas).
- **Metas ligadas a projetos**: na meta, "Pelos projetos que movem a meta (vários)" (`ligacao { tipo: 'projetos', ids }`); o progresso é a média dos projetos.
- **Modos de foco** (`js/modos.js`, no aparelho, `hub.modo`): seletor "Modo" no topo do menu e na folha "Mais": **Tudo**, **Trabalho** (Hoje, Planejar, Trabalho), **Estudo** (Hoje, Planejar, Estudos, Criação) e **Descanso** (Hoje, Vida); o Hoje esconde os cards dos outros contextos (`cardNoModo`) e mostra "Modo X ×" para voltar a tudo. O Personalizar mostra todos os cards.
- **Arquivo da Faculdade** (`config` "faculdade_arquivo" `{ arquivada, em }`; botão em Configurações → Conexões): a Faculdade sai do menu e da barra do celular, os cards dela saem do Hoje (`CARDS_DA_FACULDADE`), os prazos do AVA, do Lyceum e do calendário acadêmico param de avisar (`avisos-agendado`), e o AVA e o Lyceum param de sincronizar sozinhos (app e `sincronizar-agendado`); tudo continua em `#faculdade`, com a faixa "Tirar do arquivo".

## Cadernos (requisito importante)

Inspirados no que o GoodNotes, o Noteshelf e o Samsung Notes oferecem.

- **Tipos de caderno**:
  - caderno comum (páginas sequenciais);
  - caderno por matéria com divisórias/seções;
  - fichário (páginas soltas reordenáveis);
  - caderno de PDF (anotar por cima de slides ou artigos importados do AVA ou da Biblioteca);
  - quadro infinito (canvas sem limite, para mapas mentais);
  - planner (semanal/mensal com datas).
- **Por aparelho** (decisão da Carol, 27/10/2026): o mesmo caderno abre **à mão** no tablet, como **documento** no computador e como **notas** no celular, com troca rápida lembrada por aparelho (`dados-texto.js`, `editor-texto.js`). O texto digitado fica na página, em `tracos_json.texto` (`html` limpo + `plano`), ao lado das camadas; no tablet ele vira imagem da folha (`texto-imagem.js`, tipografia em unidades da página que caem na pauta média) e a tinta fica por cima. PDF, quadro infinito e planner são só à mão.
- **Capas**: várias cores e estilos dentro da paleta do app, com título e disciplina.
- **Tamanhos e orientação**: A4, A5, Carta e "tela do tablet"; retrato ou paisagem.
- **Modelos de folha**:
  - Básicos: em branco, pautada (estreita, média, larga), quadriculada (5 mm e 1 cm), pontilhada (dot grid), milimetrada, isométrica e hexagonal.
  - Estudo: Cornell (tópicos / anotações / resumo), mapa mental, fichamento de leitura, resumo de aula, flashcards (frente e verso), "perguntas e respostas", folha de revisão para prova, linha do tempo e tabela comparativa.
  - Organização: checklist, to-do diário, planner semanal, planner mensal, planejamento de estudos da semana, controle de leitura e quadro de entrega de trabalhos.
  - Escrita: rascunho de texto do Substack (pautada com margem para notas) e storyboard.
  - Música: pentagrama.
- O usuário pode escolher o modelo **por página** e trocar o modelo de uma página já existente.
- **Ferramentas**:
  - canetas tinteiro, esferográfica e pincel, com pressão;
  - lápis;
  - marca-texto, que fica atrás do traço;
  - borracha de traço e de área;
  - laço para selecionar, mover, redimensionar, mudar a cor, copiar e colar;
  - formas com auto-ajuste (segurar no final do traço);
  - texto digitado, imagens, adesivos simples e linhas tracejadas/pontilhadas;
  - desfazer/refazer, zoom com pinça, rolagem com dois dedos e rejeição da palma (desenhar só com `pointerType === "pen"` quando a S Pen estiver ativa, com uma opção de desenhar com o dedo);
  - o botão da S Pen alterna para a borracha, se o navegador expuser o evento (`buttons === 32`); se não expuser, use a alternância rápida pela barra.
- **Páginas**: adicionar, duplicar, reordenar, excluir com lixeira e ver as miniaturas.
- **Organização**: estantes por área, favoritos, busca por título e tag, e a ligação de um caderno a uma disciplina ou tema.
- **Exportação**: página ou caderno em PDF/PNG.
- Formato salvo: os traços ficam em JSON vetorial (pontos + pressão + ferramenta + cor), por página e **organizados em camadas**, para manter o arquivo leve e editável. A miniatura fica em PNG. O formato já nasce com camadas desde o primeiro editor, para não precisar migrar depois.

### Legibilidade da letra
- **Estabilizador**: suavização do traço com intensidade ajustável (desligado / leve / médio / forte), para tirar a tremida.
- **Melhorar letra** (não destrutivo: o traço original fica guardado e dá para voltar):
  - endireita a linha de base, uniformiza inclinação, tamanho e espaçamento entre palavras, mantendo o seu jeito de escrever;
  - intensidade ajustável;
  - aplica na seleção do laço, na página inteira ou automaticamente depois de uma pausa na escrita.
- **Alinhar à pauta**: encaixa as palavras nas linhas do modelo pautado/quadriculado.
- **Janela de zoom**: faixa ampliada embaixo da página para escrever pequeno com letra grande, que avança sozinha pela linha.
- **Converter em texto digitado** (sob demanda, na seleção do laço, usando IA) e **verificar ortografia** da letra na seleção. Só roda quando a Carol pedir.
- Ajustes da caneta: curva de pressão, espessura mínima/máxima e "caneta fina para letra pequena".

### Camadas
- Cada página tem uma camada de **Fundo** (modelo de folha ou PDF, bloqueada) e uma ou mais camadas de desenho.
- Adicionar, renomear, ocultar/mostrar, bloquear, reordenar, mudar a opacidade, mesclar e excluir camadas.
- O marca-texto pode ir para uma camada própria. O laço e a borracha agem na camada ativa (com a opção "todas as camadas").

### Recursos inspirados no GoodNotes
- **Canetas**: até 5 predefinições favoritas na barra, cores personalizadas, conta-gotas, opacidade; marca-texto com opção de linha reta.
- **Gestos**: segurar no fim do traço para linha reta ou forma perfeita; rabiscar por cima para apagar; toque com dois dedos desfaz e com três refaz.
- **Formas**: linha, seta, retângulo, círculo/elipse, triângulo e polígono, com preenchimento e tipo de linha.
- **Régua**: mover e girar com dois dedos; o traço gruda nela.
- **Fita de estudo**: cobre um trecho da página; tocar revela (para treinar memória).
- **Ponteiro laser** que some sozinho e **modo apresentação**.
- **Laço avançado**: selecionar por tipo (escrita, formas, imagens, texto), girar, mudar cor e espessura, duplicar, recortar, transformar em adesivo, capturar como imagem e converter em texto.
- **Elementos**: biblioteca de adesivos próprios (criados a partir de uma seleção) além dos simples.
- **Caixas de texto** com fonte, tamanho, cor e fundo.
- **Imagens e documentos**: inserir da galeria ou da câmera, digitalizar documento com a câmera (recorte e ajuste de perspectiva) e inserir PDF.
- **Navegação**: abas com vários cadernos abertos, índice (sumário) e marcadores, links entre páginas, para outros cadernos e para sites, rolagem vertical ou horizontal e modo leitura (sem editar).
- **Modelos próprios**: importar PDF ou imagem como modelo de folha.
- **Organização extra**: pastas e subpastas, favoritos e lixeira.
- Fora por enquanto (ideias grandes, para depois): gravação de áudio sincronizada e busca na letra no caderno inteiro.

### Parte 2 (feita em 03/11/2026)
- Motor em `js/editor-extras.js` (instalado no `EditorDeTinta` por ganchos: `extraApertar`, `extraMover`, `extraSoltar`, `extraQuadro`, `ajustarPonto`, `extraToque`, gestos da régua) e a tela em `js/editor-caderno-extras.js`; a letra em `js/tinta-letra.js` (sem DOM).
- **Letra** (painel "Letra" e barra da seleção): Melhorar (linhas e palavras pela escrita, base reta, inclinação, tamanho e espaço iguais, intensidade Leve/Média/Forte; o traço de antes fica em `traco.original`), Alinhar à pauta (`passoDaPauta`/`inicioDaPauta`), Voltar ao original, "Melhorar sozinho depois de uma pausa" (1,8 s, só as linhas em que ela acabou de escrever) e a **Janela de zoom** (faixa embaixo da página; escrever nela escreve na página e ela anda sozinha pela linha).
- **IA só quando ela pede** (seleção do laço): "Converter em texto" (trocar a letra pelo texto ou pôr embaixo, com as palavras em dúvida) e "Verificar ortografia", pela função `caderno-ia` (`netlify/lib/ia-caderno.mjs`, imagem da seleção).
- **Painel "Ver"**: Régua (dois dedos em cima dela movem e giram, grudando a cada 15°; o traço que começa na borda sai reto), fitas (cobrir de novo, tirar todas), Modo leitura (nada escreve; tocar abre links e revela fitas), Apresentar (tela cheia + laser, ‹ › trocam de página) e "Índice e marcadores".
- Ferramentas novas na barra: **Fita de estudo** (arrastar cobre; tocar revela e cobre; aberta, o × tira; `pagina.fitas`, só na tela, não sai na exportação) e **Laser** (some sozinho, não é salvo).
- **Links** (seleção → "Virar link": número da página, site ou nome de outro caderno; `pagina.links`), tocados com o dedo; **índice** com os marcadores das páginas (`pagina.marcador { titulo }`); **abas** dos últimos cadernos abertos no topo do editor (`hub.cadernos.abas`, no aparelho).
- **Digitalizar documento** (Inserir): foto da câmera → quatro cantos → recorte reto pela perspectiva (homografia) → "Clarear o papel" → imagem na página.
- Rolagem contínua entre páginas ficou de fora (o editor segue página a página).

## Leitor de livros (estilo Kindle)

- Decisão da Carol (29/10/2026): livros em PDF e EPUB na Biblioteca, lidos dentro do app com os recursos de um Kindle.
- O livro é um artigo com `fonte: 'livro'`, o arquivo em `pdf_path` (`{id}/biblioteca/<id>.pdf|epub`, até 50 MB, o limite do plano gratuito do Supabase) e os detalhes em `artigos.dados` (migração 011): `formato`, `capa` (JPEG pequeno em data URL), `posicao` (EPUB `{ capitulo, fracao }`, PDF `{ pagina }`), `pct`, `marcadores`, `zoom`/`ajuste` (PDF) e `ultima_leitura`. Título, autor e capa saem do próprio arquivo (`js/livros.js`). Depois de aberto uma vez, o arquivo fica no Cache "hub-arquivos" e lê sem internet.
- **EPUB sem biblioteca** (`js/zip.js` lê o ZIP com o `DecompressionStream`; `js/epub.js` lê OPF, sumário nav/NCX e capa): cada capítulo é copiado só com as tags seguras (nada de script, estilo, iframe, formulário, `on*` ou `javascript:`), imagens viram `blob:` e links internos navegam no livro. Páginas pelas colunas do CSS (duas lado a lado em tela larga, linha de até ~36 letras por px de fonte); ou rolando.
- **Ajustes** (no aparelho, `hub.leitor.prefs`): fonte (serifada, sem serifa, para cansaço), tamanho, espaço entre linhas, margens, justificado, fundo (como o app, claro, sépia, escuro, preto; tokens `--livro-*` em `temas.css`), brilho (véu por cima) e virar páginas × rolar. PDF: página inteira ou largura, zoom e modo noite.
- **Destaques** em 4 cores com nota, no mesmo `artigos.destaques` da Biblioteca (com `capitulo`, `inicio`, `fim` = posições no texto do capítulo): aparecem em "Destaques e notas" e vão para o fichamento. Marcadores (🔖), sumário, busca no livro todo, tempo para acabar o capítulo e o livro, toque nas bordas, deslizar (o palco tem `touch-action: pan-y` para o gesto ser do leitor), teclado.
- **Caneta no PDF**: o `EditorDeTinta` dos Cadernos por cima da página (desenhada pelo pdf.js), com cores `--tinta-livro-*` que não mudam com o tema; a tinta fica em `livro_paginas` (uma linha por página). Só a S Pen escreve (ou o dedo, se ligar); o dedo continua virando a página.
- **IA só quando ela pede** (`livro-ia`): explicar o trecho, resumo do capítulo (os dois podem ir para as notas do livro).
- Onde parou segue para os outros aparelhos (e o card "Continuar de onde parou" ganhou o tipo `livro`).

## Integração com o AVA (Moodle 5.1)

- URL base: `https://avagrad.unievangelica.edu.br`
- **Teste feito em 24/10/2026**: Moodle 5.1.7, 468 funções liberadas, login por usuário e senha. **Todos** os métodos abaixo e todas as reservas estão liberados, e o download de arquivos é permitido. Não há plugin `mod_attendance`: a frequência (e as notas oficiais) ficam no **Lyceum**.
- O serviço do app mobile está liberado, e o login do app é por usuário/senha (`typeoflogin: 1`).
- **Geração do token**: a função `ava-conectar` recebe a matrícula e a senha uma única vez, chama `POST /login/token.php` com `service=moodle_mobile_app`, guarda **só o token** (criptografado no Supabase) e descarta a senha.
- A função `ava-sincronizar` chama `/webservice/rest/server.php?wstoken=...&moodlewsrestformat=json` com estes métodos:
  - `core_webservice_get_site_info` (descobre o `userid` e as funções liberadas);
  - `core_enrol_get_users_courses` (disciplinas);
  - `core_course_get_contents` (materiais e arquivos de cada disciplina);
  - `mod_assign_get_assignments` e `mod_assign_get_submission_status` (trabalhos, prazos e status de entrega);
  - `mod_quiz_get_quizzes_by_courses` (provas e questionários online);
  - `core_calendar_get_action_events_by_timesort` e `core_calendar_get_calendar_upcoming_view` (prazos);
  - `gradereport_user_get_grade_items` (notas);
  - `mod_forum_get_forums_by_courses` e `mod_forum_get_forum_discussions` (avisos);
  - `mod_attendance_*` (frequência, só se o plugin existir; se não existir, mostre "frequência fica no Lyceum").
- Os arquivos do Moodle são baixados pela função, com `?token=` em `pluginfile.php`, e vão para o Storage do Supabase quando a Carol abrir ou fixar um material.
- A sincronização roda automaticamente ao abrir o app (se faz mais de 1h) e pelo botão "Sincronizar agora". Uma Netlify Scheduled Function roda a cada 6h.
- Se uma função vier bloqueada (`accessexception`), o app registra o bloqueio, continua com as outras e mostra no painel o que não está disponível.
- Tudo do AVA é **somente leitura**. O app nunca envia trabalho, nunca responde quiz e nunca posta no fórum.

## Lyceum (notas oficiais e frequência)

- Portal do aluno: `https://portal.unievangelica.edu.br/aluno/` (AngularJS + Ionic). Login com CPF (só números) e a senha da matrícula.
- **Investigação feita em 24/10/2026** (só arquivos públicos, sem login):
  - a página de login carrega o **Google reCAPTCHA** (`render=explicit`), mesmo que ele não apareça sempre;
  - a API fica em `${API_URL}/api/rest/...` e em caminhos como `/pessoas/...`, `/matricula/...` e `/v2/alunos/...`;
  - rotas úteis encontradas:
    - boletim e notas: `/pessoas/{codPessoa}/alunos/{codAluno}/boletim?subperiodo=`, `/pessoas/{codPessoa}/alunos/{codAluno}/disciplinasBoletim`, `/pessoas/{codPessoa}/alunos/{codAluno}/qtddNotas/{n}/ultimasNotas`, `/pessoas/alunos/{codAluno}/listaSubPeriodos`, `.../provasBoletim`;
    - frequência: `${API_URL}/api/rest/alunos/codAluno/{codAluno}/codPessoa/{codPessoa}/Frequencias`, `/pessoas/lista_detalhes_frequencia`, `/v2/alunos/{codAluno}/detalhes-faltas?ano=&codDisciplina=&codTurma=&semestre=`;
    - agenda e aulas: `/matricula/listar-agenda-diario`, `${API_URL}/api/rest/alunos/pessoa/{codPessoa}/events`, `.../dia/{diaSemana}/HorariosAula`;
    - avisos: `/pessoas/{codPessoa}/alunos/{codAluno}/avisos`;
    - login: `/login`, `/autologin?a&b`, `config-properties/login-oauth2-sso`.
- **Como o login funciona** (visto no navegador): `POST /aluno/auth` com `username` (matrícula), `password` (só codificada em base64, não é criptografia) e `recaptchaResponse` **vazio**, que é aceito. A resposta devolve o cookie de sessão `JSESSIONID` (HttpOnly, expira sem uso) e o cookie `user-data` (só informações: nome, id da pessoa, matrícula). **Não há token duradouro.**
- **Decisão da Carol (24/10/2026): sincronização automática guardando a senha do Lyceum criptografada.**
  - A função `lyceum-conectar` recebe matrícula e senha uma vez e guarda a senha criptografada (AES-256-GCM com `TOKEN_CRYPTO_KEY`) no Supabase; só as funções conseguem abrir.
  - A senha nunca volta para o front-end, nunca aparece em log e o botão "Desconectar o Lyceum" apaga tudo.
  - A cada sincronização (ao abrir o app se faz mais de 1h e na Scheduled Function de 6h), a função faz **um** login, lê notas, faltas, agenda e avisos e encerra.
  - Se o portal passar a exigir captcha ou recusar o login, a função para (sem novas tentativas), registra o motivo e o app pede para a Carol reconectar.
- **Teste feito em 24/10/2026 (10 de 12 rotas funcionando).** Caminho confirmado, igual ao do portal:
  1. `POST /aluno/auth` (login);
  2. código da pessoa = `id` do cookie `user-data`;
  3. `GET /aluno/apix/pessoas/{codPessoa}/alunos` com `X-Lyceum-Usuario: null` → `codAluno`;
  4. todos os pedidos seguintes com `X-Lyceum-Usuario: aluno: {codAluno}` e `X-Lyceum-Transacao`.
  - Todos os endereços ficam em `/aluno/apix` (`Configs.getApiServer()` = `"apix"`), inclusive os de `${API_URL}/api/rest/...`.
- **Rotas que funcionam** (base `/aluno/apix`):
  - `/pessoas/{p}/alunos/{a}/boletim`: por disciplina, `nomeDisciplina`, `turma`, `nomeDocente`, `aulasPrevistas`, `aulasMinistradas`, `media`, `situacaoMatricula`, `periodo {ano, semestre}`, `faltas[] {faltasAcumuladas, faltasPermitidas, percentualPresenca}` e `provas[] {nomeProva, ordemProva, nota, notaMaxProva, dataNota, provaOficial}`. **É a rota principal.**
  - `/pessoas/{p}/alunos/{a}/disciplinasBoletim`: disciplinas do semestre com as faltas.
  - `/pessoas/{p}/alunos/{a}/qtddNotas/5/ultimasNotas`: últimas notas lançadas.
  - `/api/rest/alunos/codAluno/{a}/codPessoa/{p}/Frequencias?page=0&size=1000`: `content[] {componenteCurricular, cargaHoraria, numeroFaltas, percentualFrequencia, aulasPrevistas, ano, semestre}`.
  - `/api/rest/alunos/{a}/pessoa/{p}/boletins`: boletim em outro formato (`aprovado`, `notaFinal`, `provas`).
  - `/pessoas/codAluno/{a}/obterDadosAcademicos`: curso, turno, série, situação. Tem dados pessoais (celular etc.): **guardar só curso, turno, série e situação**.
  - `/pessoas/{p}/alunos/{a}/avisos`: `titulo`, `descricao`, `data`, `tipo`, `lido`.
  - `/pessoas/alunos/{a}/listaSubPeriodos` e `/pessoas/cod_pessoa/{p}/cod_aluno/{a}/lista_ultimas_atividades` (vazias por enquanto).
- **Ainda sem resposta** (pedem parâmetros, HTTP 400): `/matricula/listar-agenda-diario` e `/api/rest/alunos/pessoa/{p}/events`. Resolver na Etapa 4 lendo no código do portal quais parâmetros vão (provavelmente datas). Não são essenciais: os prazos vêm do AVA.
- Reserva: importar notas e frequência por PDF/print com IA, e o contador de faltas do próprio Hub.
- **Regra**: o app nunca tenta contornar o reCAPTCHA. Se o login exigir captcha, a conexão usa a sessão que a própria Carol abre no portal.
- Tudo do Lyceum é **somente leitura**: o app nunca mexe em matrícula, financeiro, serviços ou contratos.

## Trabalho (o Pauta dentro da Bússola)

- Decisão da Carol (01/11/2026): o Pauta (Next.js + Neon na Vercel) vem para a Bússola, no padrão dela, num grupo **Trabalho** do menu. O Pauta fica no ar até ela conferir.
- **Telas** (`js/views-trabalho.js`, `eventos-trabalho.js`, `dados-trabalho.js`, `css/trabalho.css`): **Conteúdo** (`#conteudo`, semana ou lista, filtros por casa Essence / Confluir / Minha marca e por cliente, cores `--cliente-1..6`, card "O que mudou sem você" com Dar baixa, radar de buracos; `#conteudo/<id>` é a ficha da peça: status e data, texto lido do Notion, comentar com "Guardar na memória", Focar, Abrir no Criar), **Aprovar** (`#aprovar`: Com o design (prazo 5 dias, cobrança pronta) → Com você (mensagem pronta, Mandei) → Com o cliente (Ajuste / Aprovou, "cobrar?" depois de 2 dias) → Agendar (Agendei); arrastar pela alça ou botões; no celular, abas), **Clientes** (`#clientes`, `#clientes/<chave>`: saúde, números, próximas, memória de feedback, ficha do Notion sem a seção de acessos) e **Criar** (`#criar`: cliente, formato, objetivo, tema, texto com revisor ao vivo (`revisar`, regras de saúde para clientes da área), IA "Gerar", "Melhorar o gancho", "Preparar o pedido da arte", modelos por formato, rascunhos e "Criar no Notion").
- **Dados** (migração 012): `conteudos` (cópia das peças do Notion e do Trello, `unique (user_id, origem, origem_id)`; o app grava só `dados.fluxo` (`enviadoEm`, `aprovadoEm`, `agendadoEm`, `rodadas`) e `dados.mudanca.visto`), `clientes_trabalho` (`chave`, `casa` essence|confluir|minha, `dados.memoria[]`, `dados.ficha`, `dados.cor`) e `rascunhos`. Credencial e conexão próprias: `notion_trabalho` (segredo criptografado, separado do Notion só leitura da Caixa de demandas).
- **Lógica de quem faz o quê** (Carol, 02/11/2026; `etapaDaPeca`, `quadroDeAprovar` em `dados-trabalho.js`):
  - **Essence** (Notion): todos os clientes são dela. **Com você** é só o planejamento e a copy (`STATUS_DA_CAROL`: copy em desenvolvimento, legenda pendente, ajuste…) e o que está atribuído a ela no Notion (`dados.responsaveis`, campos de pessoa ou com "respons/atribu/quem" no nome, `atribuidaACarol`). O resto (design, aprovação interna, envio ao cliente, agendamento) é da gestora ou da sócia: coluna **Com a equipe**, só para acompanhar (não entra no Comece por aqui nem nos avisos).
  - **Confluir** (Trello): o caminho da arte vem dos **quadros de produção**, o da designer (posts) e o de **vídeos** (`config.videos` em Demandas), só com etiqueta de cliente dela: INFORMAÇÕES/ANOTADO = Com o design, ALTERAÇÃO = ajuste, APROVAÇÃO = Com você, APROVADO = Agendar (sai sozinho quando a peça já está no quadro do cliente, por título parecido, ou no Agendei). **Listas com nome de mês** (JANEIRO, "03 - Março"…) são o arquivo do design e nunca aparecem nem contam (`ehListaDeMes`). O **quadro do cliente** é o calendário de postagem: só "POSTS PARA APROVAÇÃO" entra no Aprovar (Com o cliente; Aprovou move para APROVADOS, Ajuste para a lista de alteração); o resto fica só no Conteúdo.
  - **Só o que está valendo** (`vigente`): data de 14 dias atrás em diante; sem data, mexida nos últimos 30 dias.
  - **Visões e filtro** (no aparelho, `hub.trabalho.filtro`): Todos, Essence, Confluir e Minha marca no topo de Conteúdo, Aprovar e Clientes, mais o botão de clientes com caixinhas por casa e os atalhos Só os meus / Todos / Nenhum. **Seus clientes** (Configurações → Trabalho, `config` "trabalho" `{ naoMeus }`): o "Só os meus", o Hoje e os avisos seguem esta lista (`pecasAtivas`; `todasAsPecas` ignora).
- **Calendários escolhidos por ela** (02/11/2026; Configurações → Trabalho → Calendários): os 8 do Pauta vêm ligados e dá para desligar (`detalhe.calendariosDesligados`; as peças do desligado saem do app na próxima cópia) e acrescentar outros que a conexão enxergue (`calendarios-buscar` usa `POST /search` de fontes de dados; `detalhe.calendariosExtras [{ banco, nome, cliente }]`, a cliente vem sugerida pelo título). Cada calendário mostra o resultado da última cópia (`detalhe.diagnostico[banco]`: peças ou o erro, ex.: conexão não ligada). As partes da sincronização são `cal:<id do banco>`. "Carol"/"Portal da Carol" são sempre Minha marca e nunca casam com outra cliente pelo primeiro nome (ex.: Carol Pessoa).
- **Quadro de vídeos na configuração antiga**: quadro com "vídeo" no nome é sempre de produção, mesmo se ficou marcado como cliente (o cliente falso some).
- **Cards**: status curto (`statusCurto`: sem o que vem entre parênteses, em até 2 linhas) e o risco como uma linha pequena com ponto, não pílula.
- **Fontes**: os 8 calendários e as 2 bases de clientes do Pauta ficam em `netlify/lib/trabalho-fontes.mjs`. Notion API `2025-09-03` (databases → data_sources). Trello: o quadro dos designers e os quadros dos clientes escolhidos em Configurações → Demandas (no quadro dos designers o cliente vem pela etiqueta e a data é o prazo do design).
- **Funções**: `trabalho` (conectar, desconectar, situacao, partes, sincronizar por parte `clientes` | `cal:<n>` | `trello`, mudar, comentar, texto, criar, ia) e `trabalho-agendado` (de hora em hora, 7h–20h em Brasília, em partes, retomando de `detalhe.proximaParte`). O app sincroniza sozinho ao abrir uma tela do Trabalho se faz mais de 1h.
- **Escrita com trava** (exceção à regra de só leitura, decidida pela Carol em 01/11/2026): no Notion só muda status, data, comentários e cria páginas nos calendários da lista (`rotaNotionPermitida`; nunca mexe na estrutura das bases nem apaga); no Trello só muda lista, data, descrição e comenta (nada é apagado). O Trello precisa da autorização `scope=read,write` (reconectar em Demandas).
- **Junções**: "Comece por aqui" + tese do dia no Hoje (dias úteis, bloco `trabalho` do Personalizar), "Focar nesta peça" leva a peça para o Foco, avisos das 7h (comece por aqui e o que mudou), 12h (artes para mandar e agendar) e 17h (o que ainda está com ela), só em dia útil (`avisosDoTrabalho` em `avisos-vida.mjs`, liga/desliga em Configurações → Avisos).
- Descartado (Carol, 03/11/2026): blocos por cliente no Organizar, intenções da semana, importar memória e rascunhos do Neon, editor de páginas do Notion.
- **Sincronização de config repetida** (02/11/2026): duas linhas de `config` com a mesma chave no mesmo envio travavam tudo ("ON CONFLICT DO UPDATE command cannot affect row a second time"). O envio agora fica com a mais nova e apaga as cópias no aparelho; as caixinhas do Trabalho gravam só no "change".
- **Service worker**: estilos e scripts vêm primeiro da rede (até 3 s, senão a cópia guardada), para a tela nunca misturar arquivo novo com antigo (foi o que tirou as cores do Com as mãos no aparelho). Se as tintas não existirem no tema carregado, o Com as mãos mostra "Falta atualizar as cores do app".
- **Papel** (Carol, 02/11/2026): o papel dos cadernos e do Com as mãos segue o app, grafite `#242424` no escuro e branco no claro (`--papel`); nada de folha marrom.

## Radar do nicho (Trabalho → Radar)

- Decisão da Carol (07/11/2026): o que está subindo em cada nicho para as próximas 2 semanas, **sem hashtag e sem áudio em alta**, só por sinais oficiais (nada de raspar o Instagram). Telas `#radar`, `#radar/<nicho>`, `#radar/novo`, `#radar/editar:<nicho>` (`js/dados-radar.js` sem DOM, `views-radar.js`, `eventos-radar.js`, `css/radar.css`; no menu entre Clientes e Conteúdo).
- **Nichos** (`config` "radar" `{ nichos: [{ id, nome, palavras (até 6), clientes }] }`): criados à mão ou pelas clientes do Trabalho (`sugerirNichos`: o nicho da ficha vira especialidade com palavras do público, "Usar" / "Criar todos").
- **Sinais** (`netlify/lib/radar.mjs`): YouTube Data API (`YOUTUBE_API_KEY` na Netlify; até 3 buscas por atualização, vídeos em português dos últimos 7 dias, ordenados por **visualizações por hora**, Short = até 3 min); Google Notícias RSS por palavra (`velocidade`: matérias em 48 h × o ritmo dos 5 dias antes); datas da saúde e campanhas do nicho em 21 dias (`datasDoNicho`). Sem a chave do YouTube, segue com o resto e avisa.
- **IA** (`radar-background`, só quando ela toca em Atualizar ou quando o radar é de antes da segunda desta semana ao abrir o nicho; o nicho vai no pedido): cruza os sinais com a pesquisa na web (`web_search`) e devolve itens com temperatura (subindo forte, subindo, data certa, assunto do momento), porquê com o sinal concreto, janela, formato, gancho, "serve para" (só clientes do nicho) e links (só `https`), as notícias em alta com o porquê e o **briefing da semana**; normas dos conselhos na saúde, nunca promete viral. Sem IA, `radarSimples` mostra os sinais (datas, termos subindo, vídeos que aceleram). O resultado fica em `config` "radar:<nicho>" (`status` lendo/pronto/erro, `gerado_em`, `fonte`, `avisos`, `itens`, `noticias`, `briefing`, `videos`, `termos`, `datas`); o app puxa a config a cada 4 s até chegar.
- **Radar 2.0** (Carol, 07/11/2026: "precisa ser atualizado sempre e me avisar a tempo de criar"):
  - **Sozinho** (`radar-agendado`, de hora em hora no minuto 31): notícias a cada 2 h das 7h às 21h (Brasília), guardadas num histórico de 14 dias (`noticias_hist`, cada uma com `primeiro_em`; a primeira leitura marca `inicio_em` e não conta como novidade); a análise com a IA às 6h30 e de novo no dia se uma notícia disparar (`disparo`: 3+ novas ou termo 2,5× acima do ritmo; no máximo a cada 6 h). A agendada chama a `radar-background` com assinatura interna (HMAC com a chave de serviço, vale 10 min; `BUSSOLA_URL_INTERNA` só nos testes).
  - **Avisos no celular** (`avisarDoRadar`, Configurações → Avisos → "Radar do nicho", `vida.radar`, respeita o silêncio, uma vez por dia cada um em `config` "radar_avisos_enviados"): notícia que disparou ("N notícias novas sobre X. Para <clientes>. Dá tempo de criar."), assunto subindo forte depois da análise e o resumo das 8h.
  - **Caixa por cliente** dentro do nicho (nicho sem cliente vira uma caixa só): "N notícias novas" desde a última vez (`config` "radar_visto" `{ "<nicho>|<cliente>": iso }`, segue entre aparelhos; "Marcar como visto"), as notícias com fonte, data e termo, e as **sugestões de conteúdo** da cliente.
  - **Sugestões no método da Carol** (`netlify/lib/metodo-essence.mjs`, resumo das skills manual-criacao-conteudo, narrativa-mckee, content-strategy-instagram, conteudo-posicionamento, voz-essence, proibicoes-essence e fala-contada, mais medo, desejo, estruturas e cuidado por especialidade): 2 ou 3 por cliente, com formato, linha editorial, estrutura de exibição, gap em uma linha, gancho, esqueleto (slides ou blocos já na fala contada), CTA, cuidado do conselho e "por que agora" com o link; usa a ficha e a memória da cliente; nunca inventa caso. "Levar para o Criar" (cliente, formato, objetivo pela linha, tema com o gap e o texto com gancho, esqueleto e CTA) e "Copiar".
  - **Exportar** (`js/radar-pdf.js`, `textoDoRadar`): PDF A4 no visual do app (cores do tema em uso), do nicho ou de uma cliente; "Copiar para o WhatsApp" (negrito do WhatsApp) e "Copiar para o Notion" (markdown).
- **Organização** (Carol, 07/11/2026): sem nicho (ou em `#radar/clientes`, "Clientes e especialidades"), a tela "Como o radar funciona" + a lista das clientes (sem as de teste) com a especialidade de cada uma (`ESPECIALIDADES`, já marcada pela ficha com `especialidadeDaCliente`); "Criar os nichos" grava a especialidade na ficha (`clientes_trabalho.dados.nicho`, que também vale para as datas da saúde) e junta as clientes nos nichos (`nichosPelasEscolhas`: cria o que falta com as palavras do público, tira quem saiu). O "Novo nicho" tem a especialidade que preenche nome e palavras. Dentro do nicho: a barra com os nichos, "Editar o nicho" e "Clientes e especialidades"; o cartão do nicho (Atualizar agora, Exportar); e as abas **Geral** (briefing e o que vai bombar), **Clientes** (com o número de novas; as caixas), **Notícias** (em alta e o histórico de 14 dias) e **Sinais**, lembradas no aparelho (`hub.radar.aba`).
- **Todas as especialidades** (Carol, 07/11/2026: "o nicho médico precisa ter todos"; `js/especialidades.js`, sem DOM, usado pelo app e pelas funções): as 55 especialidades médicas do CFM (Ginecologia e Obstetrícia em duas), as áreas de atuação que viram nicho (Neuropediatria, Hebiatria, Medicina do sono, da dor, reprodutiva, fetal, Neonatologia, Endocrinologia, Cardiologia e Oncologia pediátricas, Psiquiatria infantil, Hepatologia, Bariátrica, Coluna, Tricologia, Medicina estética, Hiperidrose, Integrativa), as outras da saúde (Odontologia e Odontopediatria, Ortodontia, Implantodontia, Halitose, Psicologia, Nutrição, Fisioterapia, Fono, Terapia ocupacional, Enfermagem, Farmácia, Biomedicina, Estética) e Marketing. Cada uma tem `re` (reconhece o nicho escrito na ficha; vale a citada primeiro e, no mesmo ponto, a mais específica: "neuropediatra" é Neuropediatria), `areas` (datas da saúde; `AREAS` de `datas-especiais.js` sai daqui), `palavras` do público e medo, desejo, estruturas e cuidado (`metodoDoNicho`). A escolha é um campo com busca (`datalist`, "Digite: neuro…", com o grupo ao lado) em "Clientes e especialidades" e no "Novo nicho"; nome fora da lista avisa. Datas novas (pesquisa de 07/11/2026): dias de 22 profissões (as fracas com "conferir"), ~50 datas da saúde (Autismo, Purple Day e Dia Latino-Americano da Epilepsia, Síndrome de Down, Paralisia cerebral, Semana do TDAH, Asma, Rim, DPOC, Doenças raras e Hanseníase por regra…) e campanhas (Janeiro Roxo, Junho da infertilidade, Outubro do TDAH).
- **Levar para o Criar**: abre o Criar com a cliente do nicho, o formato (Reels → Reels falado, Carrossel → Carrossel de conteúdo, Stories → Stories de venda, Post → Legenda) e o tema com gancho e "por que agora". "Os sinais por trás do radar" mostra os vídeos, os termos e as datas.

## Relatório de métricas (Trabalho → Relatórios)

- Decisão da Carol (02/11/2026): o mesmo modelo para todos os clientes, o da Confluir (o PPTX "Relatório de métricas · Dra. Karyne Magalhães"). Fundo verde-oliva `#4E5C2B`, títulos laranja `#E06919`, números e textos `#D9D9D9`, Open Sans (`MARCA` em `js/dados-relatorio.js`; são cores do documento, não do app). Slides: capa, Atividade do perfil (visitas ao perfil + toques em links externos em laranja), Alcance (contas alcançadas), Seguidores ("Foram +N novas contas."), Engajamento (interações com o conteúdo), Conteúdo relevante (até 3 capas com cantos arredondados) e Considerações (tópicos em negrito + texto). Mês e ano no alto à direita, nome da cliente embaixo à direita. Números no padrão brasileiro (1.194).
- Telas (`#relatorio` e `#relatorio/<cliente>:<AAAA-MM>`; `js/views-relatorio.js`, `eventos-relatorio.js`, `css/relatorio.css`): lista por mês e "Novo relatório" (cliente do Trabalho ou nome digitado, mês, padrão o mês passado); a ficha da cliente em Clientes tem o atalho "Relatório de <mês>". Editor em 4 passos: prints, números do mês (com a comparação), conteúdo relevante e considerações, com a prévia ao lado (embaixo no celular) e os botões Baixar PPTX / Baixar PDF.
- Dados: `config` "relatorio:<cliente>:<AAAA-MM>" `{ nome, mes, numeros { visitas, toques, alcance, seguidores, interacoes }, variacao, imagens [3 data URLs JPEG 600 px], consideracoes [{ titulo, texto }], slides { id: bool }, destaques [{ tema, print, x, y, w, h }], observacoes }`. Os prints ficam só na memória do aparelho enquanto a tela está aberta.
- **IA só quando ela pede**: "Ler os números com a IA" manda os prints (JPEG até 1600 px, até 12) para o Storage e chama `relatorio-ler-background` (linha em `importacoes` com `tipo = 'relatorio'`, migração 014; o app acompanha a linha e apaga depois, a função apaga os prints). A IA devolve os números que achou (nunca estima: o que não achou fica vazio), a porcentagem "vs. período anterior" do print e até 3 conteúdos em destaque com a caixa da miniatura, que viram as capas (recorte na proporção do slide) nos espaços vazios. Ela confere tudo antes de baixar. "Escrever com a IA" (`trabalho`, ação `relatorio-consideracoes`) escreve um texto por tópico só com os números conferidos, as comparações, os temas dos destaques e as observações dela (sem travessão, sem jargão).
- Comparação: com o relatório salvo do mês anterior da mesma cliente; sem ele, com a porcentagem que o print mostra.
- Arquivos no aparelho (`js/slides-arquivos.js`): o mesmo desenho (`montarSlides`, em pontos de 1200 × 675) vira canvas para a prévia e para o PDF (`pdfDeCanvases` de `exportar-caderno.js`) e XML para o PPTX (ZIP sem compressão; mestre, layout e tema do modelo dela em `modelos/relatorio/`). Fonte Open Sans em `js/vendor/fontes/` (licença OFL) para o canvas; no PPTX vai o nome da fonte (o Google Slides tem; no PowerPoint sem a fonte instalada, ele troca por uma parecida). Os textos diminuem para caber (números grandes, considerações longas).

## Gerador de pauta (Trabalho → Pautas)

- Decisão da Carol (02/11/2026): as artes prontas do Trello + a legenda, no modelo da Confluir (o PDF "DRA. KARYNE MAGALHÃES OUTUBRO"), igual para todas as clientes: só mudam o nome, o mês e os posts. Capa (fundo `#E9EDEE`, faixa branca no alto, barrinha verde `#1A9988` e laranja `#EB5600`, "Conteúdo" + nome em Raleway Bold, mês em Lato, logo da Confluir), uma página por peça ("Post - título" / "Reel - título", barrinha, "Legenda:" em negrito abrindo o texto em Raleway, artes na metade direita: uma imagem em pé ou a grade das lâminas sem espaço entre elas) e a página final igual à do modelo. Logo e página final tirados do próprio PDF (`modelos/pauta/`); Raleway e Lato em `js/vendor/fontes/` (OFL). Medidas em `js/dados-pauta.js` (do modelo 720 × 405 para 1200 × 675).
- Telas (`#pautas` e `#pautas/<cliente>:<AAAA-MM>`; `js/views-pauta.js`, `eventos-pauta.js`, `css/pauta.css`, mais a base de `css/relatorio.css`): "Nova pauta" (cliente e mês, padrão o próximo a partir do dia 15); atalho "Pauta de <mês>" na ficha da cliente. Passo 1: os cartões da cliente lidos **na hora** no Trello (`trabalho` ação `pauta-cartoes`, só leitura): quadro da designer e de vídeos pela etiqueta dela e o quadro dela, **em todas as listas abertas, inclusive as de mês** (é onde o design arquiva as artes prontas); filtro **"Em aprovação"** (padrão, decisão da Carol em 02/11/2026: é dessa lista que ela tira as artes para o cliente aprovar; APROVAÇÃO da designer e de vídeos e POSTS PARA APROVAÇÃO do quadro dela, nunca APROVADO; `listaEmAprovacao`), "De <mês>" (lista com o nome do mês ou data no mês) ou "Todos", e "Marcar todas". Passo 2: as peças marcadas, na ordem da data (sem data no fim), com ↑ ↓, tipo (Post, Carrossel, Reel, Stories, Vídeo), título (sem o nome da cliente na frente), as artes (no carrossel entram todas, na ordem do número no nome do arquivo, senão a do Trello, `ordenarLaminas`; toque liga/desliga e numera a ordem; "+" põe uma imagem do aparelho) e a legenda: **Da descrição** (o que vem depois de "Legenda:" na descrição do cartão) ou **Escrever** (à mão ou com a IA). "Escrever as N legendas que faltam com a IA" faz todas (duas por vez). Prévia ao lado e Baixar PPTX / PDF.
- Artes no slide (`gradeDasArtes`): fileiras justificadas como a pauta dela: cada fileira ocupa a largura toda da metade direita, as lâminas de uma fileira têm a mesma altura e nada é cortado; pelo menos 2 por fileira; com sobra, as de cima levam menos (7 = 3 + 4); o bloco fica centrado.
- **Posts extras** (fora do Trello; `js/pauta-importar.js`, botão "+ Post extra"): imagens viram um post (várias = carrossel); PDF ou PPTX que é uma pauta (páginas com "Legenda") vira um post por página, com o título ("Post - …"/"Reel - …", mesmo quando vem depois da legenda no PDF), a legenda e as artes da página (no PDF, as imagens desenhadas pela lista de operações do pdf.js; ícones e logos menores que 220 px ficam de fora); sem "Legenda", o arquivo todo vira um carrossel (cada página é uma lâmina). Entram no fim da pauta com o selo "Extra", e as imagens ficam na pauta (`locais`, JPEG de até 900 px).
- Artes: `trabalho` ação `pauta-anexo` (só leitura) baixa o anexo com o cabeçalho OAuth do Trello (imagem grande vem pela prévia de até 1600 px do próprio Trello; limite de 4,5 MB por resposta); vídeo vira a capa por um quadro perto de 1 s (no aparelho). As artes ficam só na memória do aparelho (vêm do Trello de novo ao reabrir); as imagens do aparelho ficam na pauta (JPEG de 1080 px).
- Legenda com a IA (`pauta-legenda-background`, linha em `importacoes` com `tipo = 'pauta'`, migração 015): até 6 artes (JPEG 1000 px, apagadas depois), a descrição do cartão, a ficha e a memória da cliente; voz da cliente, primeira frase forte, parágrafos curtos, convite no fim, sem travessão, sem hashtag, normas dos conselhos na saúde. Só quando ela pede.
- Dados: `config` "pauta:<cliente>:<AAAA-MM>" `{ nome, mes, pecas: [{ card, titulo, tipo, anexos [ids na ordem], legenda, modo descricao|ia|manual, descricao, url, lista, data, locais [{ id, src }] }] }`. Nada é escrito no Trello.
- O motor de slides é o mesmo do relatório (`js/slides-arquivos.js`: fontes por elemento, retângulos, imagens por endereço com recorte `srcRect` no PPTX).

## Caixa de demandas (Trello, Notion e mensagens)

- Decisão da Carol (28/10/2026): juntar as demandas do Trello, do Notion e das mensagens do WhatsApp numa caixa no Hoje; nada vira tarefa sem o OK dela. Gmail fica de fora.
- **Só leitura**: a Caixa de demandas nunca cria, muda ou apaga nada no Trello nem no Notion (a exceção, com trava, é o grupo Trabalho).
- **Trello**: autorização oficial (`trello.com/1/authorize`, `scope=read`, `expiration=never`) com a chave do app em `TRELLO_API_KEY` (pública) e o token da Carol guardado criptografado em `credenciais`. Entram os cartões em que ela é membro, abertos, sem "concluído" e fora de listas como "Feito"/"Concluído".
- **Notion**: conexão interna criada pela Carol (segredo colado uma vez, criptografado); ela escolhe até 8 bases. Entram as páginas editadas nos últimos 30 dias sem status de concluída.
- **WhatsApp**: não há API para conversas pessoais e os jeitos não oficiais arriscam o número, então **nunca** use bibliotecas não oficiais. Caminho: Web Share Target (Compartilhar → Bússola, só no Android) ou "Colar mensagem" (iPhone).
- Áreas das tarefas e demandas (`AREAS_TAREFA`): pessoal, **trabalho** (a agência e os clientes dela; pedido da Carol em 29/10/2026), casa, consultoria (Sensus), criação, saúde e finanças. As demandas da agência nascem em `trabalho`.
- **Do jeito da agência** (decisão da Carol, 28/10/2026): em Configurações ela escolhe o **quadro dos designers** (Confluir | @hbellinedesign, com as listas APROVAÇÃO e APROVADO) e os **quadros dos clientes dela** (médicos e saúde; os de influência ficam de fora). No quadro dos designers o cliente vem pela **etiqueta** (`etiquetaDoCliente`). Post em aprovação → demanda `aprovacao` + Web Push na hora; aprovado → `aprovado` ("Atualizar o Trello de [cliente]"); nos quadros dos clientes, a lista "Demandas" vira demanda e prazo vencido fora de Aprovados/Informações, ou quadro parado há 7 dias, vira `alinhar` (uma vez por semana). Essas três não passam pela IA e têm os botões Feito / Depois / Abrir. Notion: só páginas com "Carol" ou "Essence" (editável) em algum campo.
- **Organizar minhas demandas** (decisão da Carol, 28/10/2026; `js/dados-organizar.js`, `views-organizar.js`, `eventos-organizar.js`, `netlify/lib/ia-organizar.mjs`): a IA (ou o organizador simples, sem internet) encaixa as demandas novas e as tarefas que vieram delas nos dias de trabalho dos próximos 14 dias, com horário: aprovação primeiro, depois prazo e prioridade, o mesmo cliente junto, sem cobrir compromisso nem tarefa com hora, sem passar das horas por dia (Configurações → Demandas, com os dias de trabalho; o horário do dia é o do "Planejar meu dia"). O que a IA errar volta para o encaixe simples (`conferirOrganizacao`). O que não cabe até o prazo vai para "Sem espaço", com o primeiro dia livre e uma mensagem pronta para pedir prazo ao cliente. A proposta fica em `config` "organizar" (vale no dia), pode ser ajustada bloco a bloco e só vira tarefa (com `data`, `hora`, `dados.organizada`) no "Aceitar e pôr na agenda", com Desfazer. "Reorganizar" aparece quando já há semana organizada e chega demanda que vence em até 2 dias ou uma tarefa dela fica para trás. Opcional: montar a proposta sozinha ao abrir o app de manhã (só avisa).
- A função `demandas` (conectar, bases, escolher, trello-quadros, trello-config, sincronizar, ler, organizar) e a `demandas-agendado` (a cada 15 min) gravam em `demandas` (`status` nova / aceita / descartada, `mudou` quando a origem muda depois de aceita). A IA analisa até 15 itens novos por leitura; o resto fica com a sugestão simples (`js/dados-demandas.js`) e a IA completa na próxima.

- **Colar demandas** (decisão da Carol, 05/11/2026; `js/dados-colar.js`, `views-colar.js`, `eventos-colar.js`, `css/colar.css`): no card Caixa de entrada (Hoje e Entrada), ela cola uma mensagem, e-mail ou lista (até 8.000 letras, ou dita) e "Organizar em tarefas" separa cada pedido numa tarefa: a IA (`capturar` com `modo: 'demandas'`, título com verbo, área, cliente, prazo e hora só se o texto disser, tempo estimado, prioridade e o trecho de onde saiu) ou, sem internet, "Separar sem IA" (`separarSimples`: uma por linha ou por ";", sem cumprimento nem abertura, datas e horas pelo `lerTarefaRapida`). O app distribui nos próximos dias de trabalho (`distribuir`, o mesmo encaixe do Organizar: `montarEntradaSemana` com compromissos, horas protegidas, almoço e horas por dia; prazo e urgência primeiro, mesma cliente junto; sem prazo também ganha dia; o que não cabe até o prazo vai para o primeiro dia livre com a mensagem pedindo prazo). Na prévia ela muda título, dia, hora, tempo, área e prioridade, desmarca o que não quer e marca "Pôr no calendário" (vem marcado quando o texto diz a hora; "Pôr todas no calendário"). "Criar as tarefas" grava `tarefas` (`dados.origem = 'colar'`, `minutos`, `quem`, o trecho nas notas) e, marcado, um evento `pessoal` no Calendário (com hora e a duração, ou dia inteiro; `link` `#tarefas`, `tarefas.dados.evento_id`), com Desfazer.

## Posso comprar? (Finanças)

- Decisão da Carol (29/10/2026): na aba Mês das Finanças (e no "Pergunte à Bússola", com "posso comprar…"), ela escreve "tênis 400" ou "celular 2400 em 6x" e o app responde na hora, sem IA e sem internet (`js/dados-comprar.js`: `lerDesejo`, `avaliarCompra`): **Cabe / Aperta / Não cabe**, quanto sobra livre até o fim do mês e por dia, o peso das parcelas nos próximos meses (somado às já marcadas), em quantos dias a compra atrasa cada caixinha com prazo e se uma recompensa dos pontos cobre o valor.
- Botões: **Comprei** (lança o gasto, parcelado se for o caso), **Esperar 48h** (guarda em `config` "desejos" `{ lista: [{ id, descricao, valor, parcelas, criado_em, lembrar_em, decidido }] }`; passado o tempo, o card Finanças do Hoje pergunta "ainda quer?") e **Deixa para lá** (`decidido: 'deixei'`, soma no "deixou de gastar").
- **Livre hoje** (`livreHoje`): a parte de hoje do livre do mês menos o que já saiu hoje; aparece no card do livre, no card Finanças do Hoje e no widget (`livreHoje`, `gastoHoje`).

## Horas protegidas e Dia leve

- **Horas protegidas** (decisão da Carol, 29/10/2026; `js/dados-protegidos.js`, card em Configurações): blocos da semana (`config` "protegidos" `{ lista: [{ id, nome, emoji, dias, inicio, fim }] }`) que nada invade. Entram como ocupados no organizador de demandas (`montarEntradaSemana`, 14 dias) e como compromissos no "Planejar meu dia" (`montarEntrada`), então nem a IA nem o encaixe simples passam por cima; o que não cabe vai para "Sem espaço" com a mensagem pronta. Sugestões prontas (Academia, Descanso, Noite sem trabalho). O almoço continua vindo do horário do dia.
- **Dia leve** (`js/dados-dialeve.js`, botão no Hoje ao lado de Personalizar): "hoje estou mal" encolhe o Hoje em vez de esconder tudo. As tarefas de hoje sem hora (e sem prazo de demanda até amanhã) vão para amanhã (com Desfazer), e o Hoje mostra só: os inegociáveis (compromissos e tarefas com hora, prazos de hoje e amanhã, contas de hoje), um passo pequeno no lugar do Próximo passo, os hábitos na versão mínima, a Agenda e as Demandas. Fica em `config` "dia_leve" `{ data, movidas, historico }`; o `historico` alimenta "Padrões que você não vê". "Voltar ao dia normal" desliga sem mexer nas tarefas movidas.

## Ritual de leitura e Retrospectiva do mês

- **Ritual de leitura** (decisão da Carol, 29/10/2026; `js/dados-leitura.js`): meta de minutos por dia (Configurações → Ritual de leitura; `config` "leitura" `{ metaMin, dias: { 'AAAA-MM-DD': minutos } }`). O leitor soma os minutos com o livro na tela (tick de 30 s, pausa quando a aba some ou depois de 10 min sem virar página; `registrarLeitura` em `eventos-rituais.js`) e guarda o total por livro em `artigos.dados.minutos`. Card "Leitura de hoje" no Hoje com um livro só (o que está lendo com leitura mais recente, senão o primeiro da fila), minutos de hoje, sequência sem culpa (uma folga por semana) e "cabe antes de <compromisso> às <hora>". Ao chegar ao fim do livro, a tela "Terminou!" (minutos, destaques, marcar como lido, fichar, escolher o próximo). Widget Leituras mostra minutos de hoje × meta e a sequência.
- **Retrospectiva do mês** (`#retrospectiva` ou `#retrospectiva/AAAA-MM`; `js/dados-retrospectiva.js`): nos 3 últimos dias do mês (ou nos 4 primeiros do seguinte, se ainda não fez) aparece "Fechar <mês> · 10 min" no card Sua semana e no Resumo. A tela mostra os números do mês (foco, leitura, hábitos, tarefas feitas, dinheiro, humor, dias leves, publicações), três perguntas (funcionou, pesou, largo) e três intenções que viram metas com prazo no fim do mês seguinte (`metas.dados.origem = 'retrospectiva'`). Fica em `config` "retrospectivas" `{ lista }`; dá para refazer (as metas ficam).

## Fichamento pelos destaques e Padrões que você não vê

- **Fichamento pelos destaques** (29/10/2026): na aba Fichamento de um livro ou artigo, "Montar com os destaques" vira cada destaque um trecho (`artigos.fichamento.trechos: [{ destaque_id, citacao, onde, nota, minha }]`) com a citação, de onde veio, a nota e **uma linha sua**; destaques novos entram com "Trazer os novos"; o destaque ganha o selo "no fichamento". "Resumir as ideias com a IA" (`livro-ia` resumir, só quando ela pede) acrescenta em "Ideias principais"; "Levar para o Substack" cria uma pauta com o fichamento e a referência; "Virar ideia de vídeo" cria um vídeo em ideia (`detalhes.origem = 'fichamento'`). A referência vem pronta (SOBRENOME, Nome. Título. ano) e o "Copiar fichamento" inclui os trechos.
- **Padrões que você não vê** (`js/dados-padroes.js`): nas últimas 8 semanas, séries diárias (humor, energia, foco, leitura, gasto, hábitos, dia leve) viram achados só com 4+ dias de cada lado e diferença sensível: humor × leitura, humor × foco, foco × energia, humor × hábitos, dia seguinte ao dia leve, melhor dia de foco, gasto no fim de semana, gasto nos dias difíceis. Card no Hoje (2 achados) e no Resumo (6); "Não faz sentido" guarda em `config` "padroes" `{ dispensados }` (com Desfazer). Nada de IA.

## Meu cantinho (descanso)

- Decisão da Carol (29/10/2026): um hub de **descanso** dentro da Bússola (`#cantinho`, grupo Vida), sem trabalho, sem dinheiro, sem tarefa. Visual próprio em `css/cantinho.css` ("a noite da Bússola"; pedido da Carol em 29/10/2026: o grafite escuro, não o marrom quente): grafite escuro pintado no `body` inteiro (nunca só na área do conteúdo, senão aparecem faixas nas laterais), uma luz bege bem leve no alto, nuvens quase imperceptíveis e um grão leve de papel (`::after`), a lua crescente em bege (disco com máscara radial e `drop-shadow`, sem disco escuro) ao lado da hora, estrelas de quatro pontas (a da marca, num SVG em data URL) e cards em vidro translúcido (`--ct-*`), mas com a saudação do Hoje ("Boa noite, Carol." + uma linha do momento), a tipografia, os cantos (16/12), os selos e os botões do app; com "reduzir transparência" ou o Vidro desligado, os cards ficam opacos. O campo da hora de acordar é um número grande nosso com o `input type=time` invisível por cima (toque abre o seletor nativo) e botões −/+ 15 min.
- **Entrada**: relógio, "a pausa que cabe agora" (olha o próximo evento ou tarefa com hora de hoje; o nome de tarefa nunca aparece, porque pode ser trabalho, só o horário livre), água (hábito "Beber água"), leitura, hora de deitar, frase do dia e seis cantos em 3×2 (Pausas, Dormir, Cuidar de mim, Ler devagar, Pessoas, Desejos; Sons ficam dentro de Pausas e Dormir, e nada de "em breve" na grade). **Dormir** (`#cantinho/dormir`): hora de acordar → horas de deitar por ciclos de 90 min (+15 para adormecer; `horasDeDeitar`), "se deitar agora", contagem para chegar bem (café −8h, jantar −3h, trabalho −1h, telas −30 min), sons (os do Foco, gerados no aparelho, somem em 30 min) e "acordei no meio da noite". **Pausas** (`#cantinho/pausas`): respirar 2 min (4‑7‑8), alongar 5 (passos de 1 min), cochilo 20, sair 10, esvaziar a cabeça (vira tarefa de amanhã, área pessoal, `dados.origem = 'cantinho'`) e o lembrete de parar a cada 90 min com o app aberto (7h–22h). **Mesinha** (`#cantinho/mesinha`): relógio de cabeceira, escurece depois de 1 min, tons quentes à noite, tela acesa, dois toques saem; `body.modo-mesinha` esconde menus, "+", barra do foco e avisos.
- Estado em `config` "cantinho" `{ acordar, deitar, lembrete, lembreteParar, mesinhaAuto, som, ultimaPausa, pausas[] }` (`js/dados-cantinho.js`). O aviso por push "Hora de desligar" sai 30 min antes de `deitar` (`avisos-vida.mjs`, único que passa pelo horário de silêncio).
- **Cuidar de mim** (`#cantinho/cuidar`, parte 2; `js/dados-cuidar.js`, `views-cuidar.js`, `eventos-cuidar.js`; `config` "cuidar" `{ remedios, consultas, exames, pele }`): água pelo hábito "Beber água" (copos tocáveis; cria o hábito se não existir); remédios e vitaminas com horários e dias (`tomados` por dia, push "Hora de <nome>" na hora marcada, que passa pelo silêncio, em `avisos-vida.mjs`); consultas (viram evento pessoal no Calendário, `evento_id`; push de manhã hoje e amanhã, com "levar"); exames de rotina (a cada N meses, "Fiz hoje", avisa 30 dias antes); rotina de pele (passos de manhã e noite com dias; `feitos` por dia); **ciclo só no aparelho** (`localStorage` `hub.ciclo` `{ inicio, duracao }`, nunca vai para o Supabase; dia, fase, próximo e TPM ~5 dias antes).
- **Lista de desejos** (`#cantinho/desejos`; `js/dados-desejos.js`; `config` "lista_desejos" `{ lista }`): sem preço e separada do "Esperar 48h" das Finanças; "Consegui" e "Deixei para lá", com "esperando há N dias".
- **Pessoas** (`#cantinho/pessoas`; `js/dados-pessoas.js`; `config` "pessoas" `{ lista }`): aniversário (DD/MM ou DD/MM/AAAA, próximo com idade), o que gosta, ideias de presente e "me lembrar de falar" a cada N dias (`ultimoContato`, "Falei hoje"); push de manhã no aniversário e na véspera.
- **Fechar o dia** (`#cantinho/fechar`, parte 3; `js/dados-fechar.js`, `views-fechar.js`, ações `fd-` em `eventos-cuidar.js`): 60 segundos à noite: humor (a mesma escala `HUMORES` do "Como estou hoje"), uma coisa boa, uma linha e "o que fica para amanhã" (vira tarefa de amanhã, área pessoal, `dados.origem = 'cantinho'`, uma só por fechamento). Grava na **mesma linha do diário** (`diario.humor`, `diario.texto`, `diario.dados.fechar = { bom, amanha, fechado_em, tarefa_id }`), então Padrões e Retrospectiva enxergam o humor. "O dia em números" só conta o que é dela (pausas, água, leitura, hábitos, tarefas feitas fora de trabalho e consultoria). Na entrada: botão "Fechar o dia" no topo até fechar; a partir das 19h a faixa da pausa vira a do fechamento; depois, a pílula "dia fechado · ver o mês".
- **Diário do mês** (`#cantinho/diario`; `estado.mesDiario`): o mês em rostinhos (grade de 7 colunas, hoje em destaque, dias fechados com borda), média do humor, dias fechados e com uma linha, e as linhas do mês (coisa boa + linha), do mais recente ao mais antigo. Sem Spotify (decisão da Carol, 29/10/2026).
- **O roteiro do cantinho termina aqui** (decisão da Carol, 29/10/2026). Fora: Casa, listas de mercado, Informações rápidas e Spotify.
- **Com as mãos** (decisão da Carol, 02/11/2026; `#cantinho/maos` e `#cantinho/maos:<tipo>[:<id>]`; `js/dados-maos.js`, `views-maos.js`, `eventos-maos.js`, `css/maos.css`; tabela `maos`, migração 013): canto da grade no lugar de Desejos (que foi para dentro de Pessoas) e um card na Mesinha. **Colorir** (11 desenhos feitos no app em SVG: 3 mandalas, flor, folhagem, xícara, janela, casinha, lua, favos e triângulos; toque na cor e na parte, `dados.cores { area: n }` com 16 tintas `--pinta-1..16`, Desfazer), **Desenhar** (ideia do dia, passo a passo de gato, folha, xícara, casinha e lua com a guia clarinha na folha, riscos para cobrir), **Escrever à mão** (pautada, pontilhada ou lisa), **Caligrafia** (cursiva, maiúsculas, letra de forma, frases, seu nome), **Crochê** (contador grande de carreiras e pontos, linha, agulha, receita, meta, foto pequena em data URL) e **Outras ideias** (lista com sugestões e cronômetro opcional). **Meus modelos** (`js/maos-modelos.js`, `config` "maos_modelo:<id>" `{ nome, imagem, largura, altura }`): foto, imagem ou PDF (1ª página) viram modelo com "Limpar o fundo" (limiar automático de Otsu ajustável), Girar e nome; um desenho da folha vira modelo em "Guardar como modelo". O PNG guarda só os traços (transparente no resto) e ganha a cor do tema na tela. Colorir um modelo seu é com balde (`criarPintura`: preenchimento por áreas fechadas, "Fechar falhinhas" engrossa os traços de 0 a 3 px; guarda só os toques `dados.toques [[x, y, tinta]]` e a miniatura); para Desenhar ele vira risco clarinho para cobrir. **Pintar à mão** (02/11/2026; `js/maos-pintar.js`): em qualquer desenho de colorir há "Preencher | Pintar à mão": lápis de cor e giz (com granulado), pincel macio, marca-texto e borracha, 16 cores, três espessuras, pressão da S Pen, dedo opcional (desligado, o dedo dá zoom com pinça). "Não sai da linha" recorta o traço na área onde começou (mapa das partes do SVG ou a área fechada do balde). Camadas: preenchimento, pintura à mão, contornos por cima. Traços em `dados.mao [{ f, n, t, area, p }]`; desfazer/refazer únicos para preencher e pintar (`dados.acoes`). A versão mais nova fica em `js/maos-memoria.js` (a tela e as ações leem dali, para um redesenho no meio da pintura não voltar um traço). As folhas usam o `EditorDeTinta` dos Cadernos (traços em `dados.pagina`, miniatura em `dados.miniatura`), com o papel do tema e o fundo (risco, guia, linhas) como imagem; o editor não é refeito quando a tela redesenha. Como toda folha do Com as mãos tem imagem de fundo, o editor fica com `prefixoFixo = '--tinta-'` (senão ele trocaria a cor escolhida pela tinta de impressão dos PDFs). Sem meta nem pontos; a tela fica acesa enquanto ela faz.

## Calendário da faculdade (requisito importante)

- Fontes:
  1. eventos do AVA (prazos de tarefas, quizzes, eventos de curso e eventos do site/instituição) pela API;
  2. a exportação de calendário do Moodle (link .ics em `/calendar/export.php`), como reserva;
  3. o calendário acadêmico da UniEVANGÉLICA (provas, feriados, início e fim do semestre), importado de PDF ou de uma página com a ajuda da IA e revisado pela Carol antes de salvar;
  4. eventos que a Carol cria à mão (provas avisadas em sala, apresentações).
- Cada evento tem: tipo (prova, trabalho, atividade, aula, feriado, pessoal), disciplina, data/hora, status (pendente / entregue / atrasado, vindo do AVA) e um link para o AVA.
- **Avisos**: contagem regressiva no Início e destaque vermelho para atrasados, laranja para menos de 48h e bege para a semana. Notificações do PWA 3 dias antes, 1 dia antes e no dia, com horário configurável. Como o PWA fechado não dispara avisos sozinho no Android, elas chegam por **Web Push**: a Scheduled Function verifica os prazos e envia o push (chaves VAPID).
- **Avisos do dia a dia** (28/10/2026, `netlify/lib/avisos-vida.mjs`): resumo da manhã (até 4h depois do horário), contas fixas e faturas que vencem hoje e hábitos que faltam, cada um com liga/desliga e horário, mais um horário de silêncio. A função `avisos-agendado` roda a cada 15 minutos; cada aviso sai uma vez por dia (marcas em `config` "avisos_vida_enviados"). No iPhone, só com o app adicionado à Tela de Início pelo Safari (iOS 16.4+); a tela de Configurações mostra o passo a passo.
- **Datas especiais** (decisão da Carol, 02/11/2026; `js/datas-especiais.js`, usado pelo app e pelos avisos): o Calendário mostra, calculado todo ano (nada vai para o banco): **feriados com o nome** (nacionais, inclusive os móveis pela Páscoa: Carnaval, Cinzas, Sexta-feira Santa, Páscoa, Corpus Christi; pontos facultativos marcados; Goiás: 26/07 e 28/10; Anápolis: Sant'Ana 26/07 e aniversário da cidade 31/07), **dias das profissões** (do médico, do dentista, do ginecologista…), **datas da saúde** (mundiais e nacionais, com as regras do Dia das Mães, dos Pais, da Visão e do Sono) e as **campanhas do mês** (Outubro Rosa…; no dia 1º). Pesquisa feita em 02/11/2026 nas leis e nos conselhos; as datas em que as fontes divergem levam "Confira antes de postar". Cada data tem áreas (`AREAS`); o nicho da cliente (`clientes_trabalho.dados.nicho`) vira áreas (`areasDoNicho`; sem nicho, "Dr./Dra." conta como medicina) e a folha da data mostra "Serve para" com as clientes. **Aniversários** das Pessoas (Meu cantinho) também aparecem, com a idade. Tudo isso entra só na tela do Calendário (`eventosEspeciais` em `views-calendario.js`, tipos `comemorativa`, `aniversario`, `facultativo`), nunca nos prazos do Hoje nem no plano de estudo. Configurações → Calendário (`views-datas.js`, `eventos-datas.js`, `config` "datas_especiais"): liga/desliga cada grupo, "Só as datas das áreas das minhas clientes", aviso e antecedência (padrão 15 dias) e a lista do ano para conferir. Conteúdo (Trabalho) tem o card "Datas que vêm aí" (30 dias, só as das clientes). Avisos (`avisosDeDatas` em `avisos-vida.mjs`, no horário da manhã): as datas das clientes N dias antes e no dia, e o feriado na véspera.
- **Plano de estudo automático para provas**: ao surgir uma prova, o app sugere sessões de revisão nos dias anteriores, já com os cadernos e as leituras daquela disciplina.
- (Descartado pela Carol em 03/11/2026: o link .ics para o Google Agenda, a agenda do Lyceum e as sobras do Pauta.)

## Questões (fora do app)

- Decisão da Carol (01/11/2026): a faculdade está acabando e o gerador de questões saiu do Bússola: tela, gerador, simulados, revisão espaçada, as funções `questoes-corrigir` e `ia-questoes` e todos os atalhos "Gerar questões". As tabelas `questoes`, `respostas`, `revisoes` e `simulados` ficam guardadas no Supabase, mas saíram de `js/tabelas.js` (o app não sincroniza nem faz backup delas).

## Modelo de dados (Supabase)

Tabelas:
- `areas`
- `disciplinas` (`ava_course_id`)
- `materiais`
- `eventos`
- `notas_ava`
- `artigos`
- `cadernos`
- `secoes`
- `paginas` (`modelo_folha`, `tracos_json`, `miniatura_url`)
- `pautas_substack`
- `videos` (YouTube)
- `config` (tema, horários de aviso, token do AVA criptografado)
- `demandas` (migração 010): Caixa de demandas
- `conteudos`, `clientes_trabalho` e `rascunhos` (migração 012): grupo Trabalho
- `maos` (migração 013): Com as mãos (colorir, desenhos, escrita, caligrafia, crochê, ideias)
- `importacoes` ganhou o tipo `relatorio` (migração 014): leitura dos prints do relatório de métricas, e o tipo `pauta` (migração 015): legenda da pauta pela IA
- `livro_paginas` (migração 011): tinta da caneta por cima das páginas dos livros em PDF; a 011 também cria `artigos.dados`
- áreas de vida (migração 009): `projetos`, `tarefas`, `habitos`, `habito_registros`, `diario`, `saude`, `clientes`, `consultoria`, `financas`, `casa`, `metas`, `lazer`, cada uma com um campo `dados` (jsonb) para os detalhes

Todas as tabelas usam RLS ligado ao usuário da Carol.

## Widgets do iPhone e do Mac (Scriptable)

- Um script só (`scriptable/bussola-widget.js`, sem segredo nenhum) para todos os widgets: cada widget diz qual é no campo **Parâmetro** do Scriptable (vazio = Hoje nas cores da Bússola; o nome de uma área também vale). Estilo vidro (decisão da Carol, 28/10/2026): degradê da paleta, cartões translúcidos com borda clara, números em fonte arredondada, anéis e barras de progresso e SF Symbols. Pequeno, médio, grande e os da Tela Bloqueada. No Mac mini, pelos "widgets do iPhone" do macOS Sonoma.
- Em Configurações → Widgets do iPhone ela monta os widgets (config "widgets": `parametro`, `nome`, `area`, `paleta`, `modo`, `cores` próprias) com prévia clara e escura. Áreas, paletas (Bússola, Areia, Grafite, Sálvia, Azul-noite, Rosa queimado e cores próprias) e contraste ficam em `js/dados-widgets.js` (texto e suave ≥ 4,5:1, destaque ≥ 3:1; nas cores próprias o texto é trocado se não der contraste).
- Acesso por um **código do widget**: aparece uma vez, o app guarda só o SHA-256 em `config` "widget"; gerar outro desliga o anterior. A função `widget` (GET, `Authorization: Bearer <código>`, `?w=<parâmetro>`) é só leitura e devolve só o resumo da área.

## Continuar em outro aparelho

- Decisão da Carol (28/10/2026): a sessão de foco segue de um aparelho para outro, e o "continuar de onde parei" vale para caderno, leitura, simulado, rascunho do Substack e roteiro do YouTube.
- Cada aparelho tem um código sorteado no navegador (`js/aparelho.js`, `hub.aparelho-id`) e um tipo (celular, tablet, computador) que dá o nome nas mensagens ("no computador", "no outro celular").
- **Foco** (`js/foco.js`): a sessão vai para `config` "foco_ativo" (`{ sessao, versao, por, porTipo }`, versão que só cresce); com sessão aberta o app puxa só a tabela `config` a cada 20 s (1 min sem sessão) e ao voltar para o app (`puxarTabela`). A sessão tem `dono`: só ele toca o sino, vibra, mantém a tela acesa e o som ambiente, e publica o fim de fase automático (antes confere a nuvem, para um aparelho que dormiu não tomar a sessão de volta). "Continuar aqui" passa o dono; "Só acompanhar" fica lembrado no aparelho. O registro em `sessoes_foco` tem id fixo (sessão + ciclo), então dois aparelhos nunca contam o mesmo foco em dobro.
- **Onde parei** (`js/continuar.js`): uma linha por tipo em `config` "continuar-<tipo>" (`id`, `titulo`, `rota`, `detalhe`, `pagina_id`/`pagina`, `posicao`, `aparelho`, `tipoAparelho`, `quando`), gravada a cada ~8 s e ao sair do app. O card "Continuar de onde parou" do Hoje mostra até 3 lugares de outro aparelho com menos de 6h; Dispensar fica no aparelho; nada abre sozinho. Salvar essas chaves não redesenha a tela (`main.js`).

## Foco acompanhado (04/11/2026)

- Decisão da Carol: o Foco (`#foco`) acompanha a sessão, sem cobrar (`js/foco-acompanhado.js`, ditado em `js/ditado.js`, IA em `foco-ia` + `netlify/lib/ia-foco.mjs`, só quando ela pede).
- **Antes**: "O que você vai fazer?", ligar a uma tarefa de hoje (opcional) e os passos pequenos, um por linha: "Quebrar em passos com a IA", "Sugerir sem IA" (`passosSimples`, pelo tipo: ler, escrever, organizar, gravar) ou falar. "Focar nesta tarefa" (na folha da tarefa) começa já com o próximo passo guardado nela.
- **No meio**: o palco mostra "Agora · 2 de 3" com "✓ Feito"; na metade de um foco de 10 min ou mais, "Como está?" com **Seguindo** ou **Travei**. Travei: o próximo passo pequeno (editável, "Pedir um passo à IA", falar) e "Pausa de 2 min e volto" (pausa com respiração e volta sozinha) ou "Voltar ao foco".
- **No fim** de cada foco (e ao encerrar com tempo contado): "O que ficou pronto?" e o próximo passo. Com tarefa ligada, vai para ela (`notas` ganha "✓ dd/mm: …" e `dados.proximo_passo`, que aparece na lista como "Próximo: …"); sem tarefa, o próximo passo pode virar tarefa de hoje (`dados.origem = 'foco'`).
- Na sessão (`config` "foco_ativo", segue entre aparelhos): `tarefa_id`, `passos [{ t, feito }]`, `checkin { ciclo }`, `respiro`, `fim`, `feitos`. O fechamento de uma sessão encerrada fica só no aparelho (`hub.foco.fim`, 12 h). Tudo tem "Pular", e a chave "Foco acompanhado" nos Ajustes do foco (`foco.acompanhar`) desliga as perguntas.

## Backup automático

- A `backup-agendado` (todo dia às 06:00 UTC, 3h em Brasília) e a `backup` (listar e "Fazer uma cópia agora") gravam em `{id}/backups/bussola-AAAA-MM-DD.json.gz` no Storage, no mesmo formato do "Exportar backup" (`app: 'hub-estudos'`). Entram as tabelas de `js/tabelas.js` (a mesma lista do app), inclusive o que está na lixeira; nunca `credenciais`, `conexoes`, `assinaturas_push`.
- Sem mudança desde a última cópia, não faz outra. Ficam as 7 mais novas e a primeira de cada semana até 8 semanas (`js/dados-backup.js`).
- Restaurar acontece no app: "Só o que sumiu" (padrão: volta o que não está no aparelho ou foi para a lixeira) ou "Tudo como estava na cópia".

## Variáveis de ambiente (Netlify)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (somente nas funções)
- `ANTHROPIC_API_KEY`
- `AVA_BASE_URL`
- `TOKEN_CRYPTO_KEY`
- `VAPID_PUBLIC_KEY` (pode ir para o front-end; é pública)
- `VAPID_PRIVATE_KEY` (somente nas funções)
- `TRELLO_API_KEY` (chave do app no Trello; pública, vai para o front-end pelo `config-publica`)
- `YOUTUBE_API_KEY` (YouTube Data API v3, só nas funções; Radar do nicho)
