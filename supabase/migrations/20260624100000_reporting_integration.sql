-- Wayfinder Pro + Joshua Tree Reports integration (ported from jtsg-reports-v2/v2)
-- GA admin_config seeded with production Drive folders and Google Doc templates.

create extension if not exists "uuid-ossp";

-- ============================================
-- CORE REPORTING TABLES (from reports v2)
-- ============================================

create table if not exists public.admin_config (
  id uuid primary key default uuid_generate_v4(),
  drive_folders jsonb not null default '{
    "se_monthly": "",
    "vpr_default": "",
    "vpr_by_stage": {},
    "jtsg_vmr": "",
    "evf": "",
    "jtsg_tsvs": "",
    "signature_temp": ""
  }'::jsonb,
  doc_templates jsonb not null default '{
    "se_monthly": "",
    "vpr": "",
    "jtsg_vmr": "",
    "evf": "",
    "jtsg_tsvs": ""
  }'::jsonb,
  report_notification_recipients text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.admin_config (drive_folders, doc_templates)
select
  '{
    "se_monthly": "1rCJHguAOuLxJaQMLAB78h2QFCgqsRGcd",
    "vpr_default": "1GoPi5vYfFfmdTSqB4eKRf5BNB3-blL0T",
    "vpr_by_stage": {
      "Job Development": "15_oHt88dpFcLZ2XCJZymYVkIMJG94tor",
      "Training / OS 1": "10xAOBeQhnY7owl91g_0-Bd99wykym3GG",
      "Training / OS 2": "1LBzOVcJFCxknXAylwthBcAuGMsWhaD7p",
      "Stabilization / ES": "1GMcU2WTxYnJa46wkP-_HnDzkIMSePCkX",
      "Work Readiness Training": "1NMzxgwe0XbTJCjRjFaizqrMuoVqglx9P",
      "IJP": "1LYLvdC8Jx3RKZlJt_RSolzZ6TlYc7wAL",
      "CWAT": "1GoPi5vYfFfmdTSqB4eKRf5BNB3-blL0T",
      "Job Coaching": "1SJ0q2iiDOrfUpdC2UGIJKQBz0pclOozH",
      "Work Evaluation": "1GoPi5vYfFfmdTSqB4eKRf5BNB3-blL0T"
    },
    "jtsg_vmr": "1s02BOzY2hRVDltHth34TC49xX6Jq5tj1",
    "evf": "1Au9FfLXwiDd1rWLesBwL3Se7gNF4ITv7",
    "jtsg_tsvs": "1jMqtKAWjc25eb-vbnKWwxnS7dDz3ShTK",
    "signature_temp": "1pqLapzpFlVtGAaxJJWLJ2yEirLZ2ReD8"
  }'::jsonb,
  '{
    "se_monthly": "1nLdzRRq6QqYpveZQ7qZX3lU_9zYDUg0xfgvkJoHriag",
    "vpr": "1Ytr6ZJQc-xdVrgibwHQJGr_tmACN0KlJCqQau9_KzlI",
    "jtsg_vmr": "1E0NI24sb28QAPbJ0vIx3hagBcpQHXvpsL6bzvb7lzKg",
    "evf": "1Ih7HCIsRrv4IcVAw8yxNSE8k9n_fhE6aQHT4HnqXXzk",
    "jtsg_tsvs": "1M_ShNpk7HgLAtehKohUxB5SzqTwoOSdi"
  }'::jsonb
where not exists (select 1 from public.admin_config limit 1);

create table if not exists public.report_user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin', 'supervisor')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id)
);

create index if not exists idx_report_user_roles_user_id on public.report_user_roles(user_id);
create index if not exists idx_report_user_roles_role on public.report_user_roles(role);

create table if not exists public.vpr_submissions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  client_name text not null,
  service_stage text not null,
  employment_specialist_name text not null,
  notes text,
  user_email text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_vpr_submissions_date on public.vpr_submissions(date);
create index if not exists idx_vpr_submissions_client on public.vpr_submissions(client_name);
create index if not exists idx_vpr_submissions_service_stage on public.vpr_submissions(service_stage);
create index if not exists idx_vpr_submissions_submitted_at on public.vpr_submissions(submitted_at);

create table if not exists public.monthly_se_reports (
  id uuid primary key default uuid_generate_v4(),
  client_id text not null,
  wayfinder_client_id uuid references public.clients(id) on delete set null,
  job_seeker_name text,
  se_specialist_name text,
  se_provider_name text,
  counselor_name text,
  employment_goal text,
  date_range_covers text,
  hours_of_coaching text,
  model text,
  medical_considerations text,
  behavioral_health_considerations text,
  sensory text,
  assistive_technology text,
  release_of_information text,
  job_development text,
  ongoing_supports text,
  potential_barriers text,
  extended_services text,
  last_submitted timestamptz not null default now(),
  last_submitted_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_monthly_se_reports_client_id on public.monthly_se_reports(client_id);
create index if not exists idx_monthly_se_reports_wayfinder_client on public.monthly_se_reports(wayfinder_client_id);
create index if not exists idx_monthly_se_reports_last_submitted on public.monthly_se_reports(last_submitted);

create table if not exists public.report_jobs (
  id uuid primary key default uuid_generate_v4(),
  report_type text not null check (report_type in ('seMonthly', 'vpr', 'jtsgvmr', 'evf', 'jtsgtsvs')),
  report_data jsonb not null,
  typed_es_name text,
  signature_data text,
  user_email text not null,
  status text not null default 'pending' check (status in ('pending', 'complete', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_report_jobs_status on public.report_jobs(status);
create index if not exists idx_report_jobs_created_at on public.report_jobs(created_at);

-- ============================================
-- EXTENDED CATALOG + SUBMISSION METADATA
-- ============================================

create table if not exists public.report_service_programs (
  id uuid primary key default uuid_generate_v4(),
  state text not null check (state in ('GA', 'TN')),
  name text not null,
  slug text not null,
  enabled boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state, slug)
);

create table if not exists public.report_type_definitions (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid references public.report_service_programs(id) on delete set null,
  state text not null check (state in ('GA', 'TN')),
  slug text not null,
  name text not null,
  enabled boolean not null default false,
  requires_signature boolean not null default false,
  counselor_allowed boolean not null default false,
  template_kind text not null default 'google_doc'
    check (template_kind in ('google_doc', 'pdf_upload', 'pdf_generate')),
  google_doc_template_id text,
  blank_pdf_file_id text,
  drive_folder_id text,
  tag_schema jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state, slug)
);

create table if not exists public.formal_report_submissions (
  id uuid primary key default uuid_generate_v4(),
  wayfinder_client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  state text not null check (state in ('GA', 'TN')),
  report_type_slug text not null,
  reporting_month text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text,
  drive_file_id text,
  drive_file_name text,
  field_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_formal_report_submissions_client on public.formal_report_submissions(wayfinder_client_id);
create index if not exists idx_formal_report_submissions_month on public.formal_report_submissions(reporting_month);
create index if not exists idx_formal_report_submissions_type on public.formal_report_submissions(report_type_slug);

create table if not exists public.report_dashboard_alerts (
  id uuid primary key default uuid_generate_v4(),
  alert_type text not null check (alert_type in ('missing', 'overdue')),
  state text not null check (state in ('GA', 'TN')),
  report_type_slug text not null,
  reporting_month text not null,
  wayfinder_client_id uuid references public.clients(id) on delete cascade,
  client_name text not null,
  es_user_id uuid references auth.users(id) on delete cascade,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_dashboard_alerts_es on public.report_dashboard_alerts(es_user_id);
create index if not exists idx_report_dashboard_alerts_open on public.report_dashboard_alerts(resolved_at)
  where resolved_at is null;

-- Tennessee VR program catalog (disabled until templates are configured in admin)
insert into public.report_service_programs (state, name, slug, enabled, sort_order)
values
  ('TN', 'Vocational Assessments', 'vocational-assessments', false, 10),
  ('TN', 'Job Coaching', 'job-coaching', false, 20),
  ('TN', 'Supported Employment', 'supported-employment', false, 30),
  ('TN', 'Customized Employment', 'customized-employment', false, 40),
  ('TN', 'Vocational Adjustment', 'vocational-adjustment', false, 50),
  ('TN', 'Trial Work Experiences', 'trial-work-experiences', false, 60),
  ('TN', 'Job Readiness / Job Placement', 'job-readiness-job-placement', false, 70),
  ('TN', 'Individual Placement and Support', 'individual-placement-and-support', false, 80),
  ('TN', 'Project SEARCH', 'project-search', false, 90)
on conflict (state, slug) do nothing;

-- ============================================
-- ACCESS HELPERS
-- ============================================

create or replace function public.is_report_org_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('es', 'supervisor', 'admin', 'super_admin')
  );
$$;

create or replace function public.is_report_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'admin')
  )
  or exists (
    select 1
    from public.report_user_roles r
    where r.user_id = auth.uid()
  );
$$;

create or replace function public.is_report_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
  or exists (
    select 1
    from public.report_user_roles r
    where r.user_id = auth.uid()
      and r.role = 'superadmin'
  );
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.admin_config enable row level security;
alter table public.report_user_roles enable row level security;
alter table public.vpr_submissions enable row level security;
alter table public.monthly_se_reports enable row level security;
alter table public.report_jobs enable row level security;
alter table public.report_service_programs enable row level security;
alter table public.report_type_definitions enable row level security;
alter table public.formal_report_submissions enable row level security;
alter table public.report_dashboard_alerts enable row level security;

drop policy if exists "Report admins manage admin_config" on public.admin_config;
create policy "Report admins manage admin_config"
  on public.admin_config for all
  using (public.is_report_admin_user())
  with check (public.is_report_admin_user());

drop policy if exists "Report superadmin manages report_user_roles" on public.report_user_roles;
create policy "Report superadmin manages report_user_roles"
  on public.report_user_roles for all
  using (public.is_report_superadmin())
  with check (public.is_report_superadmin());

drop policy if exists "Report org users insert vpr" on public.vpr_submissions;
create policy "Report org users insert vpr"
  on public.vpr_submissions for insert
  with check (public.is_report_org_user());

drop policy if exists "Report admins read vpr" on public.vpr_submissions;
create policy "Report admins read vpr"
  on public.vpr_submissions for select
  using (public.is_report_admin_user());

drop policy if exists "Report org users manage monthly_se_reports" on public.monthly_se_reports;
create policy "Report org users manage monthly_se_reports"
  on public.monthly_se_reports for all
  using (public.is_report_org_user())
  with check (public.is_report_org_user());

drop policy if exists "Report org users insert report_jobs" on public.report_jobs;
create policy "Report org users insert report_jobs"
  on public.report_jobs for insert
  with check (public.is_report_org_user());

drop policy if exists "Report org users read report_jobs" on public.report_jobs;
create policy "Report org users read report_jobs"
  on public.report_jobs for select
  using (public.is_report_org_user());

drop policy if exists "Report org users read programs" on public.report_service_programs;
create policy "Report org users read programs"
  on public.report_service_programs for select
  using (public.is_report_org_user());

drop policy if exists "Report admins manage programs" on public.report_service_programs;
create policy "Report admins manage programs"
  on public.report_service_programs for all
  using (public.is_report_admin_user())
  with check (public.is_report_admin_user());

drop policy if exists "Report org users read report types" on public.report_type_definitions;
create policy "Report org users read report types"
  on public.report_type_definitions for select
  using (public.is_report_org_user() and enabled = true);

drop policy if exists "Report admins manage report types" on public.report_type_definitions;
create policy "Report admins manage report types"
  on public.report_type_definitions for all
  using (public.is_report_admin_user())
  with check (public.is_report_admin_user());

drop policy if exists "Report org users read submissions" on public.formal_report_submissions;
create policy "Report org users read submissions"
  on public.formal_report_submissions for select
  using (public.is_report_org_user());

drop policy if exists "Report org users insert submissions" on public.formal_report_submissions;
create policy "Report org users insert submissions"
  on public.formal_report_submissions for insert
  with check (public.is_report_org_user());

drop policy if exists "Report org users read own alerts" on public.report_dashboard_alerts;
create policy "Report org users read own alerts"
  on public.report_dashboard_alerts for select
  using (
    public.is_report_org_user()
    and (
      es_user_id = auth.uid()
      or public.is_report_admin_user()
    )
  );

drop policy if exists "Report admins manage alerts" on public.report_dashboard_alerts;
create policy "Report admins manage alerts"
  on public.report_dashboard_alerts for all
  using (public.is_report_admin_user())
  with check (public.is_report_admin_user());

-- Supervisor invites for reports admin portal (legacy reports v2 flow)
create table if not exists public.supervisor_invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.supervisor_invites enable row level security;

drop policy if exists "Report superadmin manages supervisor_invites" on public.supervisor_invites;
create policy "Report superadmin manages supervisor_invites"
  on public.supervisor_invites for all
  using (public.is_report_superadmin())
  with check (public.is_report_superadmin());

