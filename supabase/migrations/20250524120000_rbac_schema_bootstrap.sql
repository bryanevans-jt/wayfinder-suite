-- RBAC schema bootstrap (idempotent). Run AFTER 20250524100000 (super_admin enum).
-- Safe to run if 20250524000000 failed partway through.

-- Protected accounts
create table if not exists public.system_protected_profiles (
  profile_id uuid primary key references public.profiles (id) on delete restrict,
  protection_level text not null default 'super_admin'
    check (protection_level in ('super_admin')),
  created_at timestamptz not null default now()
);

create or replace function public.prevent_protected_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.system_protected_profiles p where p.profile_id = old.id
    ) then
      raise exception 'This account is protected and cannot be deleted';
    end if;
    return old;
  end if;

  if exists (
    select 1 from public.system_protected_profiles p where p.profile_id = old.id
  ) then
    if new.role is distinct from old.role and new.role::text <> 'super_admin' then
      raise exception 'Protected super admin role cannot be changed';
    end if;
    if new.is_active is distinct from old.is_active and new.is_active = false then
      raise exception 'Protected account cannot be deactivated';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_system_accounts on public.profiles;

create trigger profiles_protect_system_accounts
  before update or delete on public.profiles
  for each row
  execute function public.prevent_protected_profile_changes();

-- Many-to-many office assignments
create table if not exists public.counselor_office_assignments (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.counselors (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (counselor_id, office_id)
);

create index if not exists counselor_office_assignments_office_idx
  on public.counselor_office_assignments (office_id);

create table if not exists public.staff_office_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, office_id)
);

create index if not exists staff_office_assignments_office_idx
  on public.staff_office_assignments (office_id);

create table if not exists public.supervisor_es_assignments (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null references auth.users (id) on delete cascade,
  es_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (supervisor_user_id, es_user_id)
);

create index if not exists supervisor_es_assignments_es_idx
  on public.supervisor_es_assignments (es_user_id);

insert into public.counselor_office_assignments (counselor_id, office_id)
select c.id, c.office_id
from public.counselors c
where c.office_id is not null
on conflict (counselor_id, office_id) do nothing;

-- Role helpers (include super_admin)
create or replace function public.get_auth_user_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_role text;
begin
  set local row_security = off;
  select role::text into found_role
  from public.profiles
  where id = auth.uid()
  limit 1;
  return found_role;
end;
$$;

create or replace function public.auth_user_is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.get_auth_user_role() = 'super_admin', false);
$$;

create or replace function public.auth_user_is_admin_tier()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in ('super_admin', 'admin'),
    false
  );
$$;

create or replace function public.auth_user_is_supervisor_tier()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in ('super_admin', 'admin', 'supervisor'),
    false
  );
$$;

create or replace function public.auth_user_has_staff_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in (
      'es',
      'supervisor',
      'accountant',
      'admin',
      'counselor',
      'super_admin'
    ),
    false
  );
$$;

create or replace function public.auth_user_has_es_staff_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in ('es', 'supervisor', 'admin', 'super_admin'),
    false
  );
$$;

create or replace function public.auth_user_office_ids()
returns setof uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.auth_user_is_admin_tier() then
    return query select o.id from public.offices o;
    return;
  end if;

  return query
  select soa.office_id
  from public.staff_office_assignments soa
  where soa.user_id = auth.uid();
end;
$$;

create or replace function public.auth_user_supervised_es_ids()
returns setof uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.auth_user_is_admin_tier() then
    return query
    select p.id
    from public.profiles p
    where p.role::text = 'es';
    return;
  end if;

  return query
  select sea.es_user_id
  from public.supervisor_es_assignments sea
  where sea.supervisor_user_id = auth.uid();
end;
$$;

create or replace function public.client_visible_to_auth_user(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_office_id uuid;
begin
  if p_client_id is null then
    return false;
  end if;

  if public.auth_user_is_admin_tier() then
    return true;
  end if;

  if exists (
    select 1 from public.es_client_assignments e
    where e.client_id = p_client_id and e.es_user_id = auth.uid()
  ) then
    return true;
  end if;

  if public.get_auth_user_role() = 'supervisor' then
    select c.office_id into v_office_id
    from public.clients c
    where c.id = p_client_id;

    if v_office_id is not null and v_office_id in (
      select public.auth_user_office_ids()
    ) then
      return true;
    end if;

    if exists (
      select 1
      from public.es_client_assignments e
      where e.client_id = p_client_id
        and e.es_user_id in (select public.auth_user_supervised_es_ids())
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function public.auth_user_is_super_admin() from public;
revoke all on function public.auth_user_is_admin_tier() from public;
revoke all on function public.auth_user_is_supervisor_tier() from public;
revoke all on function public.client_visible_to_auth_user(uuid) from public;

grant execute on function public.auth_user_is_super_admin() to authenticated;
grant execute on function public.auth_user_is_admin_tier() to authenticated;
grant execute on function public.auth_user_is_supervisor_tier() to authenticated;
grant execute on function public.client_visible_to_auth_user(uuid) to authenticated;

alter table public.counselor_office_assignments enable row level security;
alter table public.staff_office_assignments enable row level security;
alter table public.supervisor_es_assignments enable row level security;
alter table public.system_protected_profiles enable row level security;

drop policy if exists "counselor_office_assignments_select_staff" on public.counselor_office_assignments;
create policy "counselor_office_assignments_select_staff"
  on public.counselor_office_assignments for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "staff_office_assignments_select_staff" on public.staff_office_assignments;
create policy "staff_office_assignments_select_staff"
  on public.staff_office_assignments for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "supervisor_es_assignments_select_staff" on public.supervisor_es_assignments;
create policy "supervisor_es_assignments_select_staff"
  on public.supervisor_es_assignments for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "system_protected_profiles_select_super_admin" on public.system_protected_profiles;
create policy "system_protected_profiles_select_super_admin"
  on public.system_protected_profiles for select to authenticated
  using (public.auth_user_is_super_admin());

drop policy if exists "clients_select_admin_tier" on public.clients;
create policy "clients_select_admin_tier"
  on public.clients for select to authenticated
  using (public.client_visible_to_auth_user(id));

drop policy if exists "contact_logs_select_admin_tier" on public.contact_logs;
create policy "contact_logs_select_admin_tier"
  on public.contact_logs for select to authenticated
  using (public.client_visible_to_auth_user(client_id));

drop policy if exists "applications_select_admin_tier" on public.applications;
create policy "applications_select_admin_tier"
  on public.applications for select to authenticated
  using (public.client_visible_to_auth_user(client_id));

drop policy if exists "client_stage_events_select_admin_tier" on public.client_stage_events;
create policy "client_stage_events_select_admin_tier"
  on public.client_stage_events for select to authenticated
  using (public.client_visible_to_auth_user(client_id));

drop policy if exists "es_client_assignments_select_admin_tier" on public.es_client_assignments;
create policy "es_client_assignments_select_admin_tier"
  on public.es_client_assignments for select to authenticated
  using (
    public.auth_user_is_admin_tier()
    or es_user_id = auth.uid()
    or public.client_visible_to_auth_user(client_id)
  );

drop policy if exists "offices_write_admin_tier" on public.offices;
create policy "offices_write_admin_tier"
  on public.offices for all to authenticated
  using (public.auth_user_is_admin_tier())
  with check (public.auth_user_is_admin_tier());
