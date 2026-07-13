-- Part 2 of 2: allow hr + hospitality_specialist on profiles.role.
-- Run AFTER 20260713161000 has committed (new enum values are visible).

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
    'hospitality_specialist'
  )
);
