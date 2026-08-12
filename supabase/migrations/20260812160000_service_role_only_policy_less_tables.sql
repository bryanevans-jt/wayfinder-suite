-- Service-role-only access for tables that already use RLS with no policies.
-- Staff/client APIs use the service role; authenticated/anon clients must not
-- read or write these tables directly. Matches current app enforcement.

do $$
declare
  t text;
  tables text[] := array[
    'intake_billings',
    'client_staff_notes',
    'hospitality_client_contacts',
    'client_referral_documents',
    'client_intake_events',
    'hospitality_intake_tasks',
    'meeting_reminder_sends',
    'wrt_modules',
    'wrt_lessons',
    'wrt_lesson_blocks',
    'wrt_enrollments',
    'wrt_enrollment_modules',
    'wrt_lesson_progress',
    'wrt_sessions',
    'wrt_session_attendees',
    'org_pto_settings',
    'staff_pto_requests',
    'staff_pto_request_edits',
    'system_error_logs'
  ];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

comment on table public.intake_billings is
  'Accounts Specialist intake billing. App APIs use service role; no direct authenticated access.';
comment on table public.client_staff_notes is
  'Internal staff notes. App APIs use service role; visible only via staff notes API role checks.';
comment on table public.hospitality_client_contacts is
  'Hospitality monthly check-ins. App APIs use service role; no direct authenticated access.';
