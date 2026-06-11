-- Counselor portal: list assigned clients without clients-table RLS recursion/denial.
-- Legacy schemas may also store the counselor on a "counselor" column; coalesce in the query.

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
  v_has_counselor_col boolean;
begin
  select c.id into v_counselor_id
  from public.counselors c
  where c.user_id = auth.uid()
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

  set local row_security = off;

  if v_has_counselor_col then
    return query execute
      'select
         cl.id,
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
      cl.id,
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
  v_ok boolean;
  v_has_counselor_col boolean;
begin
  if p_client_id is null then
    return false;
  end if;

  select c.id into v_counselor_id
  from public.counselors c
  where c.user_id = auth.uid()
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

  set local row_security = off;

  if v_has_counselor_col then
    execute
      'select exists (
         select 1 from public.clients cl
         where cl.id = $1
           and coalesce(cl.counselor_id, cl.counselor) = $2
       )'
    into v_ok
    using p_client_id, v_counselor_id;
  else
    select exists (
      select 1 from public.clients cl
      where cl.id = p_client_id
        and cl.counselor_id = v_counselor_id
    )
    into v_ok;
  end if;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.get_counselor_portal_clients() from public;
revoke all on function public.counselor_can_access_client(uuid) from public;

grant execute on function public.get_counselor_portal_clients() to authenticated;
grant execute on function public.counselor_can_access_client(uuid) to authenticated;

-- Backfill legacy counselor column into counselor_id when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'counselor'
  ) then
    execute '
      update public.clients
      set counselor_id = counselor
      where counselor_id is null and counselor is not null
    ';
  end if;
end $$;
