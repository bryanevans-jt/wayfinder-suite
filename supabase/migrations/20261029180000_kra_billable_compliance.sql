-- KRA billable hours per client (IJP/TSE): settings, assignment history, optional closed-month snapshots.

create table if not exists public.org_kra_billable_settings (
  id uuid primary key default gen_random_uuid(),
  count_system_allowance_toward_kra boolean not null default true,
  successor_inherits_client_month_hours boolean not null default true,
  rules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.org_kra_billable_settings is
  'Org-wide KRA thresholds: billable hours per client per calendar month by service (Super Admin).';

comment on column public.org_kra_billable_settings.rules is
  'JSON array: [{ "service_ids": ["uuid", ...], "hours_per_client_per_month": number }]';

insert into public.org_kra_billable_settings (count_system_allowance_toward_kra, successor_inherits_client_month_hours, rules)
select
  true,
  true,
  jsonb_build_array(
    jsonb_build_object(
      'service_ids',
      coalesce(
        (
          select jsonb_agg(s.id)
          from public.services s
          where s.name in (
            'Individual Job Placement (GA)',
            'Traditional Supported Employment (GA)'
          )
        ),
        '[]'::jsonb
      ),
      'hours_per_client_per_month',
      10
    )
  )
where not exists (select 1 from public.org_kra_billable_settings limit 1);

create table if not exists public.es_client_assignment_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  es_user_id uuid not null references auth.users (id) on delete cascade,
  effective_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  source text
);

create index if not exists es_client_assignment_events_client_effective_idx
  on public.es_client_assignment_events (client_id, effective_at desc);

comment on table public.es_client_assignment_events is
  'Append-only caseload assign/reassign history for KRA month attribution (payroll unchanged).';

-- Seed one event per current assignment so history exists before go-live.
insert into public.es_client_assignment_events (client_id, es_user_id, effective_at, source)
select e.client_id, e.es_user_id, e.created_at, 'migration_backfill'
from public.es_client_assignments e
where not exists (
  select 1
  from public.es_client_assignment_events ev
  where ev.client_id = e.client_id and ev.es_user_id = e.es_user_id
);

create table if not exists public.kra_billable_month_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null,
  payload jsonb not null,
  constraint kra_billable_month_snapshots_month_key unique (month_key)
);

comment on table public.kra_billable_month_snapshots is
  'Frozen KRA compliance rollup for a calendar month (YYYY-MM).';

alter table public.org_kra_billable_settings enable row level security;
alter table public.es_client_assignment_events enable row level security;
alter table public.kra_billable_month_snapshots enable row level security;
