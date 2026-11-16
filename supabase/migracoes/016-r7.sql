-- R7 como quarta casa do Trabalho (decisão da Carol, 16/11/2026).
-- 1) 'r7' na lista de casas de clientes_trabalho.
-- 2) acessos_clientes: senhas e códigos de reserva dos clientes, criptografados pelas funções
--    (TOKEN_CRYPTO_KEY). RLS ligado e NENHUMA política: nem o app consegue ler; só as funções,
--    com a chave service_role, e só quando a Carol toca em "Mostrar".
-- 3) o tipo 'voz' em importacoes (leitura do tom de voz em segundo plano).
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

alter table public.clientes_trabalho drop constraint if exists clientes_trabalho_casa_check;
alter table public.clientes_trabalho add constraint clientes_trabalho_casa_check
  check (casa in ('essence', 'confluir', 'minha', 'r7'));

create table if not exists public.acessos_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente text not null,          -- chave do cliente em clientes_trabalho
  rotulo text not null,           -- "Instagram", "Códigos de reserva"…
  dados_cifrados text not null,   -- { usuario, senha, observacao } cifrado
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists acessos_clientes_cliente_ix on public.acessos_clientes (user_id, cliente);
alter table public.acessos_clientes enable row level security;
drop trigger if exists tocar_atualizado_em on public.acessos_clientes;
create trigger tocar_atualizado_em before insert or update on public.acessos_clientes
  for each row execute function public.tocar_atualizado_em();

alter table public.importacoes drop constraint if exists importacoes_tipo_check;
alter table public.importacoes add constraint importacoes_tipo_check
  check (tipo in ('calendario', 'questoes', 'artigo', 'relatorio', 'pauta', 'voz'));
