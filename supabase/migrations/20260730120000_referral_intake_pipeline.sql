-- Referral intake pipeline: intake status, profile fields, docs, hospitality tasks, training flag.

-- Counselors: optional office + contact email for directory-only (no Wayfinder login yet)
alter table public.counselors
  alter column office_id drop not null;

alter table public.counselors
  add column if not exists contact_email text;

create unique index if not exists counselors_contact_email_uidx
  on public.counselors (lower(trim(contact_email)))
  where contact_email is not null and length(trim(contact_email)) > 0;

-- Clients: intake + referral demographics / auth
alter table public.clients
  add column if not exists intake_status text not null default 'active',
  add column if not exists intake_status_changed_at timestamptz,
  add column if not exists referral_state text,
  add column if not exists referred_at timestamptz,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists ethnicity text,
  add column if not exists race text,
  add column if not exists disability_history text,
  add column if not exists meeting_preference text,
  add column if not exists counselor_availability text,
  add column if not exists authorization_number text,
  add column if not exists authorization_override_reason text,
  add column if not exists last_activity_at timestamptz;

alter table public.clients
  drop constraint if exists clients_intake_status_check;

alter table public.clients
  add constraint clients_intake_status_check
  check (intake_status in ('new_referral', 'pending_authorization', 'active', 'discarded'));

alter table public.clients
  drop constraint if exists clients_referral_state_check;

alter table public.clients
  add constraint clients_referral_state_check
  check (referral_state is null or referral_state in ('GA', 'TN'));

update public.clients
set last_activity_at = coalesce(last_activity_at, created_at, now())
where last_activity_at is null;

update public.clients
set intake_status_changed_at = coalesce(intake_status_changed_at, created_at, now())
where intake_status_changed_at is null;

create index if not exists clients_intake_status_idx
  on public.clients (intake_status, intake_status_changed_at);

create index if not exists clients_last_activity_at_idx
  on public.clients (last_activity_at);

-- Referral documents
create table if not exists public.client_referral_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('authorizations', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists client_referral_documents_client_idx
  on public.client_referral_documents (client_id);

alter table public.client_referral_documents enable row level security;

-- Intake audit events
create table if not exists public.client_intake_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  from_value text,
  to_value text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_intake_events_client_idx
  on public.client_intake_events (client_id, created_at desc);

alter table public.client_intake_events enable row level security;

-- Hospitality intake call queue (GA TSE Phase 1)
create table if not exists public.hospitality_intake_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  unique (client_id)
);

create index if not exists hospitality_intake_tasks_status_created_idx
  on public.hospitality_intake_tasks (status, created_at);

alter table public.hospitality_intake_tasks enable row level security;

-- Training phase + referral notify email on admin_config (reports singleton; also used by staff)
alter table public.admin_config
  add column if not exists referral_training_phase boolean not null default true,
  add column if not exists referral_notify_email text;

-- Ensure a config row exists for staff app reads
insert into public.admin_config (referral_training_phase)
select true
where not exists (select 1 from public.admin_config);

-- Storage bucket for referral uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referral-docs',
  'referral-docs',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Seed missing services used by referral forms (minimal stages)
-- service_milestones.name is NOT NULL in this environment — set name = title.
do $$
declare
  sid uuid;
  milestone_count int;
begin
  -- Job Coaching (GA)
  select id into sid from public.services where name = 'Job Coaching (GA)' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('Job Coaching (GA)', 'GA') returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Closed', 'Closed');
  end if;

  -- Workplace Readiness Training (GA)
  select id into sid from public.services where name = 'Workplace Readiness Training (GA)' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('Workplace Readiness Training (GA)', 'GA') returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Closed', 'Closed');
  end if;

  -- Job Coaching (TN)
  select id into sid from public.services where name = 'Job Coaching (TN)' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('Job Coaching (TN)', 'TN') returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Closed', 'Closed');
  end if;

  -- Job Readiness Training (TN)
  select id into sid from public.services where name = 'Job Readiness Training (TN)' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('Job Readiness Training (TN)', 'TN') returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Closed', 'Closed');
  end if;
end $$;
