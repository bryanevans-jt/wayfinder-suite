-- Counselor portal: resolve counselor id with RLS off; load clients by counselor row id.

create or replace function public.auth_user_counselor_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_counselor_id uuid;
begin
  v_uid := coalesce(
    auth.uid(),
    nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid
  );

  if v_uid is null then
    return null;
  end if;

  set local row_security = off;

  select c.id into v_counselor_id
  from public.counselors c
  where c.user_id = v_uid
  limit 1;

  return v_counselor_id;
end;
$$;

revoke all on function public.auth_user_counselor_id() from public;
grant execute on function public.auth_user_counselor_id() to authenticated;

drop policy if exists "clients_select_counselor_assigned" on public.clients;
create policy "clients_select_counselor_assigned"
  on public.clients for select to authenticated
  using (
    clients.counselor_id is not null
    and clients.counselor_id = public.auth_user_counselor_id()
  );

create or replace function public.get_counselor_portal_clients_for(p_counselor_id uuid)
returns table (
  id uuid,
  user_id uuid,
  profile_id uuid,
  current_stage_id uuid,
  counselor_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_own_counselor_id uuid;
begin
  if p_counselor_id is null then
    return;
  end if;

  v_uid := coalesce(
    auth.uid(),
    nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid
  );

  v_own_counselor_id := public.auth_user_counselor_id();

  if v_uid is null or v_own_counselor_id is null or v_own_counselor_id <> p_counselor_id then
    return;
  end if;

  set local row_security = off;

  return query
  select
    coalesce(cl.id, cl.profile_id) as id,
    coalesce(cl.user_id, cl.profile_id) as user_id,
    cl.profile_id,
    cl.current_stage_id,
    cl.counselor_id
  from public.clients cl
  where cl.counselor_id = p_counselor_id;
end;
$$;

revoke all on function public.get_counselor_portal_clients_for(uuid) from public;
grant execute on function public.get_counselor_portal_clients_for(uuid) to authenticated;
