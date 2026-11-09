-- Optional broader staff access for Rendezvous (default off = super_admin only).
alter table public.admin_config
  add column if not exists rendezvous_open_to_all boolean not null default false;

comment on column public.admin_config.rendezvous_open_to_all is
  'When true (and rendezvous_enabled), ES/TS/supervisors/admins may use Rendezvous. When false, super_admin only.';

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
            'transition_specialist'
          ),
          false
        )
      )
    );
$$;

revoke all on function rendezvous.can_access_staff_app() from public, anon;
grant execute on function rendezvous.can_access_staff_app() to authenticated, service_role;
