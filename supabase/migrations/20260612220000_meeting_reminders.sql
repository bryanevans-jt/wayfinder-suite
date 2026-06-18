-- Track meeting reminder dispatches (day-before / hour-before) per recipient.
create table if not exists public.meeting_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.client_meeting_requests (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  reminder_kind text not null,
  sent_at timestamptz not null default now(),
  constraint meeting_reminder_kind_allowed check (
    reminder_kind in ('day_before', 'hour_before')
  ),
  unique (meeting_id, recipient_user_id, reminder_kind)
);

create index if not exists meeting_reminder_sends_meeting_idx
  on public.meeting_reminder_sends (meeting_id);

alter table public.meeting_reminder_sends enable row level security;
