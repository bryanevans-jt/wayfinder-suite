-- Two-step PTO for ES / Instructors: supervisor coverage OK → HR final approval.

alter table public.staff_pto_requests
  drop constraint if exists staff_pto_requests_status_check;

alter table public.staff_pto_requests
  add constraint staff_pto_requests_status_check check (
    status in ('pending_supervisor', 'pending', 'approved', 'denied', 'cancelled')
  );

alter table public.staff_pto_request_edits
  drop constraint if exists staff_pto_request_edits_action_check;

alter table public.staff_pto_request_edits
  add constraint staff_pto_request_edits_action_check check (
    action in (
      'create',
      'cancel',
      'supervisor_approve',
      'supervisor_deny',
      'approve',
      'deny',
      'void',
      'amend_dates',
      'amend_days_charged',
      'amend'
    )
  );
