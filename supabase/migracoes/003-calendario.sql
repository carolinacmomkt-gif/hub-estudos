-- Etapa 4b: importar o calendário acadêmico com a IA.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

-- Cada leitura de calendário (PDF ou texto colado) vira uma linha. A função grava aqui
-- o que a IA encontrou; o app mostra para a Carol revisar e só então cria os eventos.
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'calendario' check (tipo in ('calendario', 'questoes', 'artigo')),
  status text not null default 'lendo' check (status in ('lendo', 'pronto', 'erro')),
  arquivo text,      -- caminho do PDF no Storage (apagado depois da leitura)
  texto text,        -- ou o texto colado
  curso text,        -- dica opcional para a IA (ex.: "Psicologia")
  resultado jsonb,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

drop trigger if exists tocar_atualizado_em on public.importacoes;
create trigger tocar_atualizado_em before insert or update on public.importacoes
  for each row execute function public.tocar_atualizado_em();

alter table public.importacoes enable row level security;
drop policy if exists "dona" on public.importacoes;
create policy "dona" on public.importacoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
