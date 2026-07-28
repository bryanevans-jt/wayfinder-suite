-- WRT facilitation tables (enrollment, sessions, progress).
-- Opt-in enrollments only — does not auto-enroll existing Workplace Readiness clients.
-- Add billable activity type for WRT contact/time logging.

insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable, wayfinder_source_hint, sort_order, active)
values
  (
    'JT-ACT-070',
    'Employment services',
    'Workplace Readiness Training',
    30,
    5,
    180,
    true,
    true,
    true,
    'contact_log · wrt',
    75,
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

create table if not exists public.wrt_enrollments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  delivery_mode text not null default 'in_person',
  requested_hours numeric(8, 2) not null default 0,
  status text not null default 'active',
  enrolled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint wrt_enrollments_delivery_check check (delivery_mode in ('in_person', 'virtual')),
  constraint wrt_enrollments_status_check check (status in ('active', 'ended')),
  constraint wrt_enrollments_hours_check check (requested_hours >= 0)
);

create unique index if not exists wrt_enrollments_one_active_per_client
  on public.wrt_enrollments (client_id)
  where status = 'active';

create index if not exists wrt_enrollments_client_idx
  on public.wrt_enrollments (client_id, status);

create table if not exists public.wrt_enrollment_modules (
  enrollment_id uuid not null references public.wrt_enrollments (id) on delete cascade,
  module_id uuid not null references public.wrt_modules (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (enrollment_id, module_id)
);

create table if not exists public.wrt_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.wrt_enrollments (id) on delete cascade,
  lesson_id uuid not null references public.wrt_lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.profiles (id) on delete set null,
  constraint wrt_lesson_progress_unique unique (enrollment_id, lesson_id)
);

create index if not exists wrt_lesson_progress_enrollment_idx
  on public.wrt_lesson_progress (enrollment_id);

create table if not exists public.wrt_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.wrt_lessons (id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  delivery_mode text not null default 'in_person',
  zoom_url text,
  status text not null default 'scheduled',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrt_sessions_delivery_check check (delivery_mode in ('in_person', 'virtual')),
  constraint wrt_sessions_status_check check (status in ('scheduled', 'completed', 'cancelled'))
);

create index if not exists wrt_sessions_start_idx
  on public.wrt_sessions (scheduled_start desc);

create table if not exists public.wrt_session_attendees (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.wrt_sessions (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  enrollment_id uuid references public.wrt_enrollments (id) on delete set null,
  attendance text not null default 'present',
  duration_minutes numeric(8, 2) not null default 30,
  start_time text,
  end_time text,
  lesson_completed boolean not null default false,
  contact_log_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrt_session_attendees_attendance_check check (attendance in ('present', 'absent')),
  constraint wrt_session_attendees_duration_check check (duration_minutes >= 0),
  constraint wrt_session_attendees_unique unique (session_id, client_id)
);

create index if not exists wrt_session_attendees_client_idx
  on public.wrt_session_attendees (client_id, session_id);

alter table public.wrt_enrollments enable row level security;
alter table public.wrt_enrollment_modules enable row level security;
alter table public.wrt_lesson_progress enable row level security;
alter table public.wrt_sessions enable row level security;
alter table public.wrt_session_attendees enable row level security;
