-- Biblioteca, Questões, Substack e Estudos gerais.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema. (Rode antes as migrações 003 a 006.)

-- Biblioteca: de onde veio o texto, resumo, fichamento e favoritos.
alter table public.artigos add column if not exists fonte text not null default 'texto';
alter table public.artigos add column if not exists resumo text;
alter table public.artigos add column if not exists fichamento jsonb not null default '{}'::jsonb;
alter table public.artigos add column if not exists favorito boolean not null default false;
alter table public.artigos add column if not exists lido_em timestamptz;

-- Questões: simulados (modo prova, fixação e revisão) com nota e respostas.
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
drop trigger if exists tocar_atualizado_em on public.simulados;
create trigger tocar_atualizado_em before insert or update on public.simulados
  for each row execute function public.tocar_atualizado_em();
create index if not exists simulados_sinc_idx on public.simulados (user_id, atualizado_em);
alter table public.simulados enable row level security;
drop policy if exists "dona" on public.simulados;
create policy "dona" on public.simulados for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Substack: subtítulo, notas de margem, tags, agendamento e checklist.
alter table public.pautas_substack add column if not exists subtitulo text;
alter table public.pautas_substack add column if not exists notas text;
alter table public.pautas_substack add column if not exists tags text[] not null default '{}';
alter table public.pautas_substack add column if not exists agendado_para timestamptz;
alter table public.pautas_substack add column if not exists checklist jsonb not null default '{}'::jsonb;
alter table public.pautas_substack add column if not exists detalhes jsonb not null default '{}'::jsonb;

-- Estudos gerais: trilhas e temas (com etapas, meta e descrição).
alter table public.areas add column if not exists descricao text;
alter table public.areas add column if not exists tipo text not null default 'tema';
alter table public.areas add column if not exists itens jsonb not null default '[]'::jsonb;
alter table public.areas add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.areas add column if not exists icone text;

-- Leituras em segundo plano com a IA: também questões e textos de PDF.
alter table public.importacoes drop constraint if exists importacoes_tipo_check;
alter table public.importacoes add constraint importacoes_tipo_check check (tipo in ('calendario', 'questoes', 'artigo'));

-- Datas do Substack no Calendário.
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('prova', 'trabalho', 'atividade', 'aula', 'feriado', 'pessoal', 'revisao', 'youtube', 'substack'));
alter table public.eventos drop constraint if exists eventos_origem_check;
alter table public.eventos add constraint eventos_origem_check
  check (origem in ('ava', 'ics', 'academico', 'lyceum', 'manual', 'youtube', 'substack'));
