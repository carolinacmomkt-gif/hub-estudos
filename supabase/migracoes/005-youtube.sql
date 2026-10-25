-- YouTube: planejamento dos vídeos (ideia → publicado), roteiros e datas.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

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
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

drop trigger if exists tocar_atualizado_em on public.videos;
create trigger tocar_atualizado_em before insert or update on public.videos
  for each row execute function public.tocar_atualizado_em();
create index if not exists videos_sinc_idx on public.videos (user_id, atualizado_em);
alter table public.videos enable row level security;
drop policy if exists "dona" on public.videos;
create policy "dona" on public.videos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- As datas de gravação e de publicação viram eventos do Calendário (com avisos).
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('prova', 'trabalho', 'atividade', 'aula', 'feriado', 'pessoal', 'revisao', 'youtube', 'substack'));
alter table public.eventos drop constraint if exists eventos_origem_check;
alter table public.eventos add constraint eventos_origem_check
  check (origem in ('ava', 'ics', 'academico', 'lyceum', 'manual', 'youtube', 'substack'));
