-- Hotfix: get_auth_user_profile / profile_visible_to_auth_user used STABLE + SET LOCAL,
-- which Postgres rejects ("SET is not allowed in a non-volatile function").

create or replace function public.get_auth_user_profile()
returns table (role text, is_active boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  set local row_security = off;

  return query
  select p.role::text, coalesce(p.is_active, true)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
end;
$$;

create or replace function public.profile_visible_to_auth_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  set local row_security = off;

  if target_id is null then
    return false;
  end if;

  if target_id = auth.uid() then
    return true;
  end if;

  return exists (
    select 1
    from public.clients cli
    join public.counselors cou
      on cou.id = cli.counselor_id
     and cou.user_id = auth.uid()
    where coalesce(cli.user_id, cli.profile_id) = target_id
  )
  or exists (
    select 1
    from public.es_client_assignments e
    join public.clients c on c.id = e.client_id
    where e.es_user_id = auth.uid()
      and coalesce(c.user_id, c.profile_id) = target_id
  )
  or exists (
    select 1
    from public.support_client_assignments s
    join public.clients c on c.id = s.client_id
    where s.support_user_id = auth.uid()
      and coalesce(c.user_id, c.profile_id) = target_id
  );
end;
$$;

revoke all on function public.get_auth_user_profile() from public;
revoke all on function public.profile_visible_to_auth_user(uuid) from public;
grant execute on function public.get_auth_user_profile() to authenticated;
grant execute on function public.profile_visible_to_auth_user(uuid) to authenticated;
