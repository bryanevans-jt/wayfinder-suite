-- Instructor-entered participant count on Class Activity Reports
alter table public.pre_ets_activity_reports
  add column if not exists participant_count integer
  check (participant_count is null or participant_count >= 0);
