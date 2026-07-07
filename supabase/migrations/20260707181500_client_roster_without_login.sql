-- Roster-only clients: display name without auth login (bulk onboarding from legacy Reports v2).
-- Portal login can be linked later via invite / auth link flows.
--
-- This legacy database drifted: the clients primary key sits on profile_id, which forces
-- profile_id NOT NULL and blocks login-less roster rows. Canonical schema keys clients on id.
-- All incoming foreign keys already target clients.id, so repointing the PK to id is safe.

alter table public.clients
  add column if not exists full_name text;

comment on column public.clients.full_name is
  'Display name when the client has no auth.users login yet (roster import).';

-- Make sure id is a proper, non-null, defaulted identity column before it becomes the PK.
alter table public.clients
  alter column id set default gen_random_uuid();

update public.clients
set id = gen_random_uuid()
where id is null;

alter table public.clients
  alter column id set not null;

-- Repoint the primary key from the legacy profile_id to id.
do $$
declare
  pk_name text;
  pk_on_id boolean;
begin
  select tc.constraint_name into pk_name
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'clients'
    and tc.constraint_type = 'PRIMARY KEY'
  limit 1;

  if pk_name is not null then
    select exists (
      select 1
      from information_schema.key_column_usage kcu
      where kcu.constraint_name = pk_name
        and kcu.table_schema = 'public'
        and kcu.table_name = 'clients'
        and kcu.column_name = 'id'
    )
    and not exists (
      select 1
      from information_schema.key_column_usage kcu
      where kcu.constraint_name = pk_name
        and kcu.table_schema = 'public'
        and kcu.table_name = 'clients'
        and kcu.column_name <> 'id'
    )
    into pk_on_id;

    if not pk_on_id then
      execute format('alter table public.clients drop constraint %I', pk_name);
    end if;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'clients'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.clients add constraint clients_pkey primary key (id);
  end if;
end $$;

-- Drop NOT NULL so roster rows can exist without auth.users / profiles link.
alter table public.clients
  alter column user_id drop not null;

alter table public.clients
  alter column profile_id drop not null;

create index if not exists clients_roster_full_name_idx
  on public.clients (lower(trim(full_name)))
  where user_id is null and full_name is not null;
