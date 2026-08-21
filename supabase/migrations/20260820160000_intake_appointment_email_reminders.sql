-- Intake appointment fields on hospitality tasks + email/SMS-ready reminder ledger.

alter table public.hospitality_intake_tasks
  add column if not exists appointment_starts_at timestamptz,
  add column if not exists appointment_location text,
  add column if not exists appointment_timezone text default 'America/New_York';

comment on column public.hospitality_intake_tasks.appointment_starts_at is
  'Scheduled intake meeting start (client reminder source of truth).';
comment on column public.hospitality_intake_tasks.appointment_location is
  'Intake meeting location shown in client reminders.';
comment on column public.hospitality_intake_tasks.appointment_timezone is
  'IANA timezone used when formatting appointment times in reminders.';

create table if not exists public.intake_appointment_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  hospitality_task_id uuid not null references public.hospitality_intake_tasks (id) on delete cascade,
  reminder_kind text not null,
  channel text not null default 'email',
  sent_at timestamptz not null default now(),
  constraint intake_appointment_reminder_kind_allowed check (
    reminder_kind in ('scheduled', 'day_before', 'hour_before')
  ),
  constraint intake_appointment_reminder_channel_allowed check (
    channel in ('email', 'sms')
  ),
  unique (hospitality_task_id, reminder_kind, channel)
);

create index if not exists intake_appointment_reminder_sends_task_idx
  on public.intake_appointment_reminder_sends (hospitality_task_id);

alter table public.intake_appointment_reminder_sends enable row level security;

revoke all on table public.intake_appointment_reminder_sends from anon, authenticated;
grant all on table public.intake_appointment_reminder_sends to service_role;

comment on table public.intake_appointment_reminder_sends is
  'Dedupes intake appointment reminders per channel (email now; sms later).';
