-- Fix infinite recursion on public.profiles RLS.
-- Cause: policies on profiles referenced clients/counselors whose policies
-- read profiles again. SECURITY DEFINER alone is not enough on Supabase when
-- FORCE RLS applies — helpers must SET row_security = off and own-profile
-- checks must not subquery profiles.

-- Remove every SELECT policy on profiles (including legacy/custom names).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      pol.policyname
    );
  end loop;
end $$;

-- Role lookup for staff policies on other tables (never re-enter profiles RLS).
create or replace function public.get_auth_user_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_role text;
begin
  set local row_security = off;
  select role into found_role
  from public.profiles
  where id = auth.uid()
  limit 1;
  return found_role;
end;
$$;

create or replace function public.auth_user_has_staff_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in (
      'es',
      'supervisor',
      'accountant',
      'admin',
      'counselor'
    ),
    false
  );
$$;

create or replace function public.auth_user_has_es_staff_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in ('es', 'supervisor', 'admin'),
    false
  );
$$;

-- Single profiles SELECT policy: own row first (no subqueries), then staff paths.
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
    where cli.user_id = target_id
  )
  or exists (
    select 1
    from public.es_client_assignments e
    join public.clients c on c.id = e.client_id
    where e.es_user_id = auth.uid()
      and c.user_id = target_id
  )
  or exists (
    select 1
    from public.support_client_assignments s
    join public.clients c on c.id = s.client_id
    where s.support_user_id = auth.uid()
      and c.user_id = target_id
  );
end;
$$;

revoke all on function public.get_auth_user_role() from public;
revoke all on function public.auth_user_has_staff_role() from public;
revoke all on function public.auth_user_has_es_staff_role() from public;
revoke all on function public.profile_visible_to_auth_user(uuid) from public;

grant execute on function public.get_auth_user_role() to authenticated;
grant execute on function public.auth_user_has_staff_role() to authenticated;
grant execute on function public.auth_user_has_es_staff_role() to authenticated;
grant execute on function public.profile_visible_to_auth_user(uuid) to authenticated;

create policy "profiles_select_visible"
  on public.profiles
  for select
  to authenticated
  using (public.profile_visible_to_auth_user(id));

-- Other tables: staff checks use role helpers (no direct profiles subquery).
drop policy if exists "offices_select_staff" on public.offices;
create policy "offices_select_staff"
  on public.offices for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "counselors_select_staff" on public.counselors;
create policy "counselors_select_staff"
  on public.counselors for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "services_select_staff" on public.services;
create policy "services_select_staff"
  on public.services for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "service_milestones_select_staff" on public.service_milestones;
create policy "service_milestones_select_staff"
  on public.service_milestones for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "contact_logs_insert_staff_es" on public.contact_logs;
create policy "contact_logs_insert_staff_es"
  on public.contact_logs for insert to authenticated
  with check (public.auth_user_has_es_staff_role());

drop policy if exists "applications_insert_staff_es" on public.applications;
create policy "applications_insert_staff_es"
  on public.applications for insert to authenticated
  with check (public.auth_user_has_es_staff_role());
