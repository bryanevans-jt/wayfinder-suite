-- Wayfinder analytics v1: documented metric catalog (implementation in staff app).
-- Canonical definitions live in apps/staff/src/lib/analytics/definitions.ts
--
-- Intake date:  earliest Phase 1 / Intake milestone (client_stage_events),
--               else first accepted meeting (client_meeting_requests),
--               else clients.created_at
-- Hire date:    first applications row with status = 'Hired'
-- Active caseload: assigned clients whose current milestone is not Closed/Dismissed
--
-- Future: materialized views can mirror staff-app aggregates for BI tools.

comment on table public.applications is
  'Job applications per client. Analytics hire date = min(created_at) where lower(trim(status)) = ''hired''.';

comment on table public.client_stage_events is
  'Milestone timeline. Analytics intake date prefers milestones matching Phase 1 / Intake.';

comment on table public.client_meeting_requests is
  'Meeting requests. Analytics uses earliest accepted meeting as intake fallback.';
