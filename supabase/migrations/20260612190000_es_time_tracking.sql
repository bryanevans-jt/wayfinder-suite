-- ES time tracking: activity catalog, per-service time entries, weekly submissions.
-- Counselors, clients, and supports never receive SELECT policies on these tables.

create table if not exists public.service_activity_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state_code text,
  category text not null,
  name text not null,
  description text,
  default_minutes int not null,
  min_minutes int not null,
  max_minutes int not null,
  requires_client boolean not null default true,
  requires_narrative boolean not null default true,
  is_billable boolean not null default true,
  wayfinder_source_hint text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  create type public.es_time_linked_source as enum (
    'contact_log',
    'application',
    'stage_event',
    'meeting',
    'message_thread',
    'employer',
    'natural_support',
    'manual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.es_time_entry_status as enum (
    'draft',
    'submitted',
    'approved',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.es_time_week_status as enum (
    'open',
    'submitted',
    'approved',
    'returned'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.es_time_week_submissions (
  id uuid primary key default gen_random_uuid(),
  es_user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_minutes int not null default 0,
  status public.es_time_week_status not null default 'open',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  supervisor_notes text,
  created_at timestamptz not null default now(),
  unique (es_user_id, week_start)
);

create index if not exists es_time_week_submissions_es_idx
  on public.es_time_week_submissions (es_user_id, week_start desc);

create table if not exists public.es_time_entries (
  id uuid primary key default gen_random_uuid(),
  es_user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  activity_type_id uuid not null references public.service_activity_types (id),
  service_date date not null,
  duration_minutes int not null,
  narrative text,
  linked_source_type public.es_time_linked_source,
  linked_source_id uuid,
  status public.es_time_entry_status not null default 'draft',
  week_submission_id uuid references public.es_time_week_submissions (id) on delete set null,
  flags jsonb not null default '{}'::jsonb,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null
);

create index if not exists es_time_entries_es_date_idx
  on public.es_time_entries (es_user_id, service_date desc);

create index if not exists es_time_entries_client_idx
  on public.es_time_entries (client_id, service_date desc);

create index if not exists es_time_entries_week_idx
  on public.es_time_entries (week_submission_id);

create or replace function public.auth_user_can_access_time_tracking()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in (
      'es',
      'supervisor',
      'accountant',
      'admin',
      'super_admin'
    ),
    false
  );
$$;

create or replace function public.auth_user_can_view_es_time(target_es_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      public.get_auth_user_role() = 'es'
      and auth.uid() = target_es_user_id
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and target_es_user_id in (select public.auth_user_supervised_es_ids())
    )
    or public.get_auth_user_role() in ('accountant', 'admin', 'super_admin'),
    false
  );
$$;

grant execute on function public.auth_user_can_access_time_tracking() to authenticated;
grant execute on function public.auth_user_can_view_es_time(uuid) to authenticated;

alter table public.service_activity_types enable row level security;
alter table public.es_time_entries enable row level security;
alter table public.es_time_week_submissions enable row level security;

drop policy if exists service_activity_types_select on public.service_activity_types;
create policy service_activity_types_select on public.service_activity_types
  for select to authenticated
  using (public.auth_user_can_access_time_tracking());

drop policy if exists service_activity_types_admin on public.service_activity_types;
create policy service_activity_types_admin on public.service_activity_types
  for all to authenticated
  using (public.auth_user_is_admin_tier())
  with check (public.auth_user_is_admin_tier());

drop policy if exists es_time_entries_select on public.es_time_entries;
create policy es_time_entries_select on public.es_time_entries
  for select to authenticated
  using (public.auth_user_can_view_es_time(es_user_id));

drop policy if exists es_time_entries_insert on public.es_time_entries;
create policy es_time_entries_insert on public.es_time_entries
  for insert to authenticated
  with check (
    es_user_id = auth.uid()
    and public.get_auth_user_role() = 'es'
    and status = 'draft'
  );

drop policy if exists es_time_entries_update on public.es_time_entries;
create policy es_time_entries_update on public.es_time_entries
  for update to authenticated
  using (
    (
      es_user_id = auth.uid()
      and public.get_auth_user_role() = 'es'
      and status in ('draft', 'rejected')
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and es_user_id in (select public.auth_user_supervised_es_ids())
    )
    or public.auth_user_is_admin_tier()
  );

drop policy if exists es_time_week_submissions_select on public.es_time_week_submissions;
create policy es_time_week_submissions_select on public.es_time_week_submissions
  for select to authenticated
  using (public.auth_user_can_view_es_time(es_user_id));

drop policy if exists es_time_week_submissions_insert on public.es_time_week_submissions;
create policy es_time_week_submissions_insert on public.es_time_week_submissions
  for insert to authenticated
  with check (es_user_id = auth.uid() and public.get_auth_user_role() = 'es');

drop policy if exists es_time_week_submissions_update on public.es_time_week_submissions;
create policy es_time_week_submissions_update on public.es_time_week_submissions
  for update to authenticated
  using (
    (
      es_user_id = auth.uid()
      and public.get_auth_user_role() = 'es'
      and status in ('open', 'returned')
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and es_user_id in (select public.auth_user_supervised_es_ids())
    )
    or public.auth_user_is_admin_tier()
  );

-- Seed Joshua Tree internal activity catalog (state_code nullable until contract mapping).
-- Defaults capped at 30 min; minimum entry 5 min. Removed types stay inactive if re-seeded.
insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, wayfinder_source_hint, sort_order, active)
values
  ('JT-INT-001', 'Intake & planning', 'Initial Intake Meeting', 30, 5, 60, true, 'contact_log · meeting', 10, true),
  ('JT-INT-002', 'Intake & planning', 'Individualized service plan development', 30, 5, 90, true, 'contact_log · stage_event', 20, false),
  ('JT-INT-003', 'Intake & planning', 'Referral and eligibility review', 20, 5, 45, true, 'contact_log', 30, false),
  ('JT-CON-010', 'Client contact', 'Client phone contact', 15, 5, 45, true, 'contact_log', 110, true),
  ('JT-CON-011', 'Client contact', 'Client in-person contact', 30, 5, 90, true, 'contact_log', 120, true),
  ('JT-CON-012', 'Client contact', 'Client video / telehealth contact', 30, 5, 60, true, 'contact_log', 130, true),
  ('JT-CON-013', 'Client contact', 'Client secure messaging', 15, 5, 30, true, 'client_messages', 140, true),
  ('JT-CON-014', 'Client contact', 'Scheduled client meeting', 30, 5, 120, true, 'client_meeting_requests', 150, true),
  ('JT-CON-015', 'Client contact', 'Home or community-based visit', 30, 5, 120, true, 'contact_log', 160, false),
  ('JT-EMP-020', 'Employment prep', 'Job search planning session', 30, 5, 90, true, 'contact_log', 210, true),
  ('JT-EMP-021', 'Employment prep', 'Résumé and cover letter development', 30, 5, 120, true, 'contact_log', 220, true),
  ('JT-EMP-022', 'Employment prep', 'Application completion assistance', 30, 5, 90, true, 'applications', 230, true),
  ('JT-EMP-023', 'Employment prep', 'Interview preparation', 30, 5, 90, true, 'contact_log', 240, true),
  ('JT-EMP-024', 'Employment prep', 'Mock interview / practice session', 30, 5, 60, true, 'contact_log', 250, true),
  ('JT-EMP-025', 'Employment prep', 'Job search coaching', 30, 5, 90, true, 'contact_log', 260, true),
  ('JT-EMP-026', 'Employment prep', 'Job canvassing / labor market survey', 30, 5, 180, true, 'contact_log', 270, true),
  ('JT-EMP-027', 'Employment prep', 'Employability / skills assessment', 30, 5, 90, true, 'contact_log', 280, true),
  ('JT-JOB-030', 'Job development', 'Employer job development call', 20, 5, 45, true, 'contact_log · employer_network', 310, true),
  ('JT-JOB-031', 'Job development', 'Employer site visit or meeting', 30, 5, 120, true, 'contact_log · employer', 320, true),
  ('JT-JOB-032', 'Job development', 'Employer relationship maintenance', 20, 5, 45, true, 'contact_log · employer', 330, true),
  ('JT-JOB-033', 'Job development', 'Job lead review with client', 20, 5, 45, true, 'contact_log', 340, true),
  ('JT-JOB-034', 'Job development', 'Interview scheduling coordination', 15, 5, 30, true, 'contact_log', 350, true),
  ('JT-PLC-040', 'Placement & retention', 'Job placement documentation', 30, 5, 60, true, 'applications · contact_log', 410, true),
  ('JT-PLC-041', 'Placement & retention', 'On-the-job check-in (client)', 30, 5, 60, true, 'contact_log', 420, true),
  ('JT-PLC-042', 'Placement & retention', 'Employer follow-up — job performance', 20, 5, 45, true, 'contact_log · employer', 430, true),
  ('JT-PLC-043', 'Placement & retention', 'Retention follow-up (30/60/90 day)', 30, 5, 45, true, 'contact_log', 440, false),
  ('JT-PLC-044', 'Placement & retention', 'Workplace accommodation support', 30, 5, 90, true, 'contact_log', 450, true),
  ('JT-PLC-045', 'Placement & retention', 'Job separation / offboarding support', 30, 5, 90, true, 'contact_log', 460, true),
  ('JT-CSE-050', 'Case coordination', 'Milestone / stage update', 15, 5, 30, true, 'client_stage_events', 510, true),
  ('JT-CSE-051', 'Case coordination', 'Case file review / documentation', 30, 5, 60, true, 'contact_log', 520, true),
  ('JT-CSE-052', 'Case coordination', 'Benefits and work-incentive counseling', 30, 5, 90, true, 'contact_log', 530, false),
  ('JT-CSE-053', 'Case coordination', 'Inter-agency coordination', 30, 5, 60, true, 'contact_log', 540, true),
  ('JT-CSE-054', 'Case coordination', 'Natural support coordination', 30, 5, 60, true, 'natural_support_contacts', 550, true),
  ('JT-CSE-055', 'Case coordination', 'Crisis / urgent client intervention', 30, 5, 120, true, 'contact_log', 560, true),
  ('JT-TRV-060', 'Travel', 'Client-related travel time', 30, 5, 120, true, 'manual', 610, true),
  ('JT-ADM-070', 'Non-client (internal)', 'Team meeting / staff supervision', 30, 5, 120, false, 'manual', 710, true),
  ('JT-ADM-071', 'Non-client (internal)', 'Training / professional development', 30, 5, 240, false, 'manual', 720, true),
  ('JT-ADM-072', 'Non-client (internal)', 'Administrative / overhead', 30, 5, 120, false, 'manual', 730, true)
on conflict (code) do nothing;
