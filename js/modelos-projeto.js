// Modelos de projeto (decisão da Carol, 03/11/2026): cada tipo tem métodos, e cada método monta as
// fases (dias contados a partir da data principal "D"), as tarefas de cada fase, os números a
// acompanhar e as seções do painel. Acrescentar um tipo novo é só escrever mais um modelo aqui.
// Sem DOM, para dar para testar sozinho.

// Campos que um modelo pode perguntar ao criar o projeto.
export const CAMPOS = {
  preco: { rotulo: 'Preço (R$)', tipo: 'numero', padrao: 997 },
  vagas: { rotulo: 'Vagas', tipo: 'numero', padrao: 8 },
  duracao: { rotulo: 'Duração (semanas)', tipo: 'numero', padrao: 8 },
  diasCarrinho: { rotulo: 'Dias de carrinho aberto', tipo: 'numero', padrao: 7 },
  metaVendas: { rotulo: 'Meta de vendas', tipo: 'numero', padrao: 30 },
  metaClientes: { rotulo: 'Meta de clientes', tipo: 'numero', padrao: 5 },
  metaInscritos: { rotulo: 'Meta de inscritos', tipo: 'numero', padrao: 100 },
  capitulos: { rotulo: 'Quantos capítulos', tipo: 'numero', padrao: 8 },
  metaPalavras: { rotulo: 'Meta de palavras', tipo: 'numero', padrao: 30000 },
  formato: { rotulo: 'Formato', tipo: 'opcoes', padrao: 'curso', opcoes: [['curso', 'Curso gravado'], ['ebook', 'E-book'], ['workshop', 'Workshop gravado'], ['templates', 'Modelos e planilhas']] },
  fases: { rotulo: 'Fases (separadas por vírgula)', tipo: 'texto', padrao: 'Planejar, Fazer, Revisar, Entregar' },
};

// Etapas das listas de cada seção.
export const ETAPAS = {
  pessoas: [['conversa', 'Conversa'], ['chamada', 'Chamada'], ['fechou', 'Fechou'], ['nao', 'Não fechou']],
  propostas: [['proposta', 'Proposta enviada'], ['negociando', 'Negociando'], ['fechou', 'Fechou'], ['nao', 'Não fechou']],
  modulos: [['roteiro', 'Roteiro'], ['gravado', 'Gravado'], ['editado', 'Editado'], ['no-ar', 'No ar']],
  capitulos: [['rascunho', 'Rascunho'], ['escrito', 'Escrito'], ['revisado', 'Revisado']],
};

export const SECOES = {
  pessoas: { nome: 'Pessoas e funil', item: 'pessoa', etapas: 'pessoas', placeholder: 'Nome de quem demonstrou interesse' },
  propostas: { nome: 'Propostas e clientes', item: 'cliente', etapas: 'propostas', placeholder: 'Nome do cliente' },
  encontros: { nome: 'Encontros', item: 'encontro', placeholder: 'Tema do encontro', comData: true },
  modulos: { nome: 'Módulos e aulas', item: 'módulo', etapas: 'modulos', placeholder: 'Nome do módulo ou aula' },
  capitulos: { nome: 'Capítulos', item: 'capítulo', etapas: 'capitulos', placeholder: 'Nome do capítulo', comPalavras: true },
  materiais: { nome: 'Materiais', item: 'material', placeholder: 'Página, e-mail, criativo…', checklist: true },
};

// Atalhos para escrever as fases: f(id, nome, de, até, [[dia, tarefa, marco?], ...])
const f = (id, nome, de, ate, tarefas = []) => ({ id, nome, de, ate, tarefas: tarefas.map(([dia, titulo, marco]) => ({ dia, titulo, marco: marco || null })) });
const semanas = (r) => Math.max(1, Number(r.duracao) || 8) * 7;
const carrinho = (r) => Math.max(1, Number(r.diasCarrinho) || 7);
const num = (v) => Number(v) || 0;

// ---------------------------------------------------------------------------
// Números (KPIs). tipo: 'soma' (lança por dia), 'calc' (vem das seções ou de outros números).
// ---------------------------------------------------------------------------
const K = {
  vendas: (meta) => ({ id: 'vendas', nome: 'Vendas', tipo: 'soma', unidade: 'n', meta }),
  leads: () => ({ id: 'leads', nome: 'Leads', tipo: 'soma', unidade: 'n', meta: null }),
  reembolsos: () => ({ id: 'reembolsos', nome: 'Reembolsos', tipo: 'soma', unidade: 'n', meta: null, menorMelhor: true }),
  conversao: (de, para) => ({ id: 'conversao', nome: 'Conversão', tipo: 'calc', unidade: 'pct', meta: null, calc: (v) => (v[de] ? v[para] / v[de] : null) }),
  faturamento: (qtd, metaCampo) => ({ id: 'faturamento', nome: 'Faturamento', tipo: 'calc', unidade: 'reais', meta: (r) => num(r.preco) * num(r[metaCampo]) || null, calc: (v, r) => num(v[qtd]) * num(r.preco) }),
};

// ---------------------------------------------------------------------------
// Tipos e métodos
// ---------------------------------------------------------------------------
export const TIPOS = [
  {
    id: 'mentoria', nome: 'Mentoria', emoji: '🤝', descricao: 'Acompanhar pessoas por algumas semanas, em grupo ou individual.',
    campos: ['preco', 'vagas', 'duracao'], area: 'trabalho',
    kpis: [
      { id: 'vendidas', nome: 'Vagas vendidas', tipo: 'calc', unidade: 'n', meta: (r) => num(r.vagas), calc: (v, r, s) => (s.pessoas || []).filter((p) => p.etapa === 'fechou').length, principal: true },
      { id: 'conversas', nome: 'Conversas', tipo: 'calc', unidade: 'n', meta: null, calc: (v, r, s) => (s.pessoas || []).length },
      { id: 'conversao', nome: 'Conversão', tipo: 'calc', unidade: 'pct', meta: null, calc: (v) => (v.conversas ? v.vendidas / v.conversas : null) },
      K.faturamento('vendidas', 'vagas'),
      { id: 'encontros', nome: 'Encontros feitos', tipo: 'calc', unidade: 'n', meta: null, calc: (v, r, s) => (s.encontros || []).filter((e) => e.feito).length },
      { id: 'depoimentos', nome: 'Depoimentos', tipo: 'soma', unidade: 'n', meta: (r) => Math.ceil(num(r.vagas) / 2) },
    ],
    secoes: ['pessoas', 'encontros', 'materiais'],
    materiais: ['Documento de apresentação', 'Link de pagamento', 'Grupo das mentoradas', 'Material de boas-vindas', 'Pesquisa de satisfação'],
    metodos: [
      {
        id: 'grupo', nome: 'Em grupo', descricao: 'Uma turma com data de início: valida, monta a oferta, vende em 3 semanas e entrega junto.', chave: 'Início da mentoria', janela: 'vender',
        fases: (r) => [
          f('validar', 'Validar a ideia', -42, -29, [[-42, 'Escrever para quem é e o problema que resolve'], [-38, 'Conversar com 5 pessoas do público'], [-33, 'Anotar as palavras que elas usam'], [-30, 'Decidir formato, duração e preço']]),
          f('oferta', 'Montar a oferta', -28, -22, [[-28, 'Escrever a promessa e o que está incluso'], [-26, 'Montar o cronograma dos encontros'], [-24, 'Fazer o documento de apresentação'], [-23, 'Definir bônus e garantia'], [-22, 'Separar o link de pagamento']]),
          f('vender', 'Vender', -21, -1, [[-21, 'Listar quem já demonstrou interesse'], [-20, 'Postar 3 conteúdos de aquecimento'], [-14, 'Abrir as inscrições', 'Inscrições abertas'], [-10, 'Fazer as chamadas com as interessadas'], [-4, 'Avisar das últimas vagas'], [-1, 'Fechar a turma', 'Turma fechada']]),
          f('entregar', 'Entregar', 0, semanas(r), [[0, 'Boas-vindas e grupo da turma'], [0, 'Primeiro encontro', 'Início da mentoria'], [3, 'Mandar o material de apoio'], [Math.round(semanas(r) / 2), 'Encontro do meio: como estão?'], [semanas(r), 'Encontro final', 'Fim da mentoria']]),
          f('depois', 'Depoimentos e próxima turma', semanas(r) + 1, semanas(r) + 14, [[semanas(r) + 2, 'Pedir os depoimentos'], [semanas(r) + 3, 'Mandar a pesquisa de satisfação'], [semanas(r) + 7, 'Anotar os aprendizados'], [semanas(r) + 14, 'Decidir a próxima turma']]),
        ],
      },
      {
        id: 'individual', nome: 'Individual', descricao: 'Vagas abertas o tempo todo: cada pessoa entra quando fecha. Foco no funil de conversas.', chave: 'Começar a atender', janela: 'vender',
        fases: (r) => [
          f('validar', 'Validar a ideia', -28, -15, [[-28, 'Escrever para quem é e o problema que resolve'], [-24, 'Conversar com 5 pessoas do público'], [-18, 'Decidir formato, duração e preço']]),
          f('oferta', 'Montar a oferta', -14, -1, [[-14, 'Escrever a promessa e o passo a passo'], [-10, 'Fazer o documento de apresentação'], [-7, 'Montar a agenda de chamadas'], [-3, 'Separar o link de pagamento e o contrato']]),
          f('vender', 'Vender', 0, 60, [[0, 'Anunciar que as vagas estão abertas', 'Vagas abertas'], [7, 'Revisar o funil da semana'], [14, 'Revisar o funil da semana'], [21, 'Revisar o funil da semana'], [30, 'Pedir indicações para quem já atende']]),
          f('entregar', 'Entregar', 0, semanas(r) + 30, [[1, 'Montar o roteiro do primeiro encontro'], [semanas(r), 'Pedir os primeiros depoimentos']]),
        ],
      },
    ],
  },
  {
    id: 'infoproduto', nome: 'Infoproduto', emoji: '🎓', descricao: 'Curso gravado, e-book ou workshop vendido em lançamento ou sempre aberto.',
    campos: ['formato', 'preco', 'metaVendas', 'diasCarrinho'], area: 'trabalho',
    kpis: [K.leads(), { ...K.vendas((r) => num(r.metaVendas)), principal: true }, K.conversao('leads', 'vendas'), K.faturamento('vendas', 'metaVendas'), K.reembolsos()],
    secoes: ['modulos', 'materiais'],
    materiais: ['Página de vendas', 'Página de captura', 'Sequência de e-mails', 'Criativos e posts', 'Checkout', 'Área de membros'],
    metodos: [
      {
        id: 'semente', nome: 'Lançamento semente', descricao: 'Vende antes de gravar, com uma aula ao vivo, e grava junto com as primeiras alunas.', chave: 'Abertura do carrinho', janela: 'carrinho',
        fases: (r) => [
          f('planejar', 'Planejar', -35, -22, [[-35, 'Definir o tema e para quem é'], [-31, 'Pesquisa com 10 pessoas do público'], [-26, 'Esboçar os módulos'], [-22, 'Definir preço e bônus de fundadora']]),
          f('aquecer', 'Aquecer', -21, -8, [[-21, 'Abrir a lista de interessadas'], [-18, 'Conteúdo 1: o problema'], [-14, 'Conteúdo 2: o caminho'], [-10, 'Convidar para a aula ao vivo']]),
          f('aula', 'Aula ao vivo', -7, -1, [[-7, 'Roteiro da aula'], [-4, 'Slides da aula'], [-2, 'Lembretes da aula'], [-1, 'Aula ao vivo', 'Aula ao vivo']]),
          f('carrinho', 'Carrinho aberto', 0, carrinho(r), [[0, 'Abrir o carrinho', 'Carrinho abre'], [1, 'E-mail e stories do dia'], [Math.max(1, carrinho(r) - 1), 'Aviso de 24 horas'], [carrinho(r), 'Fechar o carrinho', 'Carrinho fecha']]),
          f('gravar', 'Gravar com as alunas', carrinho(r) + 1, carrinho(r) + 42, [[carrinho(r) + 3, 'Gravar o módulo 1'], [carrinho(r) + 10, 'Gravar o módulo 2'], [carrinho(r) + 17, 'Gravar o módulo 3'], [carrinho(r) + 24, 'Gravar o módulo 4'], [carrinho(r) + 40, 'Pedir os depoimentos']]),
        ],
      },
      {
        id: 'aquecimento', nome: 'Lançamento com aquecimento', descricao: 'Pré-lançamento com 3 conteúdos, carrinho aberto por alguns dias e fechamento.', chave: 'Abertura do carrinho', janela: 'carrinho',
        fases: (r) => [
          f('planejar', 'Planejar', -45, -29, [[-45, 'Definir promessa, público e preço'], [-40, 'Estrutura dos módulos'], [-35, 'Calendário do lançamento'], [-30, 'Meta de leads e de vendas']]),
          f('produzir', 'Produzir', -28, -15, [[-28, 'Gravar os primeiros módulos'], [-24, 'Escrever a página de vendas'], [-20, 'Escrever a sequência de e-mails'], [-17, 'Criativos e posts'], [-15, 'Testar o checkout']]),
          f('pre', 'Pré-lançamento', -14, -1, [[-14, 'Abrir a captura de leads', 'Captura aberta'], [-7, 'Conteúdo 1: a oportunidade'], [-5, 'Conteúdo 2: o caminho'], [-3, 'Conteúdo 3: a prova'], [-1, 'Aviso da abertura']]),
          f('carrinho', 'Carrinho aberto', 0, carrinho(r), [[0, 'Abrir o carrinho', 'Carrinho abre'], [1, 'E-mail e stories do dia'], [Math.round(carrinho(r) / 2), 'Bônus ou live de objeções'], [Math.max(1, carrinho(r) - 1), 'Aviso de 24 horas'], [carrinho(r), 'Fechar o carrinho', 'Carrinho fecha']]),
          f('pos', 'Pós-lançamento', carrinho(r) + 1, carrinho(r) + 14, [[carrinho(r) + 1, 'Boas-vindas às alunas'], [carrinho(r) + 3, 'Fechar os números do lançamento'], [carrinho(r) + 7, 'Anotar o que funcionou'], [carrinho(r) + 14, 'Pedir os primeiros depoimentos']]),
        ],
      },
      {
        id: 'relampago', nome: 'Relâmpago', descricao: 'Oferta rápida para quem já te acompanha: 5 dias de aviso e 3 de carrinho.', chave: 'Abertura do carrinho', janela: 'carrinho',
        fases: () => [
          f('preparar', 'Preparar', -10, -6, [[-10, 'Definir a oferta e o preço'], [-8, 'Página ou documento simples'], [-6, 'Separar o link de pagamento']]),
          f('aquecer', 'Aquecer', -5, -1, [[-5, 'Stories avisando que vem novidade'], [-3, 'Lista de espera'], [-1, 'Aviso da abertura']]),
          f('carrinho', 'Carrinho aberto', 0, 3, [[0, 'Abrir o carrinho', 'Carrinho abre'], [2, 'Aviso de 24 horas'], [3, 'Fechar o carrinho', 'Carrinho fecha']]),
          f('depois', 'Depois', 4, 10, [[4, 'Entregar o acesso'], [7, 'Anotar os números']]),
        ],
      },
      {
        id: 'perpetuo', nome: 'Perpétuo', descricao: 'Funil sempre aberto: isca, e-mails e página de vendas, revisando os números toda semana.', chave: 'Funil no ar', janela: 'no-ar',
        fases: () => [
          f('produzir', 'Produzir', -45, -15, [[-45, 'Gravar ou escrever o produto'], [-30, 'Revisar o produto'], [-20, 'Escrever a página de vendas']]),
          f('funil', 'Montar o funil', -14, -1, [[-14, 'Criar a isca'], [-11, 'Página de captura'], [-8, 'Sequência de e-mails'], [-4, 'Checkout e área de membros'], [-1, 'Testar o funil inteiro']]),
          f('no-ar', 'No ar', 0, 60, [[0, 'Ligar o funil', 'Funil no ar'], [7, 'Revisar os números da semana'], [14, 'Revisar os números da semana'], [21, 'Revisar os números da semana'], [28, 'Revisar os números da semana']]),
          f('otimizar', 'Otimizar', 61, 90, [[61, 'Testar outra isca ou outro título'], [75, 'Ajustar a página de vendas'], [90, 'Fechar o trimestre']]),
        ],
      },
    ],
  },
  {
    id: 'servico', nome: 'Serviço ou pacote', emoji: '💼', descricao: 'Um pacote de serviço: proposta, fechamento, entrega e renovação.',
    campos: ['preco', 'metaClientes'], area: 'trabalho',
    kpis: [
      { id: 'propostas', nome: 'Propostas', tipo: 'calc', unidade: 'n', meta: null, calc: (v, r, s) => (s.propostas || []).length },
      { id: 'fechados', nome: 'Clientes fechados', tipo: 'calc', unidade: 'n', meta: (r) => num(r.metaClientes), calc: (v, r, s) => (s.propostas || []).filter((p) => p.etapa === 'fechou').length, principal: true },
      { id: 'conversao', nome: 'Conversão', tipo: 'calc', unidade: 'pct', meta: null, calc: (v) => (v.propostas ? v.fechados / v.propostas : null) },
      K.faturamento('fechados', 'metaClientes'),
      { id: 'renovacoes', nome: 'Renovações', tipo: 'soma', unidade: 'n', meta: null },
    ],
    secoes: ['propostas', 'materiais'],
    materiais: ['Proposta modelo', 'Contrato', 'Apresentação do pacote', 'Formulário de briefing', 'Relatório de entrega'],
    metodos: [
      {
        id: 'pacote', nome: 'Pacote fechado', descricao: 'Desenha o pacote, prepara os materiais e vende por 2 meses, revisando o funil toda semana.', chave: 'Começar a vender', janela: 'vender',
        fases: () => [
          f('desenhar', 'Desenhar o pacote', -21, -8, [[-21, 'O que entra e o que não entra'], [-17, 'Prazo e preço'], [-12, 'Como é a entrega, passo a passo']]),
          f('materiais', 'Materiais', -7, -1, [[-7, 'Proposta modelo e contrato'], [-4, 'Apresentação do pacote'], [-2, 'Formulário de briefing']]),
          f('vender', 'Vender', 0, 60, [[0, 'Anunciar o pacote', 'Pacote à venda'], [3, 'Mandar para 10 contatos'], [7, 'Revisar as propostas da semana'], [14, 'Revisar as propostas da semana'], [21, 'Revisar as propostas da semana'], [30, 'Pedir indicações']]),
          f('entregar', 'Entregar e renovar', 7, 90, [[14, 'Primeira entrega'], [45, 'Conversa de meio de caminho'], [85, 'Proposta de renovação']]),
        ],
      },
    ],
  },
  {
    id: 'evento', nome: 'Evento ou aula ao vivo', emoji: '🎤', descricao: 'Workshop, aula aberta ou encontro: divulgação, inscrições, o dia e a oferta.',
    campos: ['preco', 'metaInscritos', 'metaVendas'], area: 'trabalho',
    kpis: [
      { id: 'inscritos', nome: 'Inscritos', tipo: 'soma', unidade: 'n', meta: (r) => num(r.metaInscritos), principal: true },
      { id: 'presentes', nome: 'Presentes', tipo: 'soma', unidade: 'n', meta: null },
      { id: 'presenca', nome: 'Presença', tipo: 'calc', unidade: 'pct', meta: null, calc: (v) => (v.inscritos ? v.presentes / v.inscritos : null) },
      K.vendas((r) => num(r.metaVendas)),
      K.faturamento('vendas', 'metaVendas'),
    ],
    secoes: ['materiais'],
    materiais: ['Página de inscrição', 'Roteiro do evento', 'Slides', 'Lembretes (e-mail e WhatsApp)', 'Oferta do final', 'Gravação'],
    metodos: [
      {
        id: 'online', nome: 'Online', descricao: '3 semanas de divulgação, o dia do evento e 2 semanas de replay e oferta.', chave: 'Dia do evento', janela: 'divulgar',
        fases: () => [
          f('planejar', 'Planejar', -35, -22, [[-35, 'Tema, promessa e público'], [-30, 'Roteiro do evento'], [-25, 'Página de inscrição']]),
          f('divulgar', 'Divulgar', -21, -1, [[-21, 'Abrir as inscrições', 'Inscrições abertas'], [-18, 'Posts de divulgação'], [-10, 'Convite direto para a lista'], [-3, 'Slides prontos'], [-1, 'Lembrete de amanhã']]),
          f('evento', 'Evento', 0, 0, [[0, 'Lembrete de 1 hora'], [0, 'Evento', 'Evento']]),
          f('depois', 'Replay e oferta', 1, 14, [[1, 'Mandar o replay'], [2, 'Abrir a oferta'], [5, 'Fechar a oferta'], [7, 'Pesquisa com quem foi'], [14, 'Anotar os números']]),
        ],
      },
      {
        id: 'presencial', nome: 'Presencial', descricao: 'Mais tempo para local, materiais e confirmação de presença.', chave: 'Dia do evento', janela: 'divulgar',
        fases: () => [
          f('planejar', 'Planejar', -60, -31, [[-60, 'Tema, público e formato'], [-50, 'Reservar o local'], [-40, 'Orçamento e preço'], [-35, 'Página de inscrição']]),
          f('divulgar', 'Divulgar', -30, -1, [[-30, 'Abrir as inscrições', 'Inscrições abertas'], [-21, 'Posts de divulgação'], [-14, 'Materiais impressos e brindes'], [-7, 'Confirmar presença'], [-2, 'Conferir o local e os equipamentos']]),
          f('evento', 'Evento', 0, 0, [[0, 'Evento', 'Evento']]),
          f('depois', 'Depois', 1, 14, [[1, 'Agradecer e mandar fotos'], [3, 'Pesquisa com quem foi'], [7, 'Fechar as contas'], [14, 'Anotar os aprendizados']]),
        ],
      },
    ],
  },
  {
    id: 'livro', nome: 'Livro ou e-book', emoji: '📚', descricao: 'Da pesquisa à publicação, capítulo por capítulo.',
    campos: ['capitulos', 'metaPalavras', 'preco', 'metaVendas'], area: 'criacao',
    kpis: [
      { id: 'palavras', nome: 'Palavras escritas', tipo: 'calc', unidade: 'n', meta: (r) => num(r.metaPalavras), calc: (v, r, s) => (s.capitulos || []).reduce((t, c) => t + num(c.palavras), 0), principal: true },
      { id: 'prontos', nome: 'Capítulos revisados', tipo: 'calc', unidade: 'n', meta: (r) => num(r.capitulos), calc: (v, r, s) => (s.capitulos || []).filter((c) => c.etapa === 'revisado').length },
      K.vendas((r) => num(r.metaVendas) || null),
    ],
    secoes: ['capitulos', 'materiais'],
    materiais: ['Sumário', 'Capa', 'Diagramação', 'Revisão final', 'Página de venda'],
    itensIniciais: (r) => ({ capitulos: Array.from({ length: Math.min(40, Math.max(1, num(r.capitulos) || 8)) }, (_, i) => ({ nome: `Capítulo ${i + 1}`, etapa: 'rascunho', palavras: 0 })) }),
    metodos: [
      {
        id: 'capitulos', nome: 'Capítulo por semana', descricao: 'Um mês de pesquisa, um capítulo por semana, revisão, capa e lançamento.', chave: 'Publicação', janela: 'escrita',
        fases: (r) => {
          const n = Math.min(40, Math.max(1, num(r.capitulos) || 8));
          const inicio = -(n * 7 + 60);
          return [
            f('pesquisa', 'Pesquisa e estrutura', inicio, inicio + 29, [[inicio, 'Definir a ideia central e o leitor'], [inicio + 10, 'Ler e anotar as referências'], [inicio + 25, 'Montar o sumário']]),
            f('escrita', 'Escrita', inicio + 30, -31, Array.from({ length: n }, (_, i) => [inicio + 30 + i * 7 + 6, `Escrever o capítulo ${i + 1}`])),
            f('revisao', 'Revisão', -30, -11, [[-30, 'Primeira leitura inteira'], [-20, 'Revisão do texto'], [-11, 'Leitura de alguém de fora']]),
            f('capa', 'Capa e diagramação', -10, -1, [[-10, 'Capa'], [-6, 'Diagramação'], [-2, 'Arquivo final']]),
            f('lancar', 'Lançamento', 0, 14, [[0, 'Publicar', 'Publicação'], [2, 'Contar para a lista'], [14, 'Pedir as primeiras avaliações']]),
          ];
        },
      },
    ],
  },
  {
    id: 'livre', nome: 'Projeto livre', emoji: '✨', descricao: 'Você dá nome às fases; o app divide o tempo até a entrega.',
    campos: ['fases'], area: 'pessoal',
    kpis: [],
    secoes: ['materiais'],
    materiais: [],
    metodos: [
      {
        id: 'livre', nome: 'Do meu jeito', descricao: 'As fases que você escrever, divididas igualmente até a data de entrega.', chave: 'Entrega', janela: null,
        fases: (r, diasAteChave) => {
          const nomes = String(r.fases || CAMPOS.fases.padrao).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
          const total = Math.max(nomes.length, diasAteChave);
          const passo = Math.max(1, Math.floor(total / nomes.length));
          return nomes.map((nome, i) => {
            const de = -total + i * passo;
            const ate = i === nomes.length - 1 ? 0 : de + passo - 1;
            return f(`fase-${i + 1}`, nome, de, ate, [[de, `Começar: ${nome}`]]);
          });
        },
      },
    ],
  },
];

export const tipoDe = (id) => TIPOS.find((t) => t.id === id) || null;
export const metodoDe = (tipo, id) => (tipoDe(tipo)?.metodos || []).find((m) => m.id === id) || null;

// Respostas com os padrões de cada campo do tipo.
export function respostasPadrao(tipo) {
  const t = tipoDe(tipo);
  return Object.fromEntries((t?.campos || []).map((c) => [c, CAMPOS[c].padrao]));
}
