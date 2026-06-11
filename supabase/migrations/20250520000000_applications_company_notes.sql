-- Application employer + notes; client read access for activity timeline.

alter table public.applications
  add column if not exists company_name text,
  add column if not exists notes text;

drop policy if exists "applications_select_own_client" on public.applications;
create policy "applications_select_own_client"
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = applications.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
  );

drop policy if exists "contact_logs_select_own_client" on public.contact_logs;
create policy "contact_logs_select_own_client"
  on public.contact_logs for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = contact_logs.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
  );

drop policy if exists "client_stage_events_select_own_client" on public.client_stage_events;
create policy "client_stage_events_select_own_client"
  on public.client_stage_events for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_stage_events.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
  );

drop policy if exists "applications_select_support_assigned" on public.applications;
create policy "applications_select_support_assigned"
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.support_client_assignments s
      where s.support_user_id = (select auth.uid())
        and s.client_id = applications.client_id
    )
  );

drop policy if exists "contact_logs_select_support_assigned" on public.contact_logs;
create policy "contact_logs_select_support_assigned"
  on public.contact_logs for select to authenticated
  using (
    exists (
      select 1 from public.support_client_assignments s
      where s.support_user_id = (select auth.uid())
        and s.client_id = contact_logs.client_id
    )
  );

drop policy if exists "client_stage_events_select_support_assigned" on public.client_stage_events;
create policy "client_stage_events_select_support_assigned"
  on public.client_stage_events for select to authenticated
  using (
    exists (
      select 1 from public.support_client_assignments s
      where s.support_user_id = (select auth.uid())
        and s.client_id = client_stage_events.client_id
    )
  );
