-- Optional VR authorized hours + authorization end date for WRT / IJP / Job Coaching enrollments.
-- Stored on clients (one enrollment / current service per client row). Nullable so existing
-- clients and unrelated services keep working with no backfill.

alter table public.clients
  add column if not exists authorized_hours numeric,
  add column if not exists authorization_end_date date;

alter table public.clients
  drop constraint if exists clients_authorized_hours_nonnegative;

alter table public.clients
  add constraint clients_authorized_hours_nonnegative
  check (authorized_hours is null or authorized_hours >= 0);

comment on column public.clients.authorized_hours is
  'Optional authorized service hours for WRT, IJP, or Job Coaching (nullable).';

comment on column public.clients.authorization_end_date is
  'Optional authorization end date for WRT, IJP, or Job Coaching (nullable).';
