-- Gerador de pauta (Trabalho → Pautas): a IA escreve a legenda olhando as artes, em segundo plano,
-- e grava o resultado em importacoes. Só acrescenta o tipo 'pauta' (e mantém 'relatorio' da 014).
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

alter table public.importacoes drop constraint if exists importacoes_tipo_check;
alter table public.importacoes add constraint importacoes_tipo_check
  check (tipo in ('calendario', 'questoes', 'artigo', 'relatorio', 'pauta'));
