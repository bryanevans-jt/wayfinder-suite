-- Director of Transition Services + Director of Development & Vocational Services.
-- View-only scoped oversight roles (role-derived staff scope; no new assignment tables).

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    begin
      alter type public.user_role add value if not exists 'transition_director';
    exception
      when duplicate_object then null;
    end;
    begin
      alter type public.user_role add value if not exists 'vocational_director';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (
  role::text in (
    'client',
    'support',
    'es',
    'supervisor',
    'accountant',
    'admin',
    'counselor',
    'super_admin',
    'hr',
    'hospitality_specialist',
    'wrt_admin',
    'instructor',
    'transition_specialist',
    'gvra_supervisor',
    'transition_director',
    'vocational_director'
  )
);

comment on column public.profiles.role is
  'Includes transition_director and vocational_director (view-only scoped oversight).';

create or replace function public.auth_user_is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.get_auth_user_role() in ('transition_director', 'vocational_director'),
    false
  );
$$;

create or replace function public.auth_user_is_read_only_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_user_is_director();
$$;

/**
 * Staff profile IDs a director may view — derived from role, not assignment tables.
 * Transition: instructor + transition_specialist + supervisor.
 * Vocational: es + supervisor.
 * Admin/super_admin never included.
 */
create or replace function public.auth_user_director_staff_scope_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.get_auth_user_role();
begin
  if v_role = 'transition_director' then
    return query
    select p.id
    from public.profiles p
    where p.role::text in ('instructor', 'transition_specialist', 'supervisor')
      and coalesce(p.is_active, true);
    return;
  end if;

  if v_role = 'vocational_director' then
    return query
    select p.id
    from public.profiles p
    where p.role::text in ('es', 'supervisor')
      and coalesce(p.is_active, true);
    return;
  end if;
end;
$$;

create or replace function public.client_visible_to_auth_user(p_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
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

  -- Directors: read-only visibility for clients tied to staff in their role scope.
  if public.auth_user_is_director() then
    if exists (
      select 1
      from public.es_client_assignments e
      where e.client_id = p_client_id
        and e.es_user_id in (select public.auth_user_director_staff_scope_ids())
    ) then
      return true;
    end if;

    if exists (
      select 1
      from public.clients c
      where c.id = p_client_id
        and c.supervisor_user_id in (select public.auth_user_director_staff_scope_ids())
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- Rendezvous staff app: directors may enter when open_to_all (view Team Calendar).
create or replace function rendezvous.can_access_staff_app()
returns boolean
language sql
stable
security definer
set search_path = public, rendezvous
as $$
  select rendezvous.feature_enabled()
    and (
      coalesce(public.auth_user_is_super_admin(), false)
      or (
        coalesce(
          (select ac.rendezvous_open_to_all from public.admin_config ac limit 1),
          false
        )
        and coalesce(
          public.get_auth_user_role() in (
            'super_admin',
            'admin',
            'supervisor',
            'es',
            'transition_specialist',
            'transition_director',
            'vocational_director'
          ),
          false
        )
      )
    );
$$;

-- Rendezvous schedule visibility for directors (scoped staff only).
create or replace function rendezvous.can_view_staff_schedule(target_staff_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, rendezvous
as $$
  select case
    when target_staff_user_id is null then false
    when public.auth_user_is_admin_tier() then true
    when target_staff_user_id = auth.uid() then true
    when public.get_auth_user_role() = 'supervisor'
      and target_staff_user_id in (select public.auth_user_supervised_es_ids()) then true
    when public.auth_user_is_director()
      and target_staff_user_id in (select public.auth_user_director_staff_scope_ids()) then true
    else false
  end;
$$;

revoke all on function public.auth_user_is_director() from public, anon;
revoke all on function public.auth_user_is_read_only_staff() from public, anon;
revoke all on function public.auth_user_director_staff_scope_ids() from public, anon;

grant execute on function public.auth_user_is_director() to authenticated, service_role;
grant execute on function public.auth_user_is_read_only_staff() to authenticated, service_role;
grant execute on function public.auth_user_director_staff_scope_ids() to authenticated, service_role;

revoke all on function rendezvous.can_access_staff_app() from public, anon;
grant execute on function rendezvous.can_access_staff_app() to authenticated, service_role;
revoke all on function rendezvous.can_view_staff_schedule(uuid) from public, anon;
grant execute on function rendezvous.can_view_staff_schedule(uuid) to authenticated, service_role;
