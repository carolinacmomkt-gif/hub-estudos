-- Artes do Trello da R7 pelo robô do Google (Carol, 17/11/2026): o robô guarda as imagens anexadas pelos
-- designers num lugar próprio do Storage ("robo-r7"), numa pasta com o nome do SHA-256 do código do robô
-- (o mesmo que fica em config "robo_r7"). Só quem tem o código grava ali; só a dona do código lê e apaga.
-- A Bússola copia cada arte (reduzida) para a pasta dela em "arquivos" e apaga a original.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

insert into storage.buckets (id, name, public)
values ('robo-r7', 'robo-r7', false)
on conflict (id) do nothing;

create or replace function public.robo_pasta_valida(pasta text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.config c
     where c.chave = 'robo_r7' and c.excluido_em is null and c.valor->>'hash' = pasta
  );
$$;

revoke all on function public.robo_pasta_valida(text) from public;
grant execute on function public.robo_pasta_valida(text) to anon, authenticated;

drop policy if exists "robo guarda artes" on storage.objects;
create policy "robo guarda artes" on storage.objects
  for insert to anon
  with check (bucket_id = 'robo-r7' and public.robo_pasta_valida((storage.foldername(name))[1]));

drop policy if exists "dona le artes do robo" on storage.objects;
create policy "dona le artes do robo" on storage.objects
  for select to authenticated
  using (bucket_id = 'robo-r7' and exists (
    select 1 from public.config c
     where c.user_id = auth.uid() and c.chave = 'robo_r7' and c.excluido_em is null
       and c.valor->>'hash' = (storage.foldername(name))[1]));

drop policy if exists "dona apaga artes do robo" on storage.objects;
create policy "dona apaga artes do robo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'robo-r7' and exists (
    select 1 from public.config c
     where c.user_id = auth.uid() and c.chave = 'robo_r7' and c.excluido_em is null
       and c.valor->>'hash' = (storage.foldername(name))[1]));
