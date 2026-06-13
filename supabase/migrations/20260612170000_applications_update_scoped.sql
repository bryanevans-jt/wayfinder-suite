-- Scope application updates to assigned ES, scoped supervisors, and admin tier.

drop policy if exists "applications_update_staff" on public.applications;

drop policy if exists "applications_update_es_assigned" on public.applications;
create policy "applications_update_es_assigned"
  on public.applications for update to authenticated
  using (
    exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = applications.client_id
    )
  )
  with check (
    exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = applications.client_id
    )
  );

drop policy if exists "applications_update_supervisor_scoped" on public.applications;
create policy "applications_update_supervisor_scoped"
  on public.applications for update to authenticated
  using (public.client_visible_to_auth_user(applications.client_id))
  with check (public.client_visible_to_auth_user(applications.client_id));

drop policy if exists "applications_update_admin_tier" on public.applications;
create policy "applications_update_admin_tier"
  on public.applications for update to authenticated
  using (public.auth_user_is_admin_tier())
  with check (public.auth_user_is_admin_tier());
