-- Release Pre-ETS rosters to instructors before GVRA auth numbers exist.
-- field_released_at is the instructor visibility gate (auth_number optional).
-- removed_at soft-holds roster lines dropped after release (restorable within the month).
-- service_month_blocks lets Super Admin hide a month from instructor view.

alter table public.pre_ets_authorizations
  add column if not exists field_released_at timestamptz,
  add column if not exists field_released_by uuid references public.profiles (id) on delete set null;

comment on column public.pre_ets_authorizations.field_released_at is
  'When non-null, field staff (TS/TI) may view/print/schedule this roster even without auth_number.';

create index if not exists pre_ets_authorizations_field_released_idx
  on public.pre_ets_authorizations (service_month, field_released_at);

-- Existing finalized auths are already "released" to the field.
update public.pre_ets_authorizations
set field_released_at = coalesce(created_at, now())
where field_released_at is null
  and auth_number is not null
  and btrim(auth_number) <> ''
  and auth_type in ('group', 'individual');

alter table public.pre_ets_roster_entries
  add column if not exists removed_at timestamptz,
  add column if not exists removed_reason text;

comment on column public.pre_ets_roster_entries.removed_at is
  'Soft-hold: dropped from active instructor roster but kept for the month in case re-added.';

create index if not exists pre_ets_roster_entries_active_idx
  on public.pre_ets_roster_entries (authorization_id)
  where removed_at is null;

create table if not exists public.pre_ets_service_month_blocks (
  service_month date primary key,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references public.profiles (id) on delete set null,
  reason text,
  unblocked_at timestamptz,
  unblocked_by uuid references public.profiles (id) on delete set null
);

comment on table public.pre_ets_service_month_blocks is
  'Super Admin kill switch: when blocked (unblocked_at is null), instructors cannot see that service month.';

alter table public.pre_ets_service_month_blocks enable row level security;

create table if not exists public.pre_ets_roster_month_releases (
  service_month date primary key,
  batch_released_at timestamptz,
  batch_notify_sent_at timestamptz,
  missing_upload_alert_sent_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.pre_ets_roster_month_releases is
  'Tracks 20th-of-month batch release / missing-upload alerts per service month.';

alter table public.pre_ets_roster_month_releases enable row level security;

revoke all on table public.pre_ets_service_month_blocks from anon, authenticated;
grant all on table public.pre_ets_service_month_blocks to service_role;

revoke all on table public.pre_ets_roster_month_releases from anon, authenticated;
grant all on table public.pre_ets_roster_month_releases to service_role;
