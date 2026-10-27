-- Hub de Estudos da Carol: esquema do banco (Supabase / Postgres)
--
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- Pode rodar de novo sem problema: tudo usa "if not exists" / "or replace".
--
-- Regras:
-- - Toda tabela tem user_id e RLS: cada linha só é vista e alterada pela dona (auth.uid()).
-- - atualizado_em é preenchido pelo banco a cada mudança; o app usa isso para sincronizar.
-- - Excluir = preencher excluido_em (o app esconde e a lixeira consegue desfazer).
-- - credenciais (token do AVA e senha do Lyceum, criptografados) não tem nenhuma política:
--   nem o app consegue ler. Só as Netlify Functions, com a chave service_role.

create extension if not exists pgcrypto;

-- Atualiza atualizado_em em toda inserção/alteração.
-- clock_timestamp() (e não now()) para cada linha de um lote ter um horário diferente.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------------

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  cor text,
  descricao text,
  tipo text not null default 'tema',          -- 'trilha' ou 'tema' (Estudos gerais)
  itens jsonb not null default '[]'::jsonb,   -- etapas da trilha
  meta jsonb not null default '{}'::jsonb,
  icone text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  nome text not null,
  ava_course_id bigint,
  lyceum_cod_disciplina text,
  turma text,
  professor text,
  ano integer,
  semestre integer,
  cor text,
  arquivada boolean not null default false,
  nome_ava text,
  nome_lyceum text,
  combinacao_manual boolean not null default false,
  pesos jsonb not null default '{}'::jsonb, -- calculadora de média (editado no app)
  dados jsonb not null default '{}'::jsonb, -- média, situação, aulas (vindos do Lyceum)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Faculdade (AVA e Lyceum)
-- ---------------------------------------------------------------------------

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete cascade,
  origem text not null default 'ava' check (origem in ('ava', 'biblioteca', 'manual')),
  origem_id text,
  titulo text not null,
  tipo text,
  url text,
  arquivo_path text,
  fixado boolean not null default false,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  tipo text not null default 'pessoal' check (tipo in ('prova', 'trabalho', 'atividade', 'aula', 'feriado', 'pessoal', 'revisao', 'youtube', 'substack')),
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  status text check (status in ('pendente', 'entregue', 'atrasado')),
  origem text not null default 'manual' check (origem in ('ava', 'ics', 'academico', 'lyceum', 'manual', 'youtube', 'substack')),
  origem_id text,
  link text,
  prova_id uuid,  -- sessão de revisão: a prova a que pertence
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.notas_ava (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete cascade,
  ava_course_id bigint,
  origem_id text,
  item text not null,
  nota numeric,
  nota_maxima numeric,
  peso numeric,
  data timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.notas_lyceum (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete cascade,
  origem_id text,
  cod_disciplina text,
  nome_disciplina text,
  ano integer,
  semestre integer,
  prova text not null,
  ordem integer,
  nota numeric,
  nota_maxima numeric,
  oficial boolean,
  data_nota timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.frequencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete cascade,
  origem_id text,
  cod_disciplina text,
  nome_disciplina text,
  ano integer,
  semestre integer,
  carga_horaria numeric,
  aulas_previstas integer,
  aulas_ministradas integer,
  faltas numeric,
  faltas_permitidas numeric,
  percentual_presenca numeric,
  faltas_manuais integer not null default 0, -- contador do próprio Hub ("faltei hoje")
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  origem text not null check (origem in ('ava', 'lyceum')),
  origem_id text,
  titulo text not null,
  texto text,
  data timestamptz,
  lido boolean not null default false,
  link text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Biblioteca
-- ---------------------------------------------------------------------------

create table if not exists public.artigos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  titulo text not null,
  url text,
  autor text,
  texto text,
  pdf_path text,
  tags text[] not null default '{}',
  status text not null default 'ler' check (status in ('ler', 'lendo', 'lido', 'fichado')),
  destaques jsonb not null default '[]'::jsonb,
  notas text,
  fonte text not null default 'texto',        -- 'link', 'pdf' ou 'texto'
  resumo text,
  fichamento jsonb not null default '{}'::jsonb,
  favorito boolean not null default false,
  lido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Cadernos
-- ---------------------------------------------------------------------------

create table if not exists public.pastas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pai_id uuid references public.pastas (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  nome text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.cadernos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pasta_id uuid references public.pastas (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  titulo text not null,
  tipo text not null default 'comum' check (tipo in ('comum', 'materia', 'fichario', 'pdf', 'infinito', 'planner')),
  capa jsonb not null default '{}'::jsonb,
  tamanho text not null default 'A4',
  orientacao text not null default 'retrato' check (orientacao in ('retrato', 'paisagem')),
  tags text[] not null default '{}',
  favorito boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.secoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caderno_id uuid not null references public.cadernos (id) on delete cascade,
  titulo text not null,
  cor text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.paginas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caderno_id uuid not null references public.cadernos (id) on delete cascade,
  secao_id uuid references public.secoes (id) on delete set null,
  ordem integer not null default 0,
  modelo_folha text not null default 'branco',
  tracos_json jsonb not null default '{"versao":1,"camadas":[]}'::jsonb,
  miniatura_url text,
  largura numeric,
  altura numeric,
  pdf_path text,
  pdf_pagina integer,
  marcador boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Questões
-- ---------------------------------------------------------------------------

create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  tipo text not null check (tipo in ('multipla', 'vf', 'dissertativa')),
  enunciado text not null,
  alternativas jsonb not null default '[]'::jsonb,
  resposta_correta text,
  explicacao text,
  fontes jsonb not null default '[]'::jsonb,
  nivel text,
  tags text[] not null default '{}',
  origem jsonb not null default '{}'::jsonb,
  acertos integer not null default 0,
  erros integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  questao_id uuid not null references public.questoes (id) on delete cascade,
  modo text check (modo in ('prova', 'fixacao', 'revisao')),
  resposta text,
  correta boolean,
  nota numeric,
  comentario text,
  respondida_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  questao_id uuid not null references public.questoes (id) on delete cascade,
  etapa integer not null default 0, -- 0, 1, 2, 3 = revisar em 1, 3, 7 e 15 dias
  proxima_em date not null,
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Substack, caixa de entrada e configurações
-- ---------------------------------------------------------------------------

create table if not exists public.pautas_substack (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  etapa text not null default 'ideia' check (etapa in ('ideia', 'rascunho', 'revisao', 'publicado')),
  texto text,
  referencias uuid[] not null default '{}',
  link text,
  publicado_em timestamptz,
  subtitulo text,
  notas text,
  tags text[] not null default '{}',
  agendado_para timestamptz,
  checklist jsonb not null default '{}'::jsonb,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.caixa_entrada (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto text not null,
  destino text, -- para onde a ideia foi: pauta, evento, artigo…
  processado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null,
  valor jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (user_id, chave)
);

-- Situação das conexões com o AVA e o Lyceum (o app só lê; as funções escrevem).
create table if not exists public.conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  servico text not null check (servico in ('ava', 'lyceum')),
  status text not null default 'desconectado' check (status in ('conectado', 'desconectado', 'erro', 'reconectar')),
  conectado_em timestamptz,
  ultima_sincronizacao timestamptz,
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (user_id, servico)
);

-- Leituras do calendário acadêmico com a IA (a Carol revisa antes de virar evento).
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'calendario' check (tipo in ('calendario', 'questoes', 'artigo')),
  status text not null default 'lendo' check (status in ('lendo', 'pronto', 'erro')),
  arquivo text,      -- caminho do PDF no Storage (apagado depois da leitura)
  texto text,        -- ou o texto colado
  curso text,        -- dica opcional para a IA
  resultado jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- Questões: simulados (prova, fixação e revisão).
create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  modo text not null default 'prova' check (modo in ('prova', 'fixacao', 'revisao')),
  questoes uuid[] not null default '{}',
  respostas jsonb not null default '{}'::jsonb,
  acertos integer,
  total integer,
  nota numeric,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- Sessões de foco (cronômetro) para o resumo da semana.
create table if not exists public.sessoes_foco (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text,
  disciplina_id uuid references public.disciplinas (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  inicio timestamptz not null,
  fim timestamptz not null,
  minutos integer not null default 0,
  concluida boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists sessoes_foco_inicio_idx on public.sessoes_foco (user_id, inicio);

-- YouTube: vídeos do canal, da ideia ao publicado.
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  titulos_alternativos text[] not null default '{}',
  formato text not null default 'longo' check (formato in ('longo', 'short', 'live')),
  serie text,
  etapa text not null default 'ideia' check (etapa in ('ideia', 'pesquisa', 'roteiro', 'gravacao', 'edicao', 'pos', 'agendado', 'publicado')),
  prioridade integer not null default 2 check (prioridade between 1 and 3),
  data_gravacao date,
  data_publicacao timestamptz,
  gancho text,
  publico text,
  ideia_thumb text,
  roteiro jsonb not null default '{"blocos":[]}'::jsonb,
  descricao text,
  tags text[] not null default '{}',
  checklist jsonb not null default '{}'::jsonb,
  link text,
  metricas jsonb not null default '{}'::jsonb,
  notas text,
  pilar text,
  video_origem_id uuid,
  thumbs jsonb not null default '[]'::jsonb,
  detalhes jsonb not null default '{}'::jsonb,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- Aparelhos que recebem avisos (Web Push).
create table if not exists public.assinaturas_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  unique (user_id, endpoint)
);

-- Avisos já mandados (cada prazo sai uma vez em cada marco). Só as funções usam.
create table if not exists public.avisos_enviados (
  user_id uuid not null references auth.users (id) on delete cascade,
  evento_id uuid not null,
  marco text not null check (marco in ('3d', '1d', 'dia')),
  data_evento timestamptz not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, evento_id, marco, data_evento)
);
alter table public.avisos_enviados enable row level security;
revoke all on public.avisos_enviados from anon, authenticated;

-- Segredos criptografados (AES-256-GCM, chave TOKEN_CRYPTO_KEY só na Netlify).
create table if not exists public.credenciais (
  user_id uuid not null references auth.users (id) on delete cascade,
  servico text not null check (servico in ('ava', 'lyceum')),
  dados_cifrados text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, servico)
);

-- Registros que vêm de fora (AVA/Lyceum) não podem duplicar.
create unique index if not exists materiais_origem_uk on public.materiais (user_id, origem, origem_id);
create unique index if not exists eventos_origem_uk on public.eventos (user_id, origem, origem_id);
create unique index if not exists notas_ava_origem_uk on public.notas_ava (user_id, origem_id);
create unique index if not exists notas_lyceum_origem_uk on public.notas_lyceum (user_id, origem_id);
create unique index if not exists frequencias_origem_uk on public.frequencias (user_id, origem_id);
create unique index if not exists avisos_origem_uk on public.avisos (user_id, origem, origem_id);
create unique index if not exists disciplinas_ava_uk on public.disciplinas (user_id, ava_course_id);
create unique index if not exists disciplinas_lyceum_uk on public.disciplinas (user_id, lyceum_cod_disciplina, ano, semestre);
create index if not exists eventos_prova_idx on public.eventos (prova_id) where prova_id is not null;
create index if not exists paginas_caderno_idx on public.paginas (caderno_id, ordem);
create index if not exists revisoes_proxima_idx on public.revisoes (user_id, proxima_em) where concluida_em is null;

-- Áreas de vida (Bússola): cada tabela tem um campo "dados" para os detalhes.
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  area text not null default 'pessoal',
  status text not null default 'ativo',
  cor text,
  prazo date,
  notas text,
  ordem integer not null default 0,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  notas text,
  projeto_id uuid references public.projetos (id) on delete set null,
  area text not null default 'pessoal',
  data date,
  prazo date,
  hora text,
  prioridade smallint not null default 0,
  feita_em timestamptz,
  recorrencia jsonb,
  ordem integer not null default 0,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists tarefas_data_idx on public.tarefas (user_id, data);

create table if not exists public.habitos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  icone text,
  cor text,
  periodo text not null default 'qualquer',
  frequencia jsonb not null default '{"tipo": "diario"}'::jsonb,
  meta numeric,
  unidade text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.habito_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id uuid not null references public.habitos (id) on delete cascade,
  data date not null,
  valor numeric not null default 1,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists habito_registros_data_idx on public.habito_registros (user_id, data);

create table if not exists public.diario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  humor smallint,
  energia smallint,
  texto text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists diario_data_idx on public.diario (user_id, data);

create table if not exists public.saude (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,
  data date not null,
  inicio timestamptz,
  valor numeric,
  unidade text,
  notas text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists saude_data_idx on public.saude (user_id, data);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  status text not null default 'ativo',
  inicio date,
  fim date,
  valor_mensal numeric(12, 2),
  notas text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.consultoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  tipo text not null,
  data date not null,
  titulo text not null,
  texto text,
  valor numeric(12, 2),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.financas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'saida',
  valor numeric(12, 2) not null,
  data date not null,
  descricao text,
  categoria text,
  origem text,
  conta text,
  cliente_id uuid references public.clientes (id) on delete set null,
  pago boolean not null default true,
  recorrencia jsonb,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create index if not exists financas_data_idx on public.financas (user_id, data);

create table if not exists public.casa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  lista text,
  data date,
  feito_em timestamptz,
  recorrencia jsonb,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  area text,
  prazo date,
  alvo numeric,
  atual numeric,
  unidade text,
  status text not null default 'ativa',
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create table if not exists public.lazer (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  status text not null default 'quero',
  nota smallint,
  data date,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

-- ---------------------------------------------------------------------------
-- Gatilho, índice de sincronização e RLS em todas as tabelas do app
-- ---------------------------------------------------------------------------

do $$
declare
  tabela text;
  tabelas text[] := array[
    'areas', 'disciplinas', 'materiais', 'eventos', 'notas_ava', 'notas_lyceum', 'frequencias',
    'avisos', 'artigos', 'pastas', 'cadernos', 'secoes', 'paginas', 'questoes', 'respostas',
    'revisoes', 'pautas_substack', 'caixa_entrada', 'config', 'conexoes', 'importacoes', 'assinaturas_push', 'videos', 'simulados', 'sessoes_foco',
    'projetos', 'tarefas', 'habitos', 'habito_registros', 'diario', 'saude', 'clientes', 'consultoria', 'financas', 'casa', 'metas', 'lazer'
  ];
begin
  foreach tabela in array tabelas loop
    execute format('drop trigger if exists tocar_atualizado_em on public.%I', tabela);
    execute format('create trigger tocar_atualizado_em before insert or update on public.%I
                    for each row execute function public.tocar_atualizado_em()', tabela);
    execute format('create index if not exists %I on public.%I (user_id, atualizado_em)', tabela || '_sinc_idx', tabela);
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "dona" on public.%I', tabela);
    if tabela = 'conexoes' then
      execute format('create policy "dona" on public.%I for select to authenticated using (user_id = auth.uid())', tabela);
    else
      execute format('create policy "dona" on public.%I for all to authenticated
                      using (user_id = auth.uid()) with check (user_id = auth.uid())', tabela);
    end if;
  end loop;
end;
$$;

drop trigger if exists tocar_atualizado_em on public.credenciais;
create trigger tocar_atualizado_em before insert or update on public.credenciais
  for each row execute function public.tocar_atualizado_em();
alter table public.credenciais enable row level security;
-- Sem nenhuma política: anon e authenticated não leem nem escrevem.
revoke all on public.credenciais from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: PDFs, imagens e páginas de caderno (pasta = id da usuária)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

drop policy if exists "arquivos da dona" on storage.objects;
create policy "arquivos da dona" on storage.objects for all to authenticated
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
