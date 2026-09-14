-- Canonical Individual Job Placement milestones:
-- Open → Hired → Working → On Hold → Dismissed → Complete
-- (Replaces legacy seed: Open, On Hold, Dismissed, Closed only.)

do $$
declare
  v_has_name boolean;
  v_service_id uuid;
  v_milestone_id uuid;
  v_complete_id uuid;
  v_ord int;
  v_title text;
  v_titles text[] := array[
    'Open',
    'Hired',
    'Working',
    'On Hold',
    'Dismissed',
    'Complete'
  ];
  rec record;
  legacy record;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_milestones'
      and column_name = 'name'
  ) into v_has_name;

  for rec in
    select id, name
    from public.services
    where name ~* 'individual job placement'
       or name ~* '\(ijp\)'
       or lower(trim(name)) = 'ijp'
  loop
    v_service_id := rec.id;

    -- Rename legacy terminal labels to Complete
    update public.service_milestones
    set title = 'Complete',
        name = case when v_has_name then 'complete' else name end
    where service_id = v_service_id
      and lower(trim(title)) in ('closed', 'closed successfully');

    foreach v_title in array v_titles loop
      select id into v_milestone_id
      from public.service_milestones
      where service_id = v_service_id
        and lower(trim(title)) = lower(trim(v_title))
      limit 1;

      if v_milestone_id is null then
        if v_has_name then
          insert into public.service_milestones (service_id, order_index, title, name)
          values (
            v_service_id,
            0,
            v_title,
            case
              when lower(v_title) = 'complete' then 'complete'
              else v_title
            end
          )
          returning id into v_milestone_id;
        else
          insert into public.service_milestones (service_id, order_index, title)
          values (v_service_id, 0, v_title)
          returning id into v_milestone_id;
        end if;
      end if;
    end loop;

    v_ord := 0;
    foreach v_title in array v_titles loop
      v_ord := v_ord + 10;
      update public.service_milestones
      set order_index = v_ord,
          title = v_title,
          name = case
            when v_has_name and lower(v_title) = 'complete' then 'complete'
            when v_has_name then v_title
            else name
          end
      where service_id = v_service_id
        and lower(trim(title)) = lower(trim(v_title));
    end loop;

    select id into v_complete_id
    from public.service_milestones
    where service_id = v_service_id
      and lower(trim(title)) = 'complete'
    limit 1;

    -- Move clients off unknown / legacy milestones onto Complete when terminal-like
    if v_complete_id is not null then
      for legacy in
        select m.id as legacy_id
        from public.service_milestones m
        where m.service_id = v_service_id
          and lower(trim(m.title)) not in (
            'open', 'hired', 'working', 'on hold', 'dismissed', 'complete'
          )
          and lower(trim(m.title)) ~ '^(closed|closed successfully|services[[:space:]]+interrupted)$'
      loop
        update public.clients
        set current_stage_id = v_complete_id
        where current_stage_id = legacy.legacy_id;

        update public.client_stage_events
        set milestone_id = v_complete_id
        where milestone_id = legacy.legacy_id;
      end loop;
    end if;

    -- Drop duplicate empty legacy rows (no client or event references)
    delete from public.service_milestones m
    where m.service_id = v_service_id
      and lower(trim(m.title)) not in (
        'open', 'hired', 'working', 'on hold', 'dismissed', 'complete'
      )
      and not exists (select 1 from public.clients c where c.current_stage_id = m.id)
      and not exists (select 1 from public.client_stage_events e where e.milestone_id = m.id);
  end loop;
end $$;
