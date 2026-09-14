-- Merge legacy "Workplace Readiness (GA)" into "Workplace Readiness Training (GA)".
-- Clients keep equivalent milestone by title; then remove duplicate service row.

do $$
declare
  v_keep_id uuid;
  v_remove_id uuid;
  v_fallback_stage_id uuid;
begin
  select id into v_keep_id
  from public.services
  where trim(name) = 'Workplace Readiness Training (GA)'
  limit 1;

  if v_keep_id is null then
    return;
  end if;

  select id into v_fallback_stage_id
  from public.service_milestones
  where service_id = v_keep_id
  order by order_index
  limit 1;

  for v_remove_id in
    select s.id
    from public.services s
    where s.id <> v_keep_id
      and (
        trim(s.name) = 'Workplace Readiness (GA)'
        or (
          trim(s.name) ilike 'Workplace Readiness'
          and coalesce(s.state::text, 'GA') = 'GA'
        )
      )
      and trim(s.name) not ilike '%Training%'
  loop
    -- Clients: map stage by milestone title (or name), then service id.
    update public.clients c
    set
      current_service_id = v_keep_id,
      current_stage_id = new_ms.id
    from public.service_milestones old_ms
    join public.service_milestones new_ms
      on new_ms.service_id = v_keep_id
      and lower(trim(coalesce(new_ms.title, new_ms.name, ''))) =
          lower(trim(coalesce(old_ms.title, old_ms.name, '')))
    where c.current_service_id = v_remove_id
      and c.current_stage_id = old_ms.id
      and old_ms.service_id = v_remove_id;

    update public.clients c
    set
      current_service_id = v_keep_id,
      current_stage_id = coalesce(c.current_stage_id, v_fallback_stage_id)
    where c.current_service_id = v_remove_id;

    update public.clients c
    set current_stage_id = v_fallback_stage_id
    where c.current_service_id = v_keep_id
      and c.current_stage_id is not null
      and exists (
        select 1 from public.service_milestones old_ms
        where old_ms.id = c.current_stage_id
          and old_ms.service_id = v_remove_id
      );

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'service_episodes'
    ) then
      update public.service_episodes
      set service_id = v_keep_id
      where service_id = v_remove_id;
    end if;

    update public.client_stage_events e
    set milestone_id = new_ms.id
    from public.service_milestones old_ms
    join public.service_milestones new_ms
      on new_ms.service_id = v_keep_id
      and lower(trim(coalesce(new_ms.title, new_ms.name, ''))) =
          lower(trim(coalesce(old_ms.title, old_ms.name, '')))
    where e.milestone_id = old_ms.id
      and old_ms.service_id = v_remove_id;

    delete from public.service_milestones
    where service_id = v_remove_id;

    delete from public.services
    where id = v_remove_id;
  end loop;
end;
$$;
