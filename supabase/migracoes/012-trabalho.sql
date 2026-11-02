-- Bússola: grupo Trabalho (o Pauta dentro do Bússola, 01/11/2026).
-- Conteúdos dos calendários do Notion e dos quadros do Trello, clientes da agência (com a ficha e a
-- memória de feedback) e rascunhos do Criar. A cópia do Notion e do Trello é gravada pela função
-- "trabalho"; o caminho da arte (mandei, agendei), a memória e os rascunhos são gravados pelo app.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

-- O Notion do trabalho é uma conexão própria (com permissão de editar os calendários).
alter table public.conexoes drop constraint if exists conexoes_servico_check;
alter table public.conexoes add constraint conexoes_servico_check check (servico in ('ava', 'lyceum', 'trello', 'notion', 'notion_trabalho'));
alter table public.credenciais drop constraint if exists credenciais_servico_check;
alter table public.credenciais add constraint credenciais_servico_check check (servico in ('ava', 'lyceum', 'trello', 'notion', 'notion_trabalho'));

create table if not exists public.conteudos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origem text not null check (origem in ('notion', 'trello')),
  origem_id text not null,       -- id da página do Notion ou do cartão do Trello
  fonte text,                    -- nome do calendário ou "Trello: <quadro>"
  cliente text,                  -- chave do cliente (clientes_trabalho.chave)
  cliente_nome text,
  titulo text not null,
  data date,                     -- data de postagem
  entrega date,                  -- entrega interna (no quadro da designer, o prazo do design)
  status text,                   -- "Liberação" no Notion, a lista no Trello
  formato text,
  url text,
  editado_em timestamptz,
  texto text,
  dados jsonb not null default '{}'::jsonb, -- pilar, objetivo, serie, feedback, link_arte, opcoes, listas, etiquetas, producao, fluxo, mudanca
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create unique index if not exists conteudos_origem_uk on public.conteudos (user_id, origem, origem_id);

create table if not exists public.clientes_trabalho (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null,           -- "dra-anisse"
  nome text not null,
  casa text check (casa in ('essence', 'confluir', 'minha')),
  notion_id text,
  url text,
  dados jsonb not null default '{}'::jsonb, -- status, nicho, instagram, servicos, ficha, memoria [{ id, texto, em, origem }], cor
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create unique index if not exists clientes_trabalho_chave_uk on public.clientes_trabalho (user_id, chave);

create table if not exists public.rascunhos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente text,
  formato text,
  objetivo text,
  tema text,
  texto text,
  conteudo_id uuid,              -- a peça criada no calendário a partir deste rascunho
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['conteudos', 'clientes_trabalho', 'rascunhos'] loop
    execute format('drop trigger if exists tocar_atualizado_em on public.%I', t);
    execute format('create trigger tocar_atualizado_em before insert or update on public.%I for each row execute function public.tocar_atualizado_em()', t);
    execute format('create index if not exists %I on public.%I (user_id, atualizado_em)', t || '_sinc_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dona" on public.%I', t);
    execute format('create policy "dona" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
