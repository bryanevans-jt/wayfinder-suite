-- Counselor portal RPC: resolve auth user reliably and read clients with RLS off.

drop policy if exists "clients_select_counselor_assigned" on public.clients;
create policy "clients_select_counselor_assigned"
  on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = clients.counselor_id
        and c.user_id = (select auth.uid())
    )
  );

create or replace function public.get_counselor_portal_clients()
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
  v_counselor_id uuid;
  v_uid uuid;
  v_has_counselor_col boolean;
begin
  v_uid := coalesce(
    auth.uid(),
    nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid
  );

  if v_uid is null then
    return;
  end if;

  set local row_security = off;

  select c.id into v_counselor_id
  from public.counselors c
  where c.user_id = v_uid
  limit 1;

  if v_counselor_id is null then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'counselor'
  )
  into v_has_counselor_col;

  if v_has_counselor_col then
    return query execute
      'select
         coalesce(cl.id, cl.profile_id) as id,
         coalesce(cl.user_id, cl.profile_id) as user_id,
         cl.profile_id,
         cl.current_stage_id,
         coalesce(cl.counselor_id, cl.counselor) as counselor_id
       from public.clients cl
       where coalesce(cl.counselor_id, cl.counselor) = $1'
    using v_counselor_id;
  else
    return query
    select
      coalesce(cl.id, cl.profile_id) as id,
      coalesce(cl.user_id, cl.profile_id) as user_id,
      cl.profile_id,
      cl.current_stage_id,
      cl.counselor_id
    from public.clients cl
    where cl.counselor_id = v_counselor_id;
  end if;
end;
$$;

create or replace function public.counselor_can_access_client(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counselor_id uuid;
  v_uid uuid;
  v_ok boolean;
  v_has_counselor_col boolean;
begin
  if p_client_id is null then
    return false;
  end if;

  v_uid := coalesce(
    auth.uid(),
    nullif(trim(current_setting('request.jwt.claim.sub', true)), '')::uuid
  );

  if v_uid is null then
    return false;
  end if;

  set local row_security = off;

  select c.id into v_counselor_id
  from public.counselors c
  where c.user_id = v_uid
  limit 1;

  if v_counselor_id is null then
    return false;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'counselor'
  )
  into v_has_counselor_col;

  if v_has_counselor_col then
    execute
      'select exists (
         select 1 from public.clients cl
         where (cl.id = $1 or cl.profile_id = $1)
           and coalesce(cl.counselor_id, cl.counselor) = $2
       )'
    into v_ok
    using p_client_id, v_counselor_id;
  else
    select exists (
      select 1 from public.clients cl
      where (cl.id = p_client_id or cl.profile_id = p_client_id)
        and cl.counselor_id = v_counselor_id
    )
    into v_ok;
  end if;

  return coalesce(v_ok, false);
end;
$$;

-- Legacy clients: profile may live on profile_id, not user_id.
create or replace function public.profile_visible_to_auth_user(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_id is null then
    return false;
  end if;

  if target_id = auth.uid() then
    return true;
  end if;

  set local row_security = off;

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
