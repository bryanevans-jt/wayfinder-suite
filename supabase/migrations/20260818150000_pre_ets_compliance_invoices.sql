-- Pre-ETS session documentation tracking, compliance alerts, invoice packets.

alter table public.pre_ets_sessions
  add column if not exists signed_roster_drive_file_name text,
  add column if not exists documentation_completed_at timestamptz,
  add column if not exists billable_units_applied_at timestamptz;

create table if not exists public.pre_ets_compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pre_ets_sessions (id) on delete cascade,
  alert_kind text not null check (alert_kind in ('late_roster', 'late_car', 'missing_roster', 'missing_car')),
  notified_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, alert_kind, notified_user_id)
);

create index if not exists pre_ets_compliance_alerts_session_idx
  on public.pre_ets_compliance_alerts (session_id, created_at desc);

create table if not exists public.pre_ets_invoice_packets (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.pre_ets_authorizations (id) on delete cascade,
  service_month date not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'submitted', 'paid')),
  provider_invoice_number text,
  total_hours integer not null default 0,
  total_amount_cents integer not null default 0,
  submitted_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (authorization_id, service_month)
);

create index if not exists pre_ets_invoice_packets_status_idx
  on public.pre_ets_invoice_packets (status, service_month desc);

do $$
declare
  t text;
  tables text[] := array['pre_ets_compliance_alerts', 'pre_ets_invoice_packets'];
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;
