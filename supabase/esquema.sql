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
  tipo text not null default 'pessoal' check (tipo in ('prova', 'trabalho', 'atividade', 'aula', 'feriado', 'pessoal')),
  titulo text not null,
  descricao text,
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  status text check (status in ('pendente', 'entregue', 'atrasado')),
  origem text not null default 'manual' check (origem in ('ava', 'ics', 'academico', 'lyceum', 'manual')),
  origem_id text,
  link text,
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
  tipo text not null default 'calendario' check (tipo in ('calendario')),
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
create index if not exists paginas_caderno_idx on public.paginas (caderno_id, ordem);
create index if not exists revisoes_proxima_idx on public.revisoes (user_id, proxima_em) where concluida_em is null;

-- ---------------------------------------------------------------------------
-- Gatilho, índice de sincronização e RLS em todas as tabelas do app
-- ---------------------------------------------------------------------------

do $$
declare
  tabela text;
  tabelas text[] := array[
    'areas', 'disciplinas', 'materiais', 'eventos', 'notas_ava', 'notas_lyceum', 'frequencias',
    'avisos', 'artigos', 'pastas', 'cadernos', 'secoes', 'paginas', 'questoes', 'respostas',
    'revisoes', 'pautas_substack', 'caixa_entrada', 'config', 'conexoes', 'importacoes'
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
