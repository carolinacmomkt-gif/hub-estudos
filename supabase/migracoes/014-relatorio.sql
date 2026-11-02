-- Relatório de métricas (Trabalho → Relatórios): a IA lê os prints do Instagram em segundo plano
-- e grava o resultado em importacoes, como no calendário acadêmico. Só acrescenta o tipo 'relatorio'.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

alter table public.importacoes drop constraint if exists importacoes_tipo_check;
alter table public.importacoes add constraint importacoes_tipo_check
  check (tipo in ('calendario', 'questoes', 'artigo', 'relatorio'));
