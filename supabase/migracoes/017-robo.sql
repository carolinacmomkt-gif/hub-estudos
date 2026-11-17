-- Robô do Google da R7 (Carol, 17/11/2026): um Google Apps Script que roda de graça na conta dela lê o
-- Drive (briefings e vídeos editados) e o Trello da R7 (só leitura) e entrega o resumo aqui, sem passar
-- pela Netlify. A porta é esta função: ela só grava em config "r7-robo:<tipo>" de quem tem o código do
-- robô (o app guarda só o SHA-256 dele em config "robo_r7"; gerar outro desliga o anterior).
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo → Run. Pode rodar de novo.

create or replace function public.receber_do_robo(codigo text, tipo text, dados jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  dona uuid;
begin
  if codigo is null or length(codigo) < 24 then
    raise exception 'código inválido';
  end if;
  if tipo not in ('videos', 'trello') then
    raise exception 'tipo inválido';
  end if;
  if dados is null or pg_column_size(dados) > 1500000 then
    raise exception 'dados vazios ou grandes demais';
  end if;
  select c.user_id into dona
    from public.config c
   where c.chave = 'robo_r7'
     and c.excluido_em is null
     and c.valor->>'hash' = encode(sha256(convert_to(codigo, 'UTF8')), 'hex')
   limit 1;
  if dona is null then
    raise exception 'código não reconhecido';
  end if;
  insert into public.config (user_id, chave, valor)
  values (dona, 'r7-robo:' || tipo, jsonb_build_object('recebido_em', now(), 'dados', dados))
  on conflict (user_id, chave)
  do update set valor = excluded.valor, atualizado_em = now(), excluido_em = null;
  return 'ok';
end;
$$;

revoke all on function public.receber_do_robo(text, text, jsonb) from public;
grant execute on function public.receber_do_robo(text, text, jsonb) to anon, authenticated;
