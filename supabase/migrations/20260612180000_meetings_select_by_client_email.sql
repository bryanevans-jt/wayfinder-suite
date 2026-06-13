-- Allow clients matched by contact email to read and respond to their meeting requests.

drop policy if exists "meetings_select_participants" on public.client_meeting_requests;
create policy "meetings_select_participants"
  on public.client_meeting_requests for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and lower(trim(c.contact_email)) = lower(
          coalesce(
            (select email from auth.users where id = (select auth.uid())),
            ''
          )
        )
    )
    or es_user_id = (select auth.uid())
    or exists (
      select 1 from public.support_client_assignments s
      where s.client_id = client_meeting_requests.client_id
        and s.support_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('supervisor', 'admin', 'super_admin')
    )
  );

drop policy if exists "meetings_update_participants" on public.client_meeting_requests;
create policy "meetings_update_participants"
  on public.client_meeting_requests for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and lower(trim(c.contact_email)) = lower(
          coalesce(
            (select email from auth.users where id = (select auth.uid())),
            ''
          )
        )
    )
    or es_user_id = (select auth.uid())
  );
