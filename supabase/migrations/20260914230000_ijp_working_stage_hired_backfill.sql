-- Ensure Working exists on IJP services and move hired clients from Open/Hired → Working.

do $$
declare
  v_has_name boolean;
  v_service_id uuid;
  v_after_idx int;
  v_working_id uuid;
  rec record;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_milestones' and column_name = 'name'
  ) into v_has_name;

  for rec in
    select id, name
    from public.services
    where name ~* 'individual job placement'
       or name ~* '\(ijp\)'
       or name ~* '^ijp$'
  loop
    v_service_id := rec.id;

    if not exists (
      select 1
      from public.service_milestones m
      where m.service_id = v_service_id
        and lower(trim(coalesce(m.title, ''))) = 'working'
    ) then
      select coalesce(min(m.order_index), 0)
      into v_after_idx
      from public.service_milestones m
      where m.service_id = v_service_id
        and lower(trim(coalesce(m.title, ''))) = 'hired';

      if v_after_idx = 0 then
        select coalesce(min(m.order_index), 0)
        into v_after_idx
        from public.service_milestones m
        where m.service_id = v_service_id
          and lower(trim(coalesce(m.title, ''))) = 'open';
      end if;

      if v_after_idx = 0 then
        select coalesce(max(m.order_index), 0)
        into v_after_idx
        from public.service_milestones m
        where m.service_id = v_service_id;
      end if;

      update public.service_milestones
      set order_index = order_index + 1
      where service_id = v_service_id
        and order_index > v_after_idx;

      if v_has_name then
        insert into public.service_milestones (service_id, order_index, title, name)
        values (v_service_id, v_after_idx + 1, 'Working', 'Working');
      else
        insert into public.service_milestones (service_id, order_index, title)
        values (v_service_id, v_after_idx + 1, 'Working');
      end if;
    end if;

    select m.id
    into v_working_id
    from public.service_milestones m
    where m.service_id = v_service_id
      and lower(trim(coalesce(m.title, ''))) = 'working'
    limit 1;

    if v_working_id is null then
      continue;
    end if;

    update public.clients c
    set current_stage_id = v_working_id,
        last_activity_at = coalesce(c.last_activity_at, now())
    from public.service_milestones cur_ms
    where c.current_service_id = v_service_id
      and c.current_stage_id = cur_ms.id
      and lower(trim(coalesce(cur_ms.title, ''))) in ('open', 'hired')
      and c.archived_at is null
      and (
        c.job_start_date is not null
        or exists (
          select 1
          from public.applications a
          where a.client_id in (c.id, c.user_id, c.profile_id)
            and lower(trim(coalesce(a.status, ''))) = 'hired'
        )
      );
  end loop;
end $$;
