-- Instructor signature + signed date on Class Activity Reports
alter table public.pre_ets_activity_reports
  add column if not exists signature_data text,
  add column if not exists signed_date date;
