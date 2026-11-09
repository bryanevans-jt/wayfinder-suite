-- Rendezvous scheduling schema (separate from client CRM data).
-- DO NOT apply to production without Bryan's review.
-- Stores staff availability + counselor bookings only — never client records.

create extension if not exists btree_gist;

create schema if not exists rendezvous;

comment on schema rendezvous is
  'Calendly-style staff booking for GVRA counselors. No client personal data.';

-- ---------------------------------------------------------------------------
-- Org feature flag (default OFF). Super-admin access is enforced in RLS + app.
-- ---------------------------------------------------------------------------
alter table public.admin_config
  add column if not exists rendezvous_enabled boolean not null default false;

comment on column public.admin_config.rendezvous_enabled is
  'Master kill switch for Rendezvous. When false, staff UI/API and public booking stay dark. Super-admin-only access is also enforced in app code and RLS.';

-- ---------------------------------------------------------------------------
-- Helpers (search_path set; SECURITY DEFINER not granted to anon)
-- ---------------------------------------------------------------------------
create or replace function rendezvous.feature_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, rendezvous
as $$
  select coalesce(
    (select ac.rendezvous_enabled from public.admin_config ac limit 1),
    false
  );
$$;

revoke all on function rendezvous.feature_enabled() from public, anon;
grant execute on function rendezvous.feature_enabled() to authenticated, service_role;

-- Current rollout: feature flag ON + Wayfinder super_admin only.
-- Role-based visibility for bookings is separate (see can_view_staff_schedule).
create or replace function rendezvous.can_access_staff_app()
returns boolean
language sql
stable
security definer
set search_path = public, rendezvous
as $$
  select rendezvous.feature_enabled()
    and coalesce(public.auth_user_is_super_admin(), false);
$$;

revoke all on function rendezvous.can_access_staff_app() from public, anon;
grant execute on function rendezvous.can_access_staff_app() to authenticated, service_role;

-- Ready for broader rollout: who may see a given staff member's schedule/bookings.
-- Super admin / admin: everyone. Supervisor: self + supervised ES/TS. Others: self only.
create or replace function rendezvous.can_view_staff_schedule(target_staff_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, rendezvous
as $$
  select case
    when not rendezvous.feature_enabled() then false
    when (select auth.uid()) is null then false
    when public.auth_user_is_admin_tier() then true
    when (select auth.uid()) = target_staff_user_id then true
    when public.auth_user_is_supervisor_tier()
      and target_staff_user_id in (select public.auth_user_supervised_es_ids()) then true
    else false
  end;
$$;

revoke all on function rendezvous.can_view_staff_schedule(uuid) from public, anon;
grant execute on function rendezvous.can_view_staff_schedule(uuid) to authenticated, service_role;

create or replace function rendezvous.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, rendezvous
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function rendezvous.set_updated_at() from public, anon;

-- ---------------------------------------------------------------------------
-- Staff schedules (booking pages). Default: disabled / not bookable.
-- ---------------------------------------------------------------------------
create table rendezvous.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  display_name text,
  enabled boolean not null default false,
  meeting_length_minutes integer not null default 60
    check (meeting_length_minutes between 15 and 240),
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 120),
  min_notice_hours integer not null default 24
    check (min_notice_hours between 0 and 168),
  booking_window_days integer not null default 14
    check (booking_window_days between 1 and 90),
  default_location text,
  timezone text not null default 'America/New_York',
  google_calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedules_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint staff_schedules_staff_user_unique unique (staff_user_id),
  constraint staff_schedules_slug_unique unique (slug)
);

create index staff_schedules_enabled_idx
  on rendezvous.staff_schedules (enabled)
  where enabled = true;

create trigger staff_schedules_set_updated_at
  before update on rendezvous.staff_schedules
  for each row execute function rendezvous.set_updated_at();

comment on table rendezvous.staff_schedules is
  'Per-staff booking page settings. enabled=false means the public page is dark.';

-- ---------------------------------------------------------------------------
-- Weekly availability windows (local to schedule.timezone)
-- ---------------------------------------------------------------------------
create table rendezvous.weekly_hours (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references rendezvous.staff_schedules (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint weekly_hours_order check (start_time < end_time),
  constraint weekly_hours_unique unique (schedule_id, day_of_week, start_time, end_time)
);

create index weekly_hours_schedule_idx on rendezvous.weekly_hours (schedule_id);

comment on column rendezvous.weekly_hours.day_of_week is '0=Sunday … 6=Saturday (JS Date.getDay convention).';

-- ---------------------------------------------------------------------------
-- Bookings (counselor meetings). No client IDs or client PII.
-- ---------------------------------------------------------------------------
create table rendezvous.bookings (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references rendezvous.staff_schedules (id) on delete restrict,
  staff_user_id uuid not null references public.profiles (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  counselor_name text not null,
  counselor_email text not null,
  meeting_format text not null check (meeting_format in ('in_person', 'google_meet')),
  location text,
  meet_link text,
  reason text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'rescheduled')),
  google_event_id text,
  cancel_token_hash text not null,
  reschedule_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint bookings_time_order check (starts_at < ends_at),
  constraint bookings_reason_len check (reason is null or char_length(reason) <= 500),
  constraint bookings_no_overlap exclude using gist (
    staff_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

create index bookings_staff_starts_idx on rendezvous.bookings (staff_user_id, starts_at);
create index bookings_schedule_starts_idx on rendezvous.bookings (schedule_id, starts_at);
create index bookings_status_idx on rendezvous.bookings (status);
create index bookings_cancel_token_idx on rendezvous.bookings (cancel_token_hash);
create index bookings_reschedule_token_idx on rendezvous.bookings (reschedule_token_hash);

create trigger bookings_set_updated_at
  before update on rendezvous.bookings
  for each row execute function rendezvous.set_updated_at();

comment on table rendezvous.bookings is
  'Counselor bookings for staff. Stores counselor contact only — never Wayfinder client records.';

-- ---------------------------------------------------------------------------
-- Short-TTL free/busy cache (avoid aggressive Google polling)
-- ---------------------------------------------------------------------------
create table rendezvous.busy_cache (
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  busy_ranges jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (staff_user_id, window_start, window_end),
  constraint busy_cache_window_order check (window_start < window_end)
);

create index busy_cache_fetched_idx on rendezvous.busy_cache (fetched_at);

-- ---------------------------------------------------------------------------
-- Google Calendar push notification watch channels
-- ---------------------------------------------------------------------------
create table rendezvous.calendar_watch_channels (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  channel_id text not null,
  resource_id text not null,
  calendar_id text not null default 'primary',
  expiration timestamptz not null,
  created_at timestamptz not null default now(),
  constraint calendar_watch_channels_channel_unique unique (channel_id)
);

create index calendar_watch_channels_staff_idx
  on rendezvous.calendar_watch_channels (staff_user_id);
create index calendar_watch_channels_expiration_idx
  on rendezvous.calendar_watch_channels (expiration);

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
grant usage on schema rendezvous to authenticated, service_role;
-- Anon: no table grants (public booking is server-side via service_role only).

grant select, insert, update, delete on all tables in schema rendezvous to service_role;
grant select, insert, update, delete on all tables in schema rendezvous to authenticated;

alter table rendezvous.staff_schedules enable row level security;
alter table rendezvous.weekly_hours enable row level security;
alter table rendezvous.bookings enable row level security;
alter table rendezvous.busy_cache enable row level security;
alter table rendezvous.calendar_watch_channels enable row level security;

-- Staff schedules: only current super-admin rollout may manage; view uses role helper for later.
create policy staff_schedules_select on rendezvous.staff_schedules
  for select to authenticated
  using (
    rendezvous.can_access_staff_app()
    or (
      rendezvous.feature_enabled()
      and rendezvous.can_view_staff_schedule(staff_user_id)
    )
  );

create policy staff_schedules_write on rendezvous.staff_schedules
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());

create policy weekly_hours_select on rendezvous.weekly_hours
  for select to authenticated
  using (
    exists (
      select 1
      from rendezvous.staff_schedules s
      where s.id = weekly_hours.schedule_id
        and (
          rendezvous.can_access_staff_app()
          or (
            rendezvous.feature_enabled()
            and rendezvous.can_view_staff_schedule(s.staff_user_id)
          )
        )
    )
  );

create policy weekly_hours_write on rendezvous.weekly_hours
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());

create policy bookings_select on rendezvous.bookings
  for select to authenticated
  using (
    rendezvous.can_access_staff_app()
    or (
      rendezvous.feature_enabled()
      and rendezvous.can_view_staff_schedule(staff_user_id)
    )
  );

-- Authenticated users never write bookings directly; API uses service_role after token checks.
create policy bookings_write_super_admin on rendezvous.bookings
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());

create policy busy_cache_select on rendezvous.busy_cache
  for select to authenticated
  using (
    rendezvous.can_access_staff_app()
    or (
      rendezvous.feature_enabled()
      and rendezvous.can_view_staff_schedule(staff_user_id)
    )
  );

create policy busy_cache_write on rendezvous.busy_cache
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());

create policy calendar_watch_select on rendezvous.calendar_watch_channels
  for select to authenticated
  using (rendezvous.can_access_staff_app());

create policy calendar_watch_write on rendezvous.calendar_watch_channels
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());
