-- ES dashboard: offices, counselors, ES–client assignments, staff RLS.

-- Repair legacy tables missing uuid id (CREATE TABLE IF NOT EXISTS would skip them).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'offices'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offices' and column_name = 'id'
  ) then
    alter table public.offices
      add column id uuid not null default gen_random_uuid();
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'offices' and c.conname = 'offices_id_key'
    ) then
      alter table public.offices add constraint offices_id_key unique (id);
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'clients'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'id'
  ) then
    alter table public.clients
      add column id uuid not null default gen_random_uuid();
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'clients' and c.conname = 'clients_id_key'
    ) then
      alter table public.clients add constraint clients_id_key unique (id);
    end if;
  end if;
end $$;

-- Offices & counselors (reference data for assignments)
create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.counselors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  office_id uuid not null references public.offices (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists counselors_office_idx on public.counselors (office_id);

create table if not exists public.es_client_assignments (
  id uuid primary key default gen_random_uuid(),
  es_user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (es_user_id, client_id)
);

create index if not exists es_client_assignments_es_idx
  on public.es_client_assignments (es_user_id);

create index if not exists es_client_assignments_client_idx
  on public.es_client_assignments (client_id);

alter table public.clients
  add column if not exists office_id uuid references public.offices (id) on delete set null;

alter table public.clients
  add column if not exists counselor_id uuid references public.counselors (id) on delete set null;

alter table public.clients
  add column if not exists contact_email text;

-- Seed sample offices & counselors (safe to re-run; respects legacy NOT NULL / enum columns)
do $$
declare
  state_udt text;
  state_val text;
  state_is_enum boolean;
  has_city boolean;
begin
  if exists (select 1 from public.offices limit 1) then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offices' and column_name = 'state'
  ) then
    insert into public.offices (name)
    values
      ('Joshua Tree — Main'),
      ('Twentynine Palms — Satellite');
    return;
  end if;

  select c.udt_name
  into state_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'offices'
    and c.column_name = 'state';

  select exists (
    select 1 from pg_type t
    where t.typname = state_udt and t.typtype = 'e'
  )
  into state_is_enum;

  if state_is_enum then
    select e.enumlabel
    into state_val
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = state_udt
      and (
        lower(e.enumlabel) in ('ca', 'california', 'calif')
        or e.enumlabel ilike '%california%'
      )
    order by
      case lower(e.enumlabel)
        when 'california' then 0
        when 'ca' then 1
        else 2
      end,
      e.enumsortorder
    limit 1;

    if state_val is null then
      select e.enumlabel
      into state_val
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = state_udt
      order by e.enumsortorder
      limit 1;
    end if;
  else
    state_val := 'CA';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'offices' and column_name = 'city'
  )
  into has_city;

  if has_city and state_is_enum then
    execute format(
      'insert into public.offices (name, state, city) values
        (%L, %L::%I, %L),
        (%L, %L::%I, %L)',
      'Joshua Tree — Main',
      state_val,
      state_udt,
      'Joshua Tree',
      'Twentynine Palms — Satellite',
      state_val,
      state_udt,
      'Twentynine Palms'
    );
  elsif has_city then
    insert into public.offices (name, state, city)
    values
      ('Joshua Tree — Main', state_val, 'Joshua Tree'),
      ('Twentynine Palms — Satellite', state_val, 'Twentynine Palms');
  elsif state_is_enum then
    execute format(
      'insert into public.offices (name, state) values
        (%L, %L::%I),
        (%L, %L::%I)',
      'Joshua Tree — Main',
      state_val,
      state_udt,
      'Twentynine Palms — Satellite',
      state_val,
      state_udt
    );
  else
    insert into public.offices (name, state)
    values
      ('Joshua Tree — Main', state_val),
      ('Twentynine Palms — Satellite', state_val);
  end if;
end $$;

insert into public.counselors (full_name, office_id)
select 'Alex Morgan', o.id
from public.offices o
where o.name = 'Joshua Tree — Main'
  and not exists (select 1 from public.counselors limit 1)
limit 1;

insert into public.counselors (full_name, office_id)
select 'Jordan Lee', o.id
from public.offices o
where o.name = 'Joshua Tree — Main'
  and exists (select 1 from public.counselors where full_name = 'Alex Morgan')
  and not exists (select 1 from public.counselors where full_name = 'Jordan Lee')
limit 1;

insert into public.counselors (full_name, office_id)
select 'Sam Rivera', o.id
from public.offices o
where o.name = 'Twentynine Palms — Satellite'
  and exists (select 1 from public.counselors where full_name = 'Alex Morgan')
  and not exists (select 1 from public.counselors where full_name = 'Sam Rivera')
limit 1;

-- RLS: offices & counselors (staff read)
alter table public.offices enable row level security;
alter table public.counselors enable row level security;
alter table public.es_client_assignments enable row level security;

drop policy if exists "offices_select_staff" on public.offices;
create policy "offices_select_staff"
  on public.offices for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin')
    )
  );

drop policy if exists "counselors_select_staff" on public.counselors;
create policy "counselors_select_staff"
  on public.counselors for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin')
    )
  );

drop policy if exists "es_assignments_select_own" on public.es_client_assignments;
create policy "es_assignments_select_own"
  on public.es_client_assignments for select to authenticated
  using (es_user_id = (select auth.uid()));

drop policy if exists "es_assignments_insert_own" on public.es_client_assignments;
create policy "es_assignments_insert_own"
  on public.es_client_assignments for insert to authenticated
  with check (es_user_id = (select auth.uid()));

-- Clients: ES assigned can read / update
drop policy if exists "clients_select_es_assigned" on public.clients;
create policy "clients_select_es_assigned"
  on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.client_id = clients.id
        and e.es_user_id = (select auth.uid())
    )
  );

drop policy if exists "clients_update_es_assigned" on public.clients;
create policy "clients_update_es_assigned"
  on public.clients for update to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.client_id = clients.id
        and e.es_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.es_client_assignments e
      where e.client_id = clients.id
        and e.es_user_id = (select auth.uid())
    )
  );

-- Profiles: ES can read assigned clients' profile rows (name, etc.)
drop policy if exists "profiles_select_for_es_clients" on public.profiles;
create policy "profiles_select_for_es_clients"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      join public.clients c on c.id = e.client_id
      where e.es_user_id = (select auth.uid())
        and c.user_id = profiles.id
    )
  );

-- Services & milestones: staff can read all (for ES dropdowns & stage lists)
drop policy if exists "services_select_staff" on public.services;
create policy "services_select_staff"
  on public.services for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin')
    )
  );

drop policy if exists "service_milestones_select_staff" on public.service_milestones;
create policy "service_milestones_select_staff"
  on public.service_milestones for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin')
    )
  );
