-- Hospitality client check-ins: monthly → weekly (Sun–Sat, America/New_York week start).
-- New: monthly Community Partner outreach log for Hospitality Specialist.

-- ---------------------------------------------------------------------------
-- Client contacts: rename contact_month → contact_week and rebucket history
-- ---------------------------------------------------------------------------
alter table public.hospitality_client_contacts
  rename column contact_month to contact_week;

drop index if exists public.hospitality_client_contacts_month_idx;

-- Recompute week start (Sunday) from contacted_at in America/New_York.
-- Extract local date, then subtract weekday (0=Sun … 6=Sat).
update public.hospitality_client_contacts
set contact_week = (
  (
    (timezone('America/New_York', contacted_at))::date
    - extract(dow from timezone('America/New_York', contacted_at))::int
  )
);

create index if not exists hospitality_client_contacts_week_idx
  on public.hospitality_client_contacts (contact_week, client_id);

comment on table public.hospitality_client_contacts is
  'Hospitality Specialist weekly wellness check-ins. Target: every client at least once per calendar week Sun–Sat (America/New_York).';

comment on column public.hospitality_client_contacts.contact_week is
  'Sunday (America/New_York) of the service week this contact counts toward.';

-- ---------------------------------------------------------------------------
-- Partner (employer) monthly contacts
-- ---------------------------------------------------------------------------
create table if not exists public.hospitality_partner_contacts (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  contacted_by uuid not null references public.profiles (id) on delete restrict,
  contacted_at timestamptz not null default now(),
  contact_month date not null,
  outcome text not null default 'reached'
    check (outcome in ('reached', 'voicemail', 'no_answer', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists hospitality_partner_contacts_employer_idx
  on public.hospitality_partner_contacts (employer_id, contacted_at desc);

create index if not exists hospitality_partner_contacts_month_idx
  on public.hospitality_partner_contacts (contact_month, employer_id);

comment on table public.hospitality_partner_contacts is
  'Hospitality Specialist monthly Community Partner outreach. Target: every partner at least once per calendar month (America/New_York).';

alter table public.hospitality_partner_contacts enable row level security;

revoke all on table public.hospitality_partner_contacts from anon, authenticated;
grant all on table public.hospitality_partner_contacts to service_role;
