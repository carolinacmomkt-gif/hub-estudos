-- Etapa 4c: avisos no aparelho (Web Push) e plano de estudo para provas.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

-- Sessões de revisão do plano de estudo viram eventos do tipo "revisao", ligados à prova.
-- (A lista já inclui os tipos das migrações 005 e 007, para rodar esta de novo não desfazer aquelas.)
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('prova', 'trabalho', 'atividade', 'aula', 'feriado', 'pessoal', 'revisao', 'youtube', 'substack'));
alter table public.eventos add column if not exists prova_id uuid;
create index if not exists eventos_prova_idx on public.eventos (prova_id) where prova_id is not null;

-- Aparelhos que recebem avisos (um por navegador em que a Carol ativou).
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

drop trigger if exists tocar_atualizado_em on public.assinaturas_push;
create trigger tocar_atualizado_em before insert or update on public.assinaturas_push
  for each row execute function public.tocar_atualizado_em();
alter table public.assinaturas_push enable row level security;
drop policy if exists "dona" on public.assinaturas_push;
create policy "dona" on public.assinaturas_push for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Avisos já mandados (para cada prazo sair uma vez só em cada marco: 3 dias, 1 dia, no dia).
-- Só as funções usam: sem políticas, o app não lê nem escreve.
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
