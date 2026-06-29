-- Allow formal reporting app errors in the shared system error log.
alter table public.system_error_logs
  drop constraint if exists system_error_logs_app_check;

alter table public.system_error_logs
  add constraint system_error_logs_app_check
  check (app in ('staff', 'client', 'reports'));
