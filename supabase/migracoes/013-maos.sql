-- Bússola: "Com as mãos" (Meu cantinho e Mesinha, 02/11/2026).
-- Desenhos para colorir, desenhos e escrita à mão (traços no mesmo formato dos Cadernos), caligrafia,
-- projetos de crochê (contador, linha, agulha, receita e foto pequena) e ideias de coisas com as mãos.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.
-- Não apaga nada e já liga o RLS (só a dona lê e escreve).

create table if not exists public.maos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('colorir', 'desenhar', 'escrever', 'caligrafia', 'croche', 'ideia')),
  titulo text,
  modelo text,                   -- id do modelo (desenho para colorir, risco, passo a passo, folha)
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create index if not exists maos_sinc_idx on public.maos (user_id, atualizado_em);

create or replace trigger tocar_atualizado_em before insert or update on public.maos
  for each row execute function public.tocar_atualizado_em();

alter table public.maos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'maos' and policyname = 'dona') then
    create policy "dona" on public.maos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
