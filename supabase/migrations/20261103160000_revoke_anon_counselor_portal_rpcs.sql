-- Counselor portal RPCs are security definer and must not be executable by anon.
-- They already return empty without a JWT, but anon EXECUTE was still granted in production.

revoke all on function public.get_counselor_portal_clients() from public;
revoke all on function public.get_counselor_portal_clients() from anon;
grant execute on function public.get_counselor_portal_clients() to authenticated;
grant execute on function public.get_counselor_portal_clients() to service_role;

revoke all on function public.get_counselor_portal_clients_for(uuid) from public;
revoke all on function public.get_counselor_portal_clients_for(uuid) from anon;
grant execute on function public.get_counselor_portal_clients_for(uuid) to authenticated;
grant execute on function public.get_counselor_portal_clients_for(uuid) to service_role;

revoke all on function public.auth_user_counselor_id() from public;
revoke all on function public.auth_user_counselor_id() from anon;
grant execute on function public.auth_user_counselor_id() to authenticated;
grant execute on function public.auth_user_counselor_id() to service_role;
