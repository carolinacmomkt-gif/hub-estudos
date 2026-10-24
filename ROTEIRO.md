# Roteiro de construção do Hub de Estudos

Cada etapa só começa depois que a anterior foi testada.
Os números são os do guia original; a lista está na **ordem combinada** com a Carol
(o AVA é testado antes do Supabase, e a caneta é testada antes do editor completo).

- [x] **Etapa 1 — Base do app e temas**: index.html, PWA (manifest, ícones, service worker offline), navegação lateral (tablet) e inferior (celular), temas claro/escuro/automático, tela Início com saudação, "Próximo passo" e cards de exemplo.
- [x] **Etapa 3 — Teste de conexão com o AVA**: `ava-conectar` + tela em Configurações que mostra as funções liberadas e bloqueadas. Sem guardar senha nem token ainda (o Supabase chega na etapa seguinte).
- [ ] **Teste de conexão com o Lyceum**: `lyceum-teste` faz um login, descobre os códigos e mostra quais rotas de notas, faltas, agenda e avisos respondem (só a estrutura, sem valores). Sem guardar nada.
- [ ] **Etapa 2 — Supabase e sincronização**: SQL das tabelas com RLS, login só por e-mail, `persistencia.js` com cache no IndexedDB e sincronização ao voltar a internet, indicador de conexão e **exportar/importar backup**. Depois, guardar o token do AVA e a senha do Lyceum criptografados.
- [ ] **Protótipo da caneta**: uma página só, para sentir no Tab S10 Lite a pressão, o atraso do traço e a rejeição da palma antes do editor completo.
- [ ] **Etapa 4 — Faculdade e calendário**: sincronização completa, painéis da Faculdade e por disciplina, Calendário (mês/semana/lista), importação do calendário acadêmico, eventos manuais, avisos, notificações por **Web Push** (VAPID), sincronização automática e agendada (6h).
- [ ] **Etapa 5a — Cadernos: editor**: canvas com perfect-freehand, S Pen, rejeição de palma, ferramentas, predefinições de caneta, estabilizador, gestos, desfazer/refazer, zoom, traços em JSON vetorial já com camadas.
- [ ] **Etapa 5b — Cadernos: organização e modelos**: tipos, capas, tamanhos, todos os modelos de folha, modelos próprios, miniaturas, seções, estantes, pastas, caderno de PDF, exportação PDF/PNG.
- [ ] **Etapa 5c — Cadernos: recursos avançados (GoodNotes)**: camadas, melhorar letra, alinhar à pauta, janela de zoom, converter em texto e ortografia, régua, fita de estudo, laser e apresentação, laço avançado, elementos, digitalização, abas, índice, marcadores e links.
- [ ] **Etapa 6 — Biblioteca**: link (extração de texto), PDF, texto colado; tags, área, status, destaques, notas, filtros.
- [ ] **Etapa 7 — Gerador de questões**: função `gerar-questoes`, modos prova e fixação, gabarito com fontes, banco e revisão espaçada, JSON validado.
- [ ] **Etapa 8 — Painéis e Substack**: Início completo, Estudos gerais, Substack (pautas, editor, referências, meta), "Próximo passo" ligado ao mais urgente.
- [ ] **Etapa 9 — Acabamento**: revisão de temas e larguras, offline, backup, instalação no Galaxy Tab S10 Lite.

## Ideias aprovadas para encaixar
- Botão "+" flutuante (novo caderno, evento, artigo, questão) com **caixa de entrada rápida** para ideias. *(Etapa 2)*
- Opção de texto maior em Configurações. *(Etapa 2)*
- **Lyceum** na Etapa 4: sincronização de notas oficiais, frequência, agenda e avisos; contador de faltas com alerta de limite; importação por PDF/print como reserva.
- **Calculadora de média** com as notas do Lyceum/AVA e pesos configuráveis. *(Etapa 4)*
- **Compartilhar para o Hub** (Web Share Target): link compartilhado no Android cai na Biblioteca ou vira pauta. *(Etapa 6)*
- **Modo véspera de prova**: resumos, cadernos, questões erradas e simulado cronometrado da disciplina. *(Etapa 7)*
- **Flashcards saindo do caderno**: páginas no modelo flashcards viram baralho na revisão espaçada. *(Etapa 7)*
- Sessão de foco (cronômetro tipo Pomodoro) a partir do "Próximo passo". *(Etapa 8)*
- **Resumo da semana** no domingo à noite, com notificação. *(Etapa 8)*

## Para depois (ideias grandes)
- Busca na letra: transcrever os cadernos inteiros para buscar dentro da escrita à mão.
- Gravar a aula junto com as anotações (áudio sincronizado com os traços).
