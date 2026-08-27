-- Soft-removed staff (e.g. Employment Specialists) stay in Auth/profiles
-- but are hidden from day-to-day Team lists until a Super Admin restores them.
-- Distinct from silent-add "Inactive" (is_active false, staff_removed_at null).

alter table public.profiles
  add column if not exists staff_removed_at timestamptz;

comment on column public.profiles.staff_removed_at is
  'Set when an admin soft-removes staff from the app; cleared on Super Admin restore.';
