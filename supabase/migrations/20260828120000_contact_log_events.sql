-- Audit trail for contact log create, correct, edit, and delete (Change log).

create table if not exists public.contact_log_events (
  id uuid primary key default gen_random_uuid(),
  contact_log_id uuid,
  client_id uuid not null references public.clients (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_kind text not null check (
    event_kind in ('created', 'corrected', 'admin_edited', 'deleted')
  ),
  before_public_outcome text,
  after_public_outcome text,
  before_notes text,
  after_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contact_log_events_client_id_idx
  on public.contact_log_events (client_id, created_at desc);

create index if not exists contact_log_events_created_at_idx
  on public.contact_log_events (created_at desc);

comment on table public.contact_log_events is
  'Change log for counselor-visible contact logs (create, correct, admin edit, delete).';

alter table public.contact_log_events enable row level security;
