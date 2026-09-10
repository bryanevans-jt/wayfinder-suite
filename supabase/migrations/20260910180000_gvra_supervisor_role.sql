-- GVRA Supervisor: office-scoped oversight over counselors (external to Joshua Tree team).

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
    'gvra_supervisor'
  )
);

comment on column public.profiles.role is
  'Includes gvra_supervisor for GVRA office supervisors (external partners; admin-managed only).';

-- Seed Debbie McEown over Valdosta when auth user and office exist.
do $$
declare
  debbie_id uuid;
  valdosta_office_id uuid;
begin
  select u.id into debbie_id
  from auth.users u
  where lower(u.email) = 'deborah.mceown@gvs.ga.gov'
  limit 1;

  select o.id into valdosta_office_id
  from public.offices o
  where lower(o.name) like '%valdosta%'
  order by o.created_at
  limit 1;

  if debbie_id is not null then
    insert into public.profiles (id, role, full_name, is_active)
    values (debbie_id, 'gvra_supervisor', 'Debbie McEown', true)
    on conflict (id) do update
    set
      role = 'gvra_supervisor',
      full_name = coalesce(nullif(trim(public.profiles.full_name), ''), 'Debbie McEown'),
      is_active = true;

    if valdosta_office_id is not null then
      delete from public.staff_office_assignments
      where user_id = debbie_id;

      insert into public.staff_office_assignments (user_id, office_id)
      values (debbie_id, valdosta_office_id)
      on conflict do nothing;
    end if;
  end if;
end $$;
