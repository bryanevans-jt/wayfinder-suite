-- Counselor portal: role, counselor↔auth link, applications, contact logs, stage events.
-- Prerequisites below are idempotent (same as 20250514000000_es_dashboard.sql) so this file
-- can run even if that migration was not applied yet.

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

alter table public.offices enable row level security;
alter table public.counselors enable row level security;
alter table public.es_client_assignments enable row level security;

-- Allow counselor role on profiles
alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (
  role in (
    'client',
    'support',
    'es',
    'supervisor',
    'accountant',
    'admin',
    'counselor'
  )
);

-- Link counselor directory rows to auth users (portal login)
alter table public.counselors
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists counselors_user_id_uidx
  on public.counselors (user_id)
  where user_id is not null;

-- Applications submitted per client
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists applications_client_created_idx
  on public.applications (client_id, created_at desc);

-- ES / staff contact logs (counselor sees public_outcome)
create table if not exists public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  logged_by uuid references auth.users (id) on delete set null,
  public_outcome text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists contact_logs_client_created_idx
  on public.contact_logs (client_id, created_at desc);

-- Automatic milestone timeline when client stage changes
create table if not exists public.client_stage_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  milestone_id uuid not null references public.service_milestones (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists client_stage_events_client_created_idx
  on public.client_stage_events (client_id, created_at desc);

create or replace function public.log_client_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.current_stage_id is distinct from old.current_stage_id
     and new.current_stage_id is not null then
    insert into public.client_stage_events (client_id, milestone_id, created_at)
    values (new.id, new.current_stage_id, now());
  end if;
  return new;
end;
$$;

drop trigger if exists clients_stage_change_log on public.clients;
create trigger clients_stage_change_log
  after update of current_stage_id on public.clients
  for each row
  execute procedure public.log_client_stage_change();

-- RLS
alter table public.applications enable row level security;
alter table public.contact_logs enable row level security;
alter table public.client_stage_events enable row level security;

-- Counselor can read their own directory row
drop policy if exists "counselors_select_self" on public.counselors;
create policy "counselors_select_self"
  on public.counselors for select to authenticated
  using (user_id = (select auth.uid()));

-- Extend staff read policies to include counselor (drop + recreate with wider role list)
drop policy if exists "offices_select_staff" on public.offices;
create policy "offices_select_staff"
  on public.offices for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin', 'counselor')
    )
  );

drop policy if exists "counselors_select_staff" on public.counselors;
create policy "counselors_select_staff"
  on public.counselors for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin', 'counselor')
    )
  );

drop policy if exists "services_select_staff" on public.services;
create policy "services_select_staff"
  on public.services for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin', 'counselor')
    )
  );

drop policy if exists "service_milestones_select_staff" on public.service_milestones;
create policy "service_milestones_select_staff"
  on public.service_milestones for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'accountant', 'admin', 'counselor')
    )
  );

-- Clients assigned to this counselor (by counselors.user_id)
drop policy if exists "clients_select_counselor_assigned" on public.clients;
create policy "clients_select_counselor_assigned"
  on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.counselors c
      where c.id = clients.counselor_id
        and c.user_id = (select auth.uid())
    )
  );

-- Profiles: counselor reads assigned clients' names
drop policy if exists "profiles_select_for_counselor_clients" on public.profiles;
create policy "profiles_select_for_counselor_clients"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.clients cli
      join public.counselors cou on cou.id = cli.counselor_id and cou.user_id = (select auth.uid())
      where cli.user_id = profiles.id
    )
  );

-- Applications / logs / stage events for counselor's clients
drop policy if exists "applications_select_counselor_clients" on public.applications;
create policy "applications_select_counselor_clients"
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.clients cli
      join public.counselors cou on cou.id = cli.counselor_id and cou.user_id = (select auth.uid())
      where cli.id = applications.client_id
    )
  );

drop policy if exists "contact_logs_select_counselor_clients" on public.contact_logs;
create policy "contact_logs_select_counselor_clients"
  on public.contact_logs for select to authenticated
  using (
    exists (
      select 1 from public.clients cli
      join public.counselors cou on cou.id = cli.counselor_id and cou.user_id = (select auth.uid())
      where cli.id = contact_logs.client_id
    )
  );

drop policy if exists "client_stage_events_select_counselor_clients" on public.client_stage_events;
create policy "client_stage_events_select_counselor_clients"
  on public.client_stage_events for select to authenticated
  using (
    exists (
      select 1 from public.clients cli
      join public.counselors cou on cou.id = cli.counselor_id and cou.user_id = (select auth.uid())
      where cli.id = client_stage_events.client_id
    )
  );

-- ES / admin can insert contact logs and applications (for portal data entry)
drop policy if exists "contact_logs_insert_staff_es" on public.contact_logs;
create policy "contact_logs_insert_staff_es"
  on public.contact_logs for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'admin')
    )
  );

drop policy if exists "applications_insert_staff_es" on public.applications;
create policy "applications_insert_staff_es"
  on public.applications for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'admin')
    )
  );

-- ES can read/write timeline data for assigned clients (optional but keeps parity)
drop policy if exists "applications_select_es_assigned" on public.applications;
create policy "applications_select_es_assigned"
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = applications.client_id
    )
  );

drop policy if exists "contact_logs_select_es_assigned" on public.contact_logs;
create policy "contact_logs_select_es_assigned"
  on public.contact_logs for select to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = contact_logs.client_id
    )
  );

drop policy if exists "client_stage_events_select_es_assigned" on public.client_stage_events;
create policy "client_stage_events_select_es_assigned"
  on public.client_stage_events for select to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = client_stage_events.client_id
    )
  );
