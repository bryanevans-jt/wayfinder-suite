-- Pre-ETS domain: districts, schools, students, authorizations, worksheets, sessions.

-- ---------------------------------------------------------------------------
-- Districts & schools
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_districts (
  id uuid primary key default gen_random_uuid(),
  gvra_district_number text not null,
  school_year text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (gvra_district_number, school_year)
);

create table if not exists public.pre_ets_gvra_offices (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.pre_ets_districts (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (district_id, name)
);

create table if not exists public.pre_ets_schools (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.pre_ets_districts (id) on delete cascade,
  gvra_office_id uuid references public.pre_ets_gvra_offices (id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (district_id, name)
);

create index if not exists pre_ets_schools_district_idx on public.pre_ets_schools (district_id);
create index if not exists pre_ets_schools_office_idx on public.pre_ets_schools (gvra_office_id);

-- ---------------------------------------------------------------------------
-- Students & YTD units
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_students (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null,
  full_name text not null,
  school_year text not null,
  primary_school_id uuid references public.pre_ets_schools (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (participant_id, school_year)
);

create index if not exists pre_ets_students_name_idx on public.pre_ets_students (school_year, full_name);
create index if not exists pre_ets_students_pid_idx on public.pre_ets_students (participant_id);

create table if not exists public.pre_ets_student_ytd_units (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.pre_ets_students (id) on delete cascade,
  school_year text not null,
  billable_units integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, school_year)
);

-- ---------------------------------------------------------------------------
-- Worksheet imports (planning + auth match phases)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_worksheet_imports (
  id uuid primary key default gen_random_uuid(),
  district_id uuid references public.pre_ets_districts (id) on delete set null,
  service_month date not null,
  school_year text not null,
  phase text not null check (phase in ('planning', 'auth_match')),
  status text not null default 'parsed'
    check (status in ('parsed', 'approved', 'committed', 'rejected')),
  file_name text,
  parse_result jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  committed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_worksheet_imports_month_idx
  on public.pre_ets_worksheet_imports (service_month desc);

-- ---------------------------------------------------------------------------
-- Program groups (school/group header from worksheet)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_program_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.pre_ets_schools (id) on delete cascade,
  gvra_office_id uuid references public.pre_ets_gvra_offices (id) on delete set null,
  worksheet_import_id uuid references public.pre_ets_worksheet_imports (id) on delete set null,
  service_month date not null,
  header_raw text not null,
  group_name text not null,
  frequency text,
  instructor_name text,
  class_time text,
  service_code text,
  service_label text,
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_program_groups_school_month_idx
  on public.pre_ets_program_groups (school_id, service_month);

-- ---------------------------------------------------------------------------
-- Authorizations (group or individual)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_authorizations (
  id uuid primary key default gen_random_uuid(),
  program_group_id uuid references public.pre_ets_program_groups (id) on delete set null,
  school_id uuid not null references public.pre_ets_schools (id) on delete cascade,
  service_month date not null,
  auth_number text,
  auth_type text not null check (auth_type in ('group', 'individual', 'pending')),
  service_code text not null,
  service_label text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_authorizations_auth_number_idx
  on public.pre_ets_authorizations (auth_number);
create index if not exists pre_ets_authorizations_school_month_idx
  on public.pre_ets_authorizations (school_id, service_month);

-- ---------------------------------------------------------------------------
-- Roster entries (students on an authorization for a month)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_roster_entries (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.pre_ets_authorizations (id) on delete cascade,
  student_id uuid not null references public.pre_ets_students (id) on delete cascade,
  units_approved integer not null default 0,
  class_time text,
  invoice_number text,
  billed_cents integer,
  not_approved boolean not null default false,
  list_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (authorization_id, student_id)
);

create index if not exists pre_ets_roster_entries_student_idx
  on public.pre_ets_roster_entries (student_id);

-- ---------------------------------------------------------------------------
-- Staff school assignments
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_staff_school_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.pre_ets_schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assignment_role text not null default 'primary'
    check (assignment_role in ('primary', 'co_instructor', 'supervisor')),
  created_at timestamptz not null default now(),
  unique (school_id, user_id, assignment_role)
);

-- ---------------------------------------------------------------------------
-- Sessions & attendance
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_sessions (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.pre_ets_authorizations (id) on delete cascade,
  school_id uuid not null references public.pre_ets_schools (id) on delete cascade,
  program_group_id uuid references public.pre_ets_program_groups (id) on delete set null,
  session_date date,
  start_time time,
  end_time time,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  primary_instructor_user_id uuid references public.profiles (id) on delete set null,
  co_instructor_user_id uuid references public.profiles (id) on delete set null,
  instructor_name text,
  cancelled_reason text,
  rescheduled_from_session_id uuid references public.pre_ets_sessions (id) on delete set null,
  signed_roster_drive_file_id text,
  signed_roster_uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_sessions_date_idx on public.pre_ets_sessions (session_date desc);
create index if not exists pre_ets_sessions_auth_idx on public.pre_ets_sessions (authorization_id);

create table if not exists public.pre_ets_session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pre_ets_sessions (id) on delete cascade,
  student_id uuid not null references public.pre_ets_students (id) on delete cascade,
  roster_entry_id uuid references public.pre_ets_roster_entries (id) on delete set null,
  present boolean not null default false,
  signed_on_roster boolean not null default false,
  unique (session_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Lesson activity reports (instructor-authored drafts)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_activity_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pre_ets_sessions (id) on delete cascade unique,
  session_date date,
  lesson_topic text,
  learning_objective text,
  lesson_structure text,
  students_on_time boolean,
  students_engaged boolean,
  students_participated boolean,
  students_disruptive boolean,
  faculty_present boolean,
  additional_notes text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'late_submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Session schedule plans (supervisor recurring/custom dates per group)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_schedule_plans (
  id uuid primary key default gen_random_uuid(),
  program_group_id uuid not null references public.pre_ets_program_groups (id) on delete cascade,
  plan_type text not null check (plan_type in ('recurring', 'monthly', 'custom', 'intensive')),
  recurrence_rule jsonb not null default '{}'::jsonb,
  excluded_months text[] not null default '{}'::text[],
  planned_service_code text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- Service-role-only access (staff APIs enforce RBAC).
do $$
declare
  t text;
  tables text[] := array[
    'pre_ets_districts',
    'pre_ets_gvra_offices',
    'pre_ets_schools',
    'pre_ets_students',
    'pre_ets_student_ytd_units',
    'pre_ets_worksheet_imports',
    'pre_ets_program_groups',
    'pre_ets_authorizations',
    'pre_ets_roster_entries',
    'pre_ets_staff_school_assignments',
    'pre_ets_sessions',
    'pre_ets_session_attendance',
    'pre_ets_activity_reports',
    'pre_ets_schedule_plans'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;
