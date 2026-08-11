-- Finance-only intake billing queue (scheduled → ready → billed → paid).

create table if not exists public.intake_billings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  hospitality_task_id uuid references public.hospitality_intake_tasks (id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ready_to_bill', 'billed', 'paid')),
  scheduled_at timestamptz,
  ready_at timestamptz,
  ready_reason text,
  billed_at timestamptz,
  billed_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create index if not exists intake_billings_status_ready_idx
  on public.intake_billings (status, ready_at);

alter table public.intake_billings enable row level security;

comment on table public.intake_billings is
  'Accounts Specialist intake billing. Not shown to ES or supervisors.';
