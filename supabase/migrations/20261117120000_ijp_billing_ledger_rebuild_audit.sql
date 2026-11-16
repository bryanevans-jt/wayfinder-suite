-- IJP Billing hours ledger: rebuild flag + hour unbill/bill audit trail.

alter table public.ijp_billing_invoices
  add column if not exists needs_rebuild boolean not null default false;

comment on column public.ijp_billing_invoices.needs_rebuild is
  'True when hours were unlinked from a compiled invoice and the PDF may be stale until Accounts rebuilds/compiles.';

create table if not exists public.ijp_billing_hour_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null
    check (action in ('unbill', 'bill', 'rebuild_flag', 'attestation_backfill_plan')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  client_id uuid references public.clients (id) on delete set null,
  service_month date,
  entry_id uuid,
  invoice_id uuid,
  before_invoice_id uuid,
  after_invoice_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ijp_billing_hour_audit_month_idx
  on public.ijp_billing_hour_audit (service_month, created_at desc);

create index if not exists ijp_billing_hour_audit_entry_idx
  on public.ijp_billing_hour_audit (entry_id)
  where entry_id is not null;

alter table public.ijp_billing_hour_audit enable row level security;
revoke all on table public.ijp_billing_hour_audit from anon, authenticated;
grant all on table public.ijp_billing_hour_audit to service_role;
