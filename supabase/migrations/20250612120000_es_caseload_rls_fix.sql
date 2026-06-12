-- ES caseload: avoid RLS recursion on es_client_assignments and resolve client profile ids.

create or replace function public.client_owns_es_assignment(p_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and coalesce(c.user_id, c.profile_id) = auth.uid()
  );
$$;

revoke all on function public.client_owns_es_assignment(uuid) from public;
grant execute on function public.client_owns_es_assignment(uuid) to authenticated;

drop policy if exists "es_client_assignments_select_own_client" on public.es_client_assignments;
create policy "es_client_assignments_select_own_client"
  on public.es_client_assignments for select to authenticated
  using (public.client_owns_es_assignment(client_id));

drop policy if exists "es_assignments_select_own" on public.es_client_assignments;
create policy "es_assignments_select_own"
  on public.es_client_assignments for select to authenticated
  using (es_user_id = (select auth.uid()));

-- Fix: inline ES policy on profiles caused infinite RLS recursion with clients policies.
-- Replaced by security-definer profile_visible_to_auth_user (row_security off at entry).

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

drop policy if exists "profiles_select_for_es_clients" on public.profiles;
