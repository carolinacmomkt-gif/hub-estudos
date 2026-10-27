-- Bússola: tabelas das áreas de vida (tarefas e projetos, hábitos, diário, saúde, finanças,
-- casa, consultoria, metas e lazer). Cada uma tem as colunas principais e um campo "dados"
-- (jsonb) para os detalhes, assim o app cresce sem precisar de migração nova a cada ajuste.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

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

do $$
declare
  tabela text;
begin
  foreach tabela in array array['projetos', 'tarefas', 'habitos', 'habito_registros', 'diario', 'saude',
                                 'clientes', 'consultoria', 'financas', 'casa', 'metas', 'lazer'] loop
    execute format('drop trigger if exists tocar_atualizado_em on public.%I', tabela);
    execute format('create trigger tocar_atualizado_em before insert or update on public.%I
                    for each row execute function public.tocar_atualizado_em()', tabela);
    execute format('create index if not exists %I on public.%I (user_id, atualizado_em)', tabela || '_sinc_idx', tabela);
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "dona" on public.%I', tabela);
    execute format('create policy "dona" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', tabela);
  end loop;
end;
$$;
