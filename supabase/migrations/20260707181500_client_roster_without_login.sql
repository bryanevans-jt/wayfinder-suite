-- Roster-only clients: display name without auth login (bulk onboarding from legacy Reports v2).
-- Portal login can be linked later via invite / auth link flows.

alter table public.clients
  add column if not exists full_name text;

comment on column public.clients.full_name is
  'Display name when the client has no auth.users login yet (roster import).';

-- Drop NOT NULL so roster rows can exist without auth.users / profiles link.
alter table public.clients
  alter column user_id drop not null;

-- Sync trigger already leaves both null when neither is set.

create index if not exists clients_roster_full_name_idx
  on public.clients (lower(trim(full_name)))
  where user_id is null and full_name is not null;
