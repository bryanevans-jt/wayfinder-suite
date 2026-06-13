-- Client success path: align service/stage ids and let clients read milestones via current stage.

update public.clients c
set current_service_id = m.service_id
from public.service_milestones m
where c.current_stage_id = m.id
  and c.current_service_id is distinct from m.service_id;

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
      join public.service_milestones m on m.id = c.current_stage_id
      where m.service_id = services.id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.support_client_assignments s on s.client_id = c.id
      where c.current_service_id = services.id
        and s.support_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.service_milestones m on m.id = c.current_stage_id
      join public.support_client_assignments s on s.client_id = c.id
      where m.service_id = services.id
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
      join public.service_milestones stage on stage.id = c.current_stage_id
      where stage.service_id = service_milestones.service_id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      where c.current_stage_id = service_milestones.id
        and coalesce(c.user_id, c.profile_id) = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.support_client_assignments s on s.client_id = c.id
      where c.current_service_id = service_milestones.service_id
        and s.support_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.clients c
      join public.service_milestones stage on stage.id = c.current_stage_id
      join public.support_client_assignments s on s.client_id = c.id
      where stage.service_id = service_milestones.service_id
        and s.support_user_id = (select auth.uid())
    )
  );
