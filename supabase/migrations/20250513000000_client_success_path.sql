-- Client success path: clients, services, milestones, support assignments.
-- Run after profiles migration.

-- Legacy Supabase projects may already have public.clients without an id column.
-- Foreign keys require clients.id; add it before any references.
do $$
begin
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

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_milestones (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  order_index int not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (service_id, order_index)
);

create index if not exists service_milestones_service_order_idx
  on public.service_milestones (service_id, order_index);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  current_service_id uuid references public.services (id) on delete set null,
  current_stage_id uuid references public.service_milestones (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Legacy public.clients may exist without Wayfinder columns (id repair above is not enough).
alter table public.clients add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.clients add column if not exists current_service_id uuid references public.services (id) on delete set null;
alter table public.clients add column if not exists current_stage_id uuid references public.service_milestones (id) on delete set null;
alter table public.clients add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'profile_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'user_id'
  ) then
    alter table public.clients rename column profile_id to user_id;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'auth_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'user_id'
  ) then
    alter table public.clients rename column auth_user_id to user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'user_id'
  ) then
    update public.clients c
    set user_id = c.id
    where c.user_id is null
      and exists (select 1 from auth.users u where u.id = c.id);
  end if;
end $$;

update public.clients set created_at = now() where created_at is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'created_at'
  ) then
    alter table public.clients alter column created_at set default now();
    begin
      alter table public.clients alter column created_at set not null;
    exception
      when others then null;
    end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'user_id'
  ) and not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'clients' and c.conname = 'clients_user_id_key'
  ) then
    begin
      alter table public.clients add constraint clients_user_id_key unique (user_id);
    exception
      when others then null;
    end;
  end if;
end $$;

create table if not exists public.support_client_assignments (
  id uuid primary key default gen_random_uuid(),
  support_user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (support_user_id, client_id)
);

create index if not exists support_assignments_support_idx
  on public.support_client_assignments (support_user_id);

-- RLS
alter table public.services enable row level security;
alter table public.service_milestones enable row level security;
alter table public.clients enable row level security;
alter table public.support_client_assignments enable row level security;

drop policy if exists "services_select_for_path" on public.services;
create policy "services_select_for_path"
  on public.services for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.current_service_id = services.id
        and (
          c.user_id = (select auth.uid())
          or exists (
            select 1 from public.support_client_assignments s
            where s.client_id = c.id and s.support_user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "milestones_select_for_path" on public.service_milestones;
create policy "milestones_select_for_path"
  on public.service_milestones for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.current_service_id = service_milestones.service_id
        and (
          c.user_id = (select auth.uid())
          or exists (
            select 1 from public.support_client_assignments s
            where s.client_id = c.id and s.support_user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
  on public.clients for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "clients_select_support_assigned" on public.clients;
create policy "clients_select_support_assigned"
  on public.clients for select to authenticated
  using (
    exists (
      select 1 from public.support_client_assignments s
      where s.client_id = clients.id and s.support_user_id = (select auth.uid())
    )
  );

drop policy if exists "support_assignments_select_own" on public.support_client_assignments;
create policy "support_assignments_select_own"
  on public.support_client_assignments for select to authenticated
  using (support_user_id = (select auth.uid()));
