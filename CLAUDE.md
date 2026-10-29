# Bússola (antigo Hub de Estudos da Carol)

App pessoal de vida, rotina e estudos (uso exclusivo da Carol), instalável como PWA no Galaxy Tab S10 Lite (S Pen) e usado também no computador e no celular.

Áreas do app:
- **Faculdade**: UniEVANGÉLICA, integrada ao AVA (Moodle).
- **Estudos gerais**.
- **Substack**.
- **YouTube** (planejamento do canal).
- **Cadernos** com escrita à mão.
- **Gerador de questões** com IA.
- **Calendário**.
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
| IA | API da Anthropic (modelo `claude-sonnet-5-5`) com a ferramenta de web search, chamada só pelas funções (`ia-background`, que gera questões e lê PDFs da Biblioteca, `questoes-corrigir`, `calendario-ler-background`, que lê o calendário acadêmico, `youtube-ia`, `planejar-dia`, que monta os blocos do "Planejar meu dia", `demandas`, que sugere prazo, tempo e prioridade das demandas e organiza a semana com elas, `perguntar`, que responde o "Pergunte à Bússola", `capturar`, que separa a fala da captura por voz em itens, e `livro-ia`, que explica um trecho e resume um capítulo no leitor de livros) |
| AVA | API de web services do Moodle 5.1 (Open LMS) da UniEVANGÉLICA |

## Visual

A base é a identidade da Central de Conteúdo.

- **Tema escuro (padrão da Central)**: fundo grafite neutro (`#191919`, escolhido pela Carol em 27/10/2026 no lugar do marrom `#17110D`, que cansava), cards em grafite um pouco mais claro (`#242424`), destaque bege/areia (`#E8D3BF`) e texto creme.
- **Tema claro (novo)**: fundo cinza claro neutro (`#F1F1F1`, no lugar do creme `#F5EEE5`), cards brancos, texto marrom-café (`#2B1E16`) e o mesmo bege como destaque, com contraste mínimo AA.
- Contraste revisado em 27/10/2026: texto principal ~13:1 (não no máximo, para não cansar), campos com borda de 3:1 (`--cor-borda-campo`), cards um pouco mais claros que o fundo no escuro. Linhas (opção B, escolhida pela Carol): cards e divisórias com `--cor-linha` bem suave e relevo pela sombra (`--sombra-card`); campos preenchidos com a linha de baixo em 3:1; botões, chips e controles mantêm `--cor-borda`.
- Bege no escuro em dois papéis (opção C, escolhida pela Carol em 27/10/2026): superfícies grandes (botão principal, "+", Próximo passo, aba ativa) usam `--cor-preenchido` (tom quente escuro) com `--cor-sobre-preenchido` (creme); detalhes pequenos (barras, bolinhas, dia de hoje) usam `--cor-destaque` (bege apagado). No claro, `--cor-preenchido` é o próprio bege.
- Alternância entre **claro, escuro e automático** (segue o sistema), com a escolha salva no aparelho.
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
   - revisões de questões pendentes;
   - as últimas notas do AVA;
   - os cadernos recentes;
   - o progresso por área.
2. **Faculdade**: painel geral e um painel por disciplina, com materiais, atividades e prazos, notas, frequência (se disponível), avisos, cadernos e questões daquela disciplina. A calculadora de média tem o "E se eu tirar…" (só simula), e o Hoje tem o card "Quanto preciso tirar" (`listaQuantoPrecisa` em `dados-faculdade.js`).
3. **Estudos gerais**: painel com trilhas ou temas, a biblioteca filtrada, cadernos, questões e o progresso.
4. **Substack**: painel com pautas (ideia → rascunho → revisão → publicado), rascunhos com editor de texto, referências da biblioteca ligadas a cada texto e uma meta de publicação.
5. **YouTube**: painel do canal (próximo vídeo, meta semanal, "precisa de atenção"), quadro por etapas com arrastar (ideia → pesquisa → roteiro → gravação → edição → thumb e SEO → agendado → publicado), calendário de publicação, banco de ideias com nota (potencial × esforço) e pilares de conteúdo, desempenho (médias de CTR, retenção e visualizações). Cada vídeo: ideia, roteiro em blocos com modelos e teleprompter, gravação (cenas e takes), edição (marcações), thumbnail (até 3 imagens no Storage para comparar), publicação (título final, descrição pelo modelo do canal, tags, hashtags, capítulos, comentário fixado, tudo com copiar), cortes que viram Shorts ligados ao vídeo, checklist (com itens próprios) e resultados. A IA sugere títulos, ganchos, roteiro, descrição e tags, conceitos de thumbnail e cortes, só quando a Carol pede. As datas de gravação e de publicação viram eventos do Calendário (com avisos).
6. **Biblioteca**: livros (PDF e EPUB, com o leitor estilo Kindle, abaixo) e artigos por link (extrai o texto), por PDF ou por texto colado, com tags, área, status (ler / lendo / lido / fichado), destaques e notas.
7. **Cadernos**: estantes e cadernos de escrita à mão (detalhes abaixo).
8. **Questões**: gerador, banco de questões, modo prova, modo fixação e revisão espaçada.
9. **Calendário**: visão de mês, semana e lista, com eventos da faculdade e eventos próprios.
10. **Pergunte à Bússola** (`#buscar`, lupa no topo de todas as telas): busca no aparelho em tudo (`js/dados-busca.js`) e "Perguntar", que manda à IA só o resumo da pergunta (`contextoDaPergunta`) e mostra a resposta com links para os itens.

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
- **IA**: o botão "gerar questões desta página/caderno" manda a imagem da página para a função de questões.
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

## Leitor de livros (estilo Kindle)

- Decisão da Carol (29/10/2026): livros em PDF e EPUB na Biblioteca, lidos dentro do app com os recursos de um Kindle.
- O livro é um artigo com `fonte: 'livro'`, o arquivo em `pdf_path` (`{id}/biblioteca/<id>.pdf|epub`, até 50 MB, o limite do plano gratuito do Supabase) e os detalhes em `artigos.dados` (migração 011): `formato`, `capa` (JPEG pequeno em data URL), `posicao` (EPUB `{ capitulo, fracao }`, PDF `{ pagina }`), `pct`, `marcadores`, `zoom`/`ajuste` (PDF) e `ultima_leitura`. Título, autor e capa saem do próprio arquivo (`js/livros.js`). Depois de aberto uma vez, o arquivo fica no Cache "hub-arquivos" e lê sem internet.
- **EPUB sem biblioteca** (`js/zip.js` lê o ZIP com o `DecompressionStream`; `js/epub.js` lê OPF, sumário nav/NCX e capa): cada capítulo é copiado só com as tags seguras (nada de script, estilo, iframe, formulário, `on*` ou `javascript:`), imagens viram `blob:` e links internos navegam no livro. Páginas pelas colunas do CSS (duas lado a lado em tela larga, linha de até ~36 letras por px de fonte); ou rolando.
- **Ajustes** (no aparelho, `hub.leitor.prefs`): fonte (serifada, sem serifa, para cansaço), tamanho, espaço entre linhas, margens, justificado, fundo (como o app, claro, sépia, escuro, preto; tokens `--livro-*` em `temas.css`), brilho (véu por cima) e virar páginas × rolar. PDF: página inteira ou largura, zoom e modo noite.
- **Destaques** em 4 cores com nota, no mesmo `artigos.destaques` da Biblioteca (com `capitulo`, `inicio`, `fim` = posições no texto do capítulo): aparecem em "Destaques e notas" e vão para o fichamento. Marcadores (🔖), sumário, busca no livro todo, tempo para acabar o capítulo e o livro, toque nas bordas, deslizar (o palco tem `touch-action: pan-y` para o gesto ser do leitor), teclado.
- **Caneta no PDF**: o `EditorDeTinta` dos Cadernos por cima da página (desenhada pelo pdf.js), com cores `--tinta-livro-*` que não mudam com o tema; a tinta fica em `livro_paginas` (uma linha por página). Só a S Pen escreve (ou o dedo, se ligar); o dedo continua virando a página.
- **IA só quando ela pede** (`livro-ia`): explicar o trecho, resumo do capítulo (os dois podem ir para as notas do livro) e "Gerar questões" (leva o texto do capítulo para o gerador).
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

## Caixa de demandas (Trello, Notion e mensagens)

- Decisão da Carol (28/10/2026): juntar as demandas do Trello, do Notion e das mensagens do WhatsApp numa caixa no Hoje; nada vira tarefa sem o OK dela. Gmail fica de fora.
- **Só leitura**: o app nunca cria, muda ou apaga nada no Trello nem no Notion.
- **Trello**: autorização oficial (`trello.com/1/authorize`, `scope=read`, `expiration=never`) com a chave do app em `TRELLO_API_KEY` (pública) e o token da Carol guardado criptografado em `credenciais`. Entram os cartões em que ela é membro, abertos, sem "concluído" e fora de listas como "Feito"/"Concluído".
- **Notion**: conexão interna criada pela Carol (segredo colado uma vez, criptografado); ela escolhe até 8 bases. Entram as páginas editadas nos últimos 30 dias sem status de concluída.
- **WhatsApp**: não há API para conversas pessoais e os jeitos não oficiais arriscam o número, então **nunca** use bibliotecas não oficiais. Caminho: Web Share Target (Compartilhar → Bússola, só no Android) ou "Colar mensagem" (iPhone).
- **Do jeito da agência** (decisão da Carol, 28/10/2026): em Configurações ela escolhe o **quadro dos designers** (Confluir | @hbellinedesign, com as listas APROVAÇÃO e APROVADO) e os **quadros dos clientes dela** (médicos e saúde; os de influência ficam de fora). No quadro dos designers o cliente vem pela **etiqueta** (`etiquetaDoCliente`). Post em aprovação → demanda `aprovacao` + Web Push na hora; aprovado → `aprovado` ("Atualizar o Trello de [cliente]"); nos quadros dos clientes, a lista "Demandas" vira demanda e prazo vencido fora de Aprovados/Informações, ou quadro parado há 7 dias, vira `alinhar` (uma vez por semana). Essas três não passam pela IA e têm os botões Feito / Depois / Abrir. Notion: só páginas com "Carol" ou "Essence" (editável) em algum campo.
- **Organizar minhas demandas** (decisão da Carol, 28/10/2026; `js/dados-organizar.js`, `views-organizar.js`, `eventos-organizar.js`, `netlify/lib/ia-organizar.mjs`): a IA (ou o organizador simples, sem internet) encaixa as demandas novas e as tarefas que vieram delas nos dias de trabalho dos próximos 14 dias, com horário: aprovação primeiro, depois prazo e prioridade, o mesmo cliente junto, sem cobrir compromisso nem tarefa com hora, sem passar das horas por dia (Configurações → Demandas, com os dias de trabalho; o horário do dia é o do "Planejar meu dia"). O que a IA errar volta para o encaixe simples (`conferirOrganizacao`). O que não cabe até o prazo vai para "Sem espaço", com o primeiro dia livre e uma mensagem pronta para pedir prazo ao cliente. A proposta fica em `config` "organizar" (vale no dia), pode ser ajustada bloco a bloco e só vira tarefa (com `data`, `hora`, `dados.organizada`) no "Aceitar e pôr na agenda", com Desfazer. "Reorganizar" aparece quando já há semana organizada e chega demanda que vence em até 2 dias ou uma tarefa dela fica para trás. Opcional: montar a proposta sozinha ao abrir o app de manhã (só avisa).
- A função `demandas` (conectar, bases, escolher, trello-quadros, trello-config, sincronizar, ler, organizar) e a `demandas-agendado` (a cada 15 min) gravam em `demandas` (`status` nova / aceita / descartada, `mudou` quando a origem muda depois de aceita). A IA analisa até 15 itens novos por leitura; o resto fica com a sugestão simples (`js/dados-demandas.js`) e a IA completa na próxima.

## Calendário da faculdade (requisito importante)

- Fontes:
  1. eventos do AVA (prazos de tarefas, quizzes, eventos de curso e eventos do site/instituição) pela API;
  2. a exportação de calendário do Moodle (link .ics em `/calendar/export.php`), como reserva;
  3. o calendário acadêmico da UniEVANGÉLICA (provas, feriados, início e fim do semestre), importado de PDF ou de uma página com a ajuda da IA e revisado pela Carol antes de salvar;
  4. eventos que a Carol cria à mão (provas avisadas em sala, apresentações).
- Cada evento tem: tipo (prova, trabalho, atividade, aula, feriado, pessoal), disciplina, data/hora, status (pendente / entregue / atrasado, vindo do AVA) e um link para o AVA.
- **Avisos**: contagem regressiva no Início e destaque vermelho para atrasados, laranja para menos de 48h e bege para a semana. Notificações do PWA 3 dias antes, 1 dia antes e no dia, com horário configurável. Como o PWA fechado não dispara avisos sozinho no Android, elas chegam por **Web Push**: a Scheduled Function verifica os prazos e envia o push (chaves VAPID).
- **Avisos do dia a dia** (28/10/2026, `netlify/lib/avisos-vida.mjs`): resumo da manhã (até 4h depois do horário), contas fixas e faturas que vencem hoje e hábitos que faltam, cada um com liga/desliga e horário, mais um horário de silêncio. A função `avisos-agendado` roda a cada 15 minutos; cada aviso sai uma vez por dia (marcas em `config` "avisos_vida_enviados"). No iPhone, só com o app adicionado à Tela de Início pelo Safari (iOS 16.4+); a tela de Configurações mostra o passo a passo.
- **Plano de estudo automático para provas**: ao surgir uma prova, o app sugere sessões de revisão nos dias anteriores, já com os cadernos e as questões daquela disciplina.
- Opcional: exportar tudo como um link .ics para assinar no Google Agenda.

## Gerador de questões

- Entradas possíveis: um tema digitado, um artigo da Biblioteca, um material do AVA, uma página ou um caderno inteiro (imagem).
- Configurações: quantidade, dificuldade, área/disciplina e modo.
  - **Prova**: múltipla escolha (4 ou 5 alternativas) e verdadeiro/falso, com nota final.
  - **Fixação**: perguntas dissertativas; a IA corrige a resposta da Carol, com nota de 0 a 10 e um comentário.
- A função `ia-background` (pedido do tipo `questoes`) usa a web search da Anthropic para pesquisar o tema e devolve **JSON validado** com: enunciado, alternativas, resposta correta, explicação comentada, fontes (título + URL) e nível.
- Questões salvas no banco, com tags, acertos/erros e **revisão espaçada** (refazer as erradas em 1, 3, 7 e 15 dias).

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
- `questoes`
- `respostas`
- `revisoes`
- `pautas_substack`
- `simulados` (Questões)
- `videos` (YouTube)
- `config` (tema, horários de aviso, token do AVA criptografado)
- `demandas` (migração 010): Caixa de demandas
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
