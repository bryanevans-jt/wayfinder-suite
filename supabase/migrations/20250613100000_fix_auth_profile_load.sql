-- Auth routing: ensure signed-in users can always load their own profile for middleware.

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

revoke all on function public.get_auth_user_profile() from public;
grant execute on function public.get_auth_user_profile() to authenticated;

-- Belt-and-suspenders: own-row SELECT in addition to profiles_select_visible.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Ensure super_admin counts as staff for RLS helpers on older databases.
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
      'counselor',
      'super_admin'
    ),
    false
  );
$$;

grant execute on function public.auth_user_has_staff_role() to authenticated;

-- Reassert super admin account (idempotent).
insert into public.profiles (id, role, is_active)
select u.id, 'super_admin'::public.user_role, true
from auth.users u
where lower(u.email) = lower('bryan.evans@thejoshuatree.org')
on conflict (id) do update
  set role = excluded.role,
      is_active = excluded.is_active;

insert into public.system_protected_profiles (profile_id, protection_level)
select id, 'super_admin'
from auth.users
where lower(email) = lower('bryan.evans@thejoshuatree.org')
on conflict (profile_id) do nothing;
