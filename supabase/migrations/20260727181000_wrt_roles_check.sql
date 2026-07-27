-- Part 2 of 2: allow transition_specialist + wrt_admin on profiles.role.
-- Run AFTER 20260727180000 has committed.

alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (
  role::text in (
    'client',
    'support',
    'es',
    'supervisor',
    'accountant',
    'admin',
    'counselor',
    'super_admin',
    'hr',
    'hospitality_specialist',
    'transition_specialist',
    'wrt_admin'
  )
);
