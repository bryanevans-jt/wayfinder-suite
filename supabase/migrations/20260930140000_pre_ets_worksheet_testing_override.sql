-- Temporary Pre-ETS worksheet testing: allow roster creation without auth numbers;
-- hide unreleased rosters from everyone except admin / super_admin while enabled.

alter table public.pre_ets_settings
  add column if not exists worksheet_testing_override_enabled boolean not null default false;

comment on column public.pre_ets_settings.worksheet_testing_override_enabled is
  'When true, worksheet uploads may create pending rosters without GVRA auth numbers; unreleased rosters are visible only to admin and super_admin.';
