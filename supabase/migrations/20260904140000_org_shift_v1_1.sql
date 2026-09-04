-- Org shift v1.1: feature toggles, transition_specialist, team directory + celebrations

-- ---------------------------------------------------------------------------
-- A) Feature toggles on admin_config
-- ---------------------------------------------------------------------------
alter table public.admin_config
  add column if not exists community_partners_enabled boolean not null default false,
  add column if not exists traditional_supported_employment_enabled boolean not null default false,
  add column if not exists job_coaching_enabled boolean not null default false,
  add column if not exists groupme_celebrations_enabled boolean not null default true,
  add column if not exists celebration_birthday_template text,
  add column if not exists celebration_anniversary_template text;

update public.admin_config
set
  celebration_birthday_template = coalesce(
    celebration_birthday_template,
    'Happy Birthday, {first_name}! Hope you have a fantastic day!'
  ),
  celebration_anniversary_template = coalesce(
    celebration_anniversary_template,
    'Today {name} celebrates {years} years at Joshua Tree! Happy work anniversary, {first_name}!'
  );

comment on column public.admin_config.community_partners_enabled is
  'When true, Community Partners nav and pages are available.';
comment on column public.admin_config.traditional_supported_employment_enabled is
  'When true, Traditional Supported Employment appears in new referral/service pickers.';
comment on column public.admin_config.job_coaching_enabled is
  'When true, Job Coaching appears in new referral/service pickers.';

-- ---------------------------------------------------------------------------
-- B) Team directory fields on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists birthday date,
  add column if not exists work_start_date date,
  add column if not exists job_title text;

comment on column public.profiles.birthday is
  'Staff birthday (date). Directory shows MM/DD; celebrations never include age.';
comment on column public.profiles.work_start_date is
  'Manual work anniversary anchor. Never auto-set on hire. GroupMe anniversary only if tenure >= 1 year.';
comment on column public.profiles.job_title is
  'Optional directory title (e.g. CEO, COO), especially for Admin role.';

-- Celebration send log (idempotency)
create table if not exists public.team_celebration_sends (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('birthday', 'anniversary')),
  event_date date not null,
  channel text not null default 'groupme',
  message text,
  created_at timestamptz not null default now(),
  unique (profile_id, event_type, event_date, channel)
);

alter table public.team_celebration_sends enable row level security;

-- ---------------------------------------------------------------------------
-- C) Recreate transition_specialist; migrate instructors
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'transition_specialist'
  ) then
    alter type public.user_role add value 'transition_specialist';
  end if;
exception
  when others then
    -- user_role may be text-backed via check constraint only
    null;
end $$;

update public.profiles
set role = 'transition_specialist'
where role::text = 'instructor';

alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (
  role::text in (
    'client',
    'support',
    'es',
    'supervisor',
    'accountant',
    'admin',
    'counselor',
    'super_admin',
    'hr',
    'hospitality_specialist',
    'wrt_admin',
    'instructor',
    'transition_specialist'
  )
);

-- ---------------------------------------------------------------------------
-- D) Seed display names / titles (by email)
-- ---------------------------------------------------------------------------
do $$
declare
  ryan_id uuid;
  bryan_id uuid;
begin
  select u.id into ryan_id
  from auth.users u
  where lower(u.email) = 'ryan.herrington@thejoshuatree.org'
  limit 1;

  if ryan_id is not null then
    update public.profiles
    set
      full_name = 'Ryan Herrington',
      first_name = coalesce(nullif(trim(first_name), ''), 'Ryan'),
      last_name = coalesce(nullif(trim(last_name), ''), 'Herrington'),
      job_title = coalesce(nullif(trim(job_title), ''), 'CEO')
    where id = ryan_id;
  end if;

  select u.id into bryan_id
  from auth.users u
  where lower(u.email) = 'bryan.evans@thejoshuatree.org'
  limit 1;

  if bryan_id is not null then
    update public.profiles
    set
      full_name = coalesce(nullif(trim(full_name), ''), 'Bryan Evans'),
      first_name = coalesce(nullif(trim(first_name), ''), 'Bryan'),
      last_name = coalesce(nullif(trim(last_name), ''), 'Evans'),
      job_title = coalesce(nullif(trim(job_title), ''), 'COO')
    where id = bryan_id;
  end if;
end $$;
