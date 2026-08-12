-- Internal staff notes (never shown to clients, natural supports, or counselors)
-- and Hospitality monthly check-ins.

create table if not exists public.client_staff_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint client_staff_notes_body_check check (char_length(btrim(body)) > 0)
);

create index if not exists client_staff_notes_client_created_idx
  on public.client_staff_notes (client_id, created_at desc);

comment on table public.client_staff_notes is
  'Internal staff notes. Visible to Super Admin, Admin, HR, Hospitality, Supervisors, and Employment Specialists only.';

create table if not exists public.hospitality_client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  contacted_by uuid not null references public.profiles (id) on delete restrict,
  contacted_at timestamptz not null default now(),
  contact_month date not null,
  outcome text not null default 'reached'
    check (outcome in ('reached', 'voicemail', 'no_answer', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists hospitality_client_contacts_client_idx
  on public.hospitality_client_contacts (client_id, contacted_at desc);

create index if not exists hospitality_client_contacts_month_idx
  on public.hospitality_client_contacts (contact_month, client_id);

comment on table public.hospitality_client_contacts is
  'Hospitality Specialist monthly wellness check-ins. Target: every client at least once per calendar month (America/New_York).';

alter table public.client_staff_notes enable row level security;
alter table public.hospitality_client_contacts enable row level security;
