-- Remember corrected school / group / instructor labels per spreadsheet header line.

alter table public.pre_ets_program_groups
  add column if not exists worksheet_header_key text;

create index if not exists pre_ets_program_groups_header_key_idx
  on public.pre_ets_program_groups (school_id, service_month, worksheet_header_key)
  where worksheet_header_key is not null;

create table if not exists public.pre_ets_worksheet_group_mappings (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  district_id uuid not null references public.pre_ets_districts (id) on delete cascade,
  worksheet_header_key text not null,
  header_raw_sample text,
  canonical_school_name text not null,
  canonical_group_name text not null,
  canonical_instructor_name text,
  canonical_school_id uuid references public.pre_ets_schools (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (school_year, district_id, worksheet_header_key)
);

create index if not exists pre_ets_worksheet_group_mappings_district_year_idx
  on public.pre_ets_worksheet_group_mappings (district_id, school_year);

alter table public.pre_ets_worksheet_group_mappings enable row level security;

revoke all on table public.pre_ets_worksheet_group_mappings from anon, authenticated;
grant all on table public.pre_ets_worksheet_group_mappings to service_role;

comment on table public.pre_ets_worksheet_group_mappings is
  'Maps normalized worksheet group header text to canonical school/group/instructor for future imports.';
