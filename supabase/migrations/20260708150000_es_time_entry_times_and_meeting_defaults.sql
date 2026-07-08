-- Optional service start/end timestamps on billable entries.
-- Default in-person and virtual meetings to 60 minutes.

alter table public.es_time_entries
  add column if not exists service_start_at timestamptz,
  add column if not exists service_end_at timestamptz;

update public.service_activity_types
set default_minutes = 60
where code in ('JT-ACT-011', 'JT-ACT-012');
