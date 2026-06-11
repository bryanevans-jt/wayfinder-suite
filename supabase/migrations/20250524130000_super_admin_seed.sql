-- Step 3 of 3: run AFTER 20250524100000 (enum) and 20250524120000 (schema bootstrap).

-- Legacy DBs may have enum user_role AND an outdated profiles_role_allowed check.
alter table public.profiles drop constraint if exists profiles_role_allowed;

-- Auth user may exist without a profiles row (legacy / manual auth setup).
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

