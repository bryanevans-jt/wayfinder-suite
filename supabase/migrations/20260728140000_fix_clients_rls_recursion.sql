-- Fix 42P17 infinite recursion on public.clients when evaluating
-- client_message_threads / es_client_assignments policies that re-enter clients RLS.

-- 1) Assignment ownership helper must bypass RLS (was selecting clients under RLS).
create or replace function public.client_owns_es_assignment(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null or p_client_id is null then
    return false;
  end if;

  set local row_security = off;

  return exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and coalesce(c.user_id, c.profile_id) = auth.uid()
  );
end;
$$;

revoke all on function public.client_owns_es_assignment(uuid) from public;
grant execute on function public.client_owns_es_assignment(uuid) to authenticated;

-- 2) Message-thread visibility without querying clients under RLS.
create or replace function public.message_thread_visible_to_auth_user(
  p_client_id uuid,
  p_current_es_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    return false;
  end if;

  set local row_security = off;

  if p_current_es_user_id is not null and p_current_es_user_id = v_uid then
    return true;
  end if;

  if exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and coalesce(c.user_id, c.profile_id) = v_uid
  ) then
    return true;
  end if;

  if p_current_es_user_id is not null and exists (
    select 1
    from public.supervisor_es_assignments s
    where s.supervisor_user_id = v_uid
      and s.es_user_id = p_current_es_user_id
  ) then
    return true;
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_role in ('admin', 'super_admin') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.message_thread_insertable_by_auth_user(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null or p_client_id is null then
    return false;
  end if;

  set local row_security = off;

  return exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and coalesce(c.user_id, c.profile_id) = auth.uid()
  );
end;
$$;

revoke all on function public.message_thread_visible_to_auth_user(uuid, uuid) from public;
revoke all on function public.message_thread_insertable_by_auth_user(uuid) from public;
grant execute on function public.message_thread_visible_to_auth_user(uuid, uuid) to authenticated;
grant execute on function public.message_thread_insertable_by_auth_user(uuid) to authenticated;

drop policy if exists "message_threads_select_participants" on public.client_message_threads;
create policy "message_threads_select_participants"
  on public.client_message_threads for select to authenticated
  using (
    public.message_thread_visible_to_auth_user(client_id, current_es_user_id)
  );

drop policy if exists "message_threads_insert_client" on public.client_message_threads;
create policy "message_threads_insert_client"
  on public.client_message_threads for insert to authenticated
  with check (
    public.message_thread_insertable_by_auth_user(client_id)
  );

-- 3) Client messages: avoid joining clients under RLS (same recursion class).
drop policy if exists "client_messages_select_participants" on public.client_messages;
create policy "client_messages_select_participants"
  on public.client_messages for select to authenticated
  using (
    exists (
      select 1
      from public.client_message_threads t
      where t.id = client_messages.thread_id
        and public.message_thread_visible_to_auth_user(t.client_id, t.current_es_user_id)
    )
  );

drop policy if exists "client_messages_insert_participants" on public.client_messages;
create policy "client_messages_insert_participants"
  on public.client_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and exists (
      select 1
      from public.client_message_threads t
      where t.id = client_messages.thread_id
        and (
          (
            client_messages.sender_role = 'client'
            and public.message_thread_insertable_by_auth_user(t.client_id)
          )
          or (
            client_messages.sender_role = 'es'
            and t.current_es_user_id = (select auth.uid())
          )
          or (
            client_messages.sender_role = 'supervisor'
            and exists (
              select 1
              from public.supervisor_es_assignments s
              where s.supervisor_user_id = (select auth.uid())
                and s.es_user_id = t.current_es_user_id
            )
          )
        )
    )
  );
