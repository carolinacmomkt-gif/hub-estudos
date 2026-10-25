-- YouTube completo: pilares, cortes para Shorts, thumbnails, gravação, edição e IA.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema. (Precisa da 005-youtube.sql antes.)

alter table public.videos add column if not exists pilar text;
alter table public.videos add column if not exists video_origem_id uuid;      -- Short que saiu de um vídeo longo
alter table public.videos add column if not exists thumbs jsonb not null default '[]'::jsonb;   -- opções de thumbnail (Storage)
alter table public.videos add column if not exists detalhes jsonb not null default '{}'::jsonb; -- ideia, gravação, edição, publicação, cortes
