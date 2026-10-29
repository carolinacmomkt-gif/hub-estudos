-- Bússola: livros na Biblioteca (PDF e EPUB) com o leitor estilo Kindle.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema ("if not exists" e "drop ... if exists").

-- Detalhes do livro: formato (pdf/epub), capa pequena, onde parou, marcadores e ajustes.
alter table public.artigos add column if not exists dados jsonb not null default '{}'::jsonb;

-- Tinta da caneta por cima das páginas dos livros em PDF (uma linha por página anotada).
create table if not exists public.livro_paginas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  artigo_id uuid not null references public.artigos (id) on delete cascade,
  pagina integer not null,
  tracos_json jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);
create unique index if not exists livro_paginas_uk on public.livro_paginas (user_id, artigo_id, pagina);

drop trigger if exists tocar_atualizado_em on public.livro_paginas;
create trigger tocar_atualizado_em before insert or update on public.livro_paginas
  for each row execute function public.tocar_atualizado_em();
create index if not exists livro_paginas_sinc_idx on public.livro_paginas (user_id, atualizado_em);
alter table public.livro_paginas enable row level security;
drop policy if exists "dona" on public.livro_paginas;
create policy "dona" on public.livro_paginas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
