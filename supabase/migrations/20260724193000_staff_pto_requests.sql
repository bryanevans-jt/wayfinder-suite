-- Org PTO allowance + staff PTO requests (leave ledger; separate from Time Clock shifts).

create table if not exists public.org_pto_settings (
  id uuid primary key default gen_random_uuid(),
  period_start_date date not null default make_date(extract(year from now())::int, 1, 1),
  annual_pto_days numeric(6, 2),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on column public.org_pto_settings.annual_pto_days is
  'Null means unlimited PTO for the period.';

insert into public.org_pto_settings (period_start_date, annual_pto_days)
select make_date(extract(year from now())::int, 1, 1), null
where not exists (select 1 from public.org_pto_settings);

create table if not exists public.staff_pto_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  details text,
  days_charged numeric(6, 2) not null,
  days_charged_manual boolean not null default false,
  status text not null default 'pending',
  decision_notes text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_pto_requests_dates_check check (end_date >= start_date),
  constraint staff_pto_requests_days_charged_check check (days_charged >= 0),
  constraint staff_pto_requests_reason_check check (
    reason in ('vacation', 'sick', 'maternity', 'paternity', 'emergency', 'other')
  ),
  constraint staff_pto_requests_status_check check (
    status in ('pending', 'approved', 'denied', 'cancelled')
  )
);

create index if not exists staff_pto_requests_requester_idx
  on public.staff_pto_requests (requester_user_id, start_date desc);

create index if not exists staff_pto_requests_status_idx
  on public.staff_pto_requests (status, end_date desc);

create index if not exists staff_pto_requests_end_date_idx
  on public.staff_pto_requests (end_date desc);

create table if not exists public.staff_pto_request_edits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.staff_pto_requests (id) on delete cascade,
  edited_by uuid not null references public.profiles (id) on delete restrict,
  edited_at timestamptz not null default now(),
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  note text,
  constraint staff_pto_request_edits_action_check check (
    action in (
      'create',
      'cancel',
      'approve',
      'deny',
      'void',
      'amend_dates',
      'amend_days_charged',
      'amend'
    )
  )
);

create index if not exists staff_pto_request_edits_request_idx
  on public.staff_pto_request_edits (request_id, edited_at desc);

alter table public.org_pto_settings enable row level security;
alter table public.staff_pto_requests enable row level security;
alter table public.staff_pto_request_edits enable row level security;

-- Staff app uses service role for PTO; no broad authenticated policies yet.
-- Preview rollout is gated in application code (admin tier only).
