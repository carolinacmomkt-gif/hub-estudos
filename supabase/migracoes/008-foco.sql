-- Sessões de foco (cronômetro tipo Pomodoro) para o resumo da semana.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

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
drop trigger if exists tocar_atualizado_em on public.sessoes_foco;
create trigger tocar_atualizado_em before insert or update on public.sessoes_foco
  for each row execute function public.tocar_atualizado_em();
create index if not exists sessoes_foco_sinc_idx on public.sessoes_foco (user_id, atualizado_em);
create index if not exists sessoes_foco_inicio_idx on public.sessoes_foco (user_id, inicio);
alter table public.sessoes_foco enable row level security;
drop policy if exists "dona" on public.sessoes_foco;
create policy "dona" on public.sessoes_foco for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
