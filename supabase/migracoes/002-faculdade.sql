-- Etapa 4a: dados reais da faculdade (AVA + Lyceum)
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema.

-- Disciplina: a mesma matéria do AVA e do Lyceum vira uma linha só.
alter table public.disciplinas add column if not exists nome_ava text;
alter table public.disciplinas add column if not exists nome_lyceum text;
alter table public.disciplinas add column if not exists combinacao_manual boolean not null default false;
alter table public.disciplinas add column if not exists pesos jsonb not null default '{}'::jsonb;  -- calculadora de média (editado no app)
alter table public.disciplinas add column if not exists dados jsonb not null default '{}'::jsonb;  -- média, situação, aulas (vindos do Lyceum)

create unique index if not exists disciplinas_ava_uk on public.disciplinas (user_id, ava_course_id);
create unique index if not exists disciplinas_lyceum_uk on public.disciplinas (user_id, lyceum_cod_disciplina, ano, semestre);
