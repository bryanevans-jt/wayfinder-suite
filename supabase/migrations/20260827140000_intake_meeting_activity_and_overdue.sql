-- Intake Meeting contact-log activity + overdue follow-up notify ledger.

insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable, wayfinder_source_hint, sort_order, active)
values
  (
    'JT-ACT-002',
    'Client meetings',
    'Intake Meeting',
    30,
    30,
    480,
    true,
    true,
    true,
    'contact_log · meeting',
    15,
    true
  )
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  default_minutes = excluded.default_minutes,
  min_minutes = excluded.min_minutes,
  max_minutes = excluded.max_minutes,
  requires_client = excluded.requires_client,
  requires_narrative = excluded.requires_narrative,
  is_billable = excluded.is_billable,
  wayfinder_source_hint = excluded.wayfinder_source_hint,
  sort_order = excluded.sort_order,
  active = true;

create table if not exists public.intake_meeting_overdue_notifies (
  id uuid primary key default gen_random_uuid(),
  hospitality_task_id uuid not null references public.hospitality_intake_tasks (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  notified_at timestamptz not null default now(),
  unique (hospitality_task_id)
);

create index if not exists intake_meeting_overdue_notifies_client_idx
  on public.intake_meeting_overdue_notifies (client_id);

alter table public.intake_meeting_overdue_notifies enable row level security;

revoke all on table public.intake_meeting_overdue_notifies from anon, authenticated;
grant all on table public.intake_meeting_overdue_notifies to service_role;

comment on table public.intake_meeting_overdue_notifies is
  'Dedupes supervisor/admin alerts when a scheduled intake is 24h past with no casework contact log.';
