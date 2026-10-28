-- Bússola: Caixa de demandas (Trello, Notion e mensagens compartilhadas, como as do WhatsApp).
-- O app só LÊ o Trello e o Notion; cada demanda espera o OK da Carol antes de virar tarefa.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema ("drop ... if exists" só recria regras e gatilhos).

-- Trello e Notion passam a ser serviços conectáveis (o segredo fica criptografado em credenciais).
alter table public.conexoes drop constraint if exists conexoes_servico_check;
alter table public.conexoes add constraint conexoes_servico_check check (servico in ('ava', 'lyceum', 'trello', 'notion'));
alter table public.credenciais drop constraint if exists credenciais_servico_check;
alter table public.credenciais add constraint credenciais_servico_check check (servico in ('ava', 'lyceum', 'trello', 'notion'));

create table if not exists public.demandas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origem text not null check (origem in ('trello', 'notion', 'compartilhado', 'manual')),
  origem_id text,          -- id do cartão ou da página (vazio no que veio compartilhado)
  origem_url text,
  titulo text not null,
  detalhe text,
  onde text,               -- "Quadro › Lista" no Trello, nome da base no Notion
  quem text,               -- quem pediu, quando dá para saber
  prazo date,
  hora text,
  minutos smallint,        -- tempo estimado
  prioridade smallint not null default 0,
  status text not null default 'nova' check (status in ('nova', 'aceita', 'descartada')),
  mudou jsonb,             -- o que mudou na origem depois de aceita ({ prazo: { de, para }, titulo: { de, para } })
  tarefa_id uuid,
  assinatura text,         -- resumo do que veio da origem, para saber se mudou
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create unique index if not exists demandas_origem_uk on public.demandas (user_id, origem, origem_id);

drop trigger if exists tocar_atualizado_em on public.demandas;
create trigger tocar_atualizado_em before insert or update on public.demandas
  for each row execute function public.tocar_atualizado_em();
create index if not exists demandas_sinc_idx on public.demandas (user_id, atualizado_em);
alter table public.demandas enable row level security;
drop policy if exists "dona" on public.demandas;
create policy "dona" on public.demandas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
