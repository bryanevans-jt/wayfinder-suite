-- IJP monthly attestation + vocational hourly invoice billing (GA)

create table if not exists public.ijp_billing_settings (
  id uuid primary key default gen_random_uuid(),
  module_enabled boolean not null default true,
  provider_name text not null default 'Joshua Tree Service Group',
  remit_address text not null default '505 S Tennille Ave, Donalsonville, GA 39845',
  hourly_rate_cents integer not null default 6000,
  ga_ijp_service_id uuid references public.services (id) on delete set null,
  template_invoice_doc_id text,
  template_attestation_doc_id text,
  drive_attestation_folder_id text,
  drive_invoice_folder_id text,
  drive_test_attestation_folder_id text,
  drive_test_invoice_folder_id text,
  drive_signature_temp_folder_id text,
  updated_at timestamptz not null default now()
);

insert into public.ijp_billing_settings (module_enabled)
select true
where not exists (select 1 from public.ijp_billing_settings limit 1);

alter table public.ijp_billing_settings enable row level security;
revoke all on table public.ijp_billing_settings from anon, authenticated;
grant all on table public.ijp_billing_settings to service_role;

comment on table public.ijp_billing_settings is
  'Super Admin configuration for GA IJP attestation and hourly invoice Google Doc templates and Drive folders.';

create table if not exists public.ijp_monthly_attestations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_month date not null,
  is_test boolean not null default false,
  attestation_drive_file_id text,
  attestation_drive_file_name text,
  captured_by uuid references public.profiles (id) on delete set null,
  facilitator_name text,
  capture_method text not null default 'digital'
    check (capture_method in ('digital', 'upload')),
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, service_month, is_test)
);

create index if not exists ijp_monthly_attestations_month_idx
  on public.ijp_monthly_attestations (service_month);

alter table public.ijp_monthly_attestations enable row level security;
revoke all on table public.ijp_monthly_attestations from anon, authenticated;
grant all on table public.ijp_monthly_attestations to service_role;

create table if not exists public.ijp_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_month date not null,
  is_test boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),
  provider_invoice_number text,
  authorization_number text,
  invoice_date date,
  line_items jsonb not null default '[]'::jsonb,
  total_hours numeric(8, 1) not null default 0,
  total_amount_cents integer not null default 0,
  invoice_only_drive_file_id text,
  combined_drive_file_id text,
  missing_attestation boolean not null default true,
  compiled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ijp_billing_invoices_client_month_idx
  on public.ijp_billing_invoices (client_id, service_month);

create index if not exists ijp_billing_invoices_month_status_idx
  on public.ijp_billing_invoices (service_month, status);

alter table public.ijp_billing_invoices enable row level security;
revoke all on table public.ijp_billing_invoices from anon, authenticated;
grant all on table public.ijp_billing_invoices to service_role;

create table if not exists public.ijp_attestation_sla_dismissals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service_month date not null,
  dismissed_by uuid not null references public.profiles (id) on delete cascade,
  reason text,
  dismissed_at timestamptz not null default now(),
  unique (client_id, service_month)
);

alter table public.ijp_attestation_sla_dismissals enable row level security;
revoke all on table public.ijp_attestation_sla_dismissals from anon, authenticated;
grant all on table public.ijp_attestation_sla_dismissals to service_role;
