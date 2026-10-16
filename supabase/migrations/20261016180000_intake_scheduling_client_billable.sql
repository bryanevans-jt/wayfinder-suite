-- Intake scheduling flag, client billable rules, contact log Other, intake audit columns.

alter table public.clients
  add column if not exists intake_scheduling_needed boolean not null default true;

comment on column public.clients.intake_scheduling_needed is
  'When true, staff can schedule/reschedule intake on the client profile until intake billing is ready.';

update public.clients c
set intake_scheduling_needed = false
from public.intake_billings b
where b.client_id = c.id
  and b.status in ('ready_to_bill', 'billed', 'paid');

alter table public.service_activity_types
  add column if not exists counts_toward_client_billable boolean not null default true;

comment on column public.service_activity_types.counts_toward_client_billable is
  'When false, time still logs to the ES timesheet but is excluded from per-client billable totals.';

update public.service_activity_types
set active = false
where code in ('JT-ACT-050', 'JT-TRV-060');

update public.service_activity_types
set counts_toward_client_billable = false
where code in ('JT-ACT-040', 'JT-CSE-051')
   or name ilike '%case file review%';

insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable, counts_toward_client_billable, wayfinder_source_hint, sort_order, active)
values
  (
    'JT-ACT-099',
    'Case management',
    'Other (note only)',
    0,
    0,
    0,
    true,
    true,
    false,
    false,
    'contact_log',
    5,
    true
  )
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  default_minutes = excluded.default_minutes,
  min_minutes = excluded.min_minutes,
  max_minutes = excluded.max_minutes,
  requires_client = excluded.requires_client,
  requires_narrative = excluded.requires_narrative,
  is_billable = excluded.is_billable,
  counts_toward_client_billable = excluded.counts_toward_client_billable,
  wayfinder_source_hint = excluded.wayfinder_source_hint,
  sort_order = excluded.sort_order,
  active = true;

alter table public.intake_billings
  add column if not exists no_show_contact_log_id uuid references public.contact_logs (id) on delete set null;

create index if not exists intake_billings_no_show_contact_log_idx
  on public.intake_billings (no_show_contact_log_id)
  where no_show_contact_log_id is not null;

comment on column public.intake_billings.no_show_contact_log_id is
  'Casework contact log that recorded an intake no-show (audit).';

create table if not exists public.gvra_monthly_allowance_grants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_month date not null,
  es_time_entry_id uuid references public.es_time_entries (id) on delete set null,
  minutes int not null default 120,
  created_at timestamptz not null default now(),
  unique (client_id, service_month)
);

create index if not exists gvra_monthly_allowance_grants_month_idx
  on public.gvra_monthly_allowance_grants (service_month);

alter table public.gvra_monthly_allowance_grants enable row level security;
revoke all on table public.gvra_monthly_allowance_grants from anon, authenticated;
grant all on table public.gvra_monthly_allowance_grants to service_role;

comment on table public.gvra_monthly_allowance_grants is
  'Idempotent ledger for GVRA 2.0 hr/month IJP & TSE (GA) report/paperwork allowance.';
