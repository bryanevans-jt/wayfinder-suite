-- Client portal: honor profile_id / user_id interchangeably and let clients read their ES assignment.

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
  on public.clients for select to authenticated
  using (coalesce(user_id, profile_id) = (select auth.uid()));

drop policy if exists "services_select_for_path" on public.services;
create policy "services_select_for_path"
  on public.services for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.current_service_id = services.id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.support_client_assignments s on s.client_id = c.id
      where c.current_service_id = services.id
        and s.support_user_id = (select auth.uid())
    )
  );

drop policy if exists "milestones_select_for_path" on public.service_milestones;
create policy "milestones_select_for_path"
  on public.service_milestones for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.current_service_id = service_milestones.service_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.support_client_assignments s on s.client_id = c.id
      where c.current_service_id = service_milestones.service_id
        and s.support_user_id = (select auth.uid())
    )
  );

drop policy if exists "es_client_assignments_select_own_client" on public.es_client_assignments;
create policy "es_client_assignments_select_own_client"
  on public.es_client_assignments for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = es_client_assignments.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
  );

drop policy if exists "message_threads_select_participants" on public.client_message_threads;
create policy "message_threads_select_participants"
  on public.client_message_threads for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_message_threads.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or current_es_user_id = (select auth.uid())
    or exists (
      select 1 from public.supervisor_es_assignments s
      where s.supervisor_user_id = (select auth.uid())
        and s.es_user_id = client_message_threads.current_es_user_id
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "message_threads_insert_client" on public.client_message_threads;
create policy "message_threads_insert_client"
  on public.client_message_threads for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_message_threads.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
  );

drop policy if exists "client_messages_select_participants" on public.client_messages;
create policy "client_messages_select_participants"
  on public.client_messages for select to authenticated
  using (
    exists (
      select 1 from public.client_message_threads t
      join public.clients c on c.id = t.client_id
      where t.id = client_messages.thread_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.client_message_threads t
      where t.id = client_messages.thread_id
        and t.current_es_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.client_message_threads t
      join public.supervisor_es_assignments s on s.es_user_id = t.current_es_user_id
      where t.id = client_messages.thread_id
        and s.supervisor_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "client_messages_insert_participants" on public.client_messages;
create policy "client_messages_insert_participants"
  on public.client_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.client_message_threads t
        join public.clients c on c.id = t.client_id
        where t.id = client_messages.thread_id
          and coalesce(c.user_id, c.profile_id) = (select auth.uid())
          and client_messages.sender_role = 'client'
      )
      or exists (
        select 1 from public.client_message_threads t
        where t.id = client_messages.thread_id
          and t.current_es_user_id = (select auth.uid())
          and client_messages.sender_role = 'es'
      )
      or exists (
        select 1 from public.client_message_threads t
        join public.supervisor_es_assignments s on s.es_user_id = t.current_es_user_id
        where t.id = client_messages.thread_id
          and s.supervisor_user_id = (select auth.uid())
          and client_messages.sender_role = 'supervisor'
      )
    )
  );

drop policy if exists "meetings_select_participants" on public.client_meeting_requests;
create policy "meetings_select_participants"
  on public.client_meeting_requests for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
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
    or es_user_id = (select auth.uid())
  );
