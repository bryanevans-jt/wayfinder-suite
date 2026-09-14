-- In-app student signatures on Pre-ETS session rosters (alternative to scanned paper PDF).

alter table public.pre_ets_session_attendance
  add column if not exists roster_signature_data text,
  add column if not exists roster_signed_date date;

comment on column public.pre_ets_session_attendance.roster_signature_data is
  'PNG data URL captured in the field when the student signs on a TS/TI device.';
comment on column public.pre_ets_session_attendance.roster_signed_date is
  'Date shown on the roster sign-in sheet for this student signature.';
