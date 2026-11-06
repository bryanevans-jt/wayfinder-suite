-- WRT: session block (multi-lesson), staff rubric per client, contact_log link on attendees.

-- One billable block duration for the session; lesson_ids list segments covered this block.
alter table public.wrt_sessions
  add column if not exists session_block_minutes numeric(8, 2),
  add column if not exists lesson_ids uuid[] default '{}'::uuid[];

comment on column public.wrt_sessions.session_block_minutes is
  'Single duration (minutes) for this session block; billing uses block_minutes × present attendee count.';
comment on column public.wrt_sessions.lesson_ids is
  'WRT lesson rows covered in this session block (order preserved).';

-- Staff-only observational rubric (one row per domain per client per session).
create table if not exists public.wrt_session_rubric_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wrt_sessions (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  domain_key text not null,
  level smallint not null,
  notes text,
  scored_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrt_rubric_domain_check check (
    domain_key in (
      'punctuality_attendance',
      'hygiene_presentation',
      'social_communication',
      'task_engagement',
      'receptivity_supervision'
    )
  ),
  constraint wrt_rubric_level_check check (level >= 1 and level <= 3),
  constraint wrt_session_rubric_unique unique (session_id, client_id, domain_key)
);

create index if not exists wrt_session_rubric_session_idx
  on public.wrt_session_rubric_rows (session_id);

create index if not exists wrt_session_rubric_client_idx
  on public.wrt_session_rubric_rows (client_id, created_at desc);

alter table public.wrt_session_rubric_rows enable row level security;

-- Link attendee row to the contact log created for that client's WRT block time.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wrt_session_attendees_contact_log_id_fkey'
  ) then
    alter table public.wrt_session_attendees
      add constraint wrt_session_attendees_contact_log_id_fkey
      foreign key (contact_log_id) references public.contact_logs (id) on delete set null;
  end if;
end $$;
