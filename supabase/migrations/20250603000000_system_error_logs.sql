-- System-wide error log for super admin diagnostics (technical details never shown to end users).

create table if not exists public.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  error_code text not null unique,
  created_at timestamptz not null default now(),
  app text not null check (app in ('staff', 'client')),
  route text not null,
  user_id uuid references auth.users (id) on delete set null,
  user_name text,
  user_role text,
  user_role_label text,
  status_code integer,
  technical_message text not null,
  stack_trace text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists system_error_logs_created_at_idx
  on public.system_error_logs (created_at desc);

create index if not exists system_error_logs_error_code_idx
  on public.system_error_logs (error_code);

create index if not exists system_error_logs_app_idx
  on public.system_error_logs (app);

alter table public.system_error_logs enable row level security;

-- No policies: only service-role server code reads/writes this table.

comment on table public.system_error_logs is
  'Internal error log for super admins. End users see friendly messages only.';
