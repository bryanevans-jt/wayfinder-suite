-- Direct referral assign: admin assigns ES/TS before activation; skip Intake Calls (feature flag).

alter table public.admin_config
  add column if not exists direct_referral_assign_enabled boolean not null default false;

comment on column public.admin_config.direct_referral_assign_enabled is
  'When true, Referral Queue assigns ES/TS before activation; Intake Calls / hospitality intake tasks are skipped.';

-- One-time migration for open hospitality intakes (no active Hospitality Specialists).
update public.hospitality_intake_tasks t
set
  status = 'completed',
  completed_at = coalesce(t.completed_at, now())
from public.es_client_assignments e
where t.client_id = e.client_id
  and t.status = 'open';

update public.clients c
set
  intake_status = 'pending_authorization',
  intake_status_changed_at = coalesce(c.intake_status_changed_at, now()),
  last_activity_at = now()
where c.intake_status = 'active'
  and exists (
    select 1
    from public.hospitality_intake_tasks t
    where t.client_id = c.id and t.status = 'open'
  )
  and not exists (
    select 1 from public.es_client_assignments e where e.client_id = c.id
  );

update public.hospitality_intake_tasks t
set
  status = 'completed',
  completed_at = coalesce(t.completed_at, now())
where t.status = 'open';
