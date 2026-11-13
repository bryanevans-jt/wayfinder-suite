-- Soft authorization warning notification dedupe for WRT / IJP / Job Coaching.
-- Tracks which thresholds already notified the assigned ES/TS for the current
-- authorization fingerprint (authorized_hours + authorization_end_date).
-- When either auth field changes, the fingerprint changes and notifications reset.
-- Service-role only (no authenticated policies). Do not apply from the agent.

create table if not exists public.client_authorization_warning_state (
  client_id uuid primary key references public.clients (id) on delete cascade,
  auth_fingerprint text not null,
  notified_early boolean not null default false,
  notified_approaching boolean not null default false,
  notified_exceeded boolean not null default false,
  notified_end_date_passed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists client_authorization_warning_state_updated_at_idx
  on public.client_authorization_warning_state (updated_at desc);

comment on table public.client_authorization_warning_state is
  'Dedupe state for soft authorization-hour / end-date in-app notifications to assigned ES/TS. Reset when auth_fingerprint changes.';

comment on column public.client_authorization_warning_state.auth_fingerprint is
  'Fingerprint of authorized_hours|authorization_end_date used when thresholds were notified.';

alter table public.client_authorization_warning_state enable row level security;
