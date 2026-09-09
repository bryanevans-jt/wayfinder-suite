-- Pre-ETS class setup: schools, TS assignments, and requested class times before/during worksheet import.

create table if not exists public.pre_ets_class_setup (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  regional_supervisor_user_id uuid references public.profiles (id) on delete set null,
  regional_supervisor_name text,
  school_name text not null,
  school_id uuid references public.pre_ets_schools (id) on delete set null,
  district_number text,
  transition_specialist_user_id uuid references public.profiles (id) on delete set null,
  transition_specialist_name text,
  class_days text,
  class_time text,
  frequency text,
  service_code text,
  notes text,
  linked_program_group_id uuid references public.pre_ets_program_groups (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create index if not exists pre_ets_class_setup_school_year_idx
  on public.pre_ets_class_setup (school_year);

create index if not exists pre_ets_class_setup_school_name_idx
  on public.pre_ets_class_setup (school_year, school_name);

create index if not exists pre_ets_class_setup_school_id_idx
  on public.pre_ets_class_setup (school_id)
  where school_id is not null;

revoke all on public.pre_ets_class_setup from anon, authenticated;
grant all on public.pre_ets_class_setup to service_role;

comment on table public.pre_ets_class_setup is
  'Planning rows for Pre-ETS school assignments and class times; linked to schools/program groups when Accounts worksheet CSV is committed.';
