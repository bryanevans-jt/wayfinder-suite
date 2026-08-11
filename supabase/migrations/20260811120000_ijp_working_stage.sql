-- Add Working under Hired for Individual Job Placement (GA) and (TN).

do $$
declare
  v_has_name boolean;
  v_service_id uuid;
  v_after_idx int;
  rec record;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_milestones' and column_name = 'name'
  ) into v_has_name;

  for rec in
    select * from (
      values
        ('Individual Job Placement (GA)'),
        ('Individual Job Placement (TN)')
    ) as t(service_name)
  loop
    select id
    into v_service_id
    from public.services
    where name = rec.service_name
    limit 1;

    if v_service_id is null then
      continue;
    end if;

    if exists (
      select 1
      from public.service_milestones m
      where m.service_id = v_service_id
        and lower(coalesce(m.title, '')) = 'working'
    ) then
      continue;
    end if;

    select coalesce(min(m.order_index), 0)
    into v_after_idx
    from public.service_milestones m
    where m.service_id = v_service_id
      and lower(coalesce(m.title, '')) = 'hired';

    if v_after_idx = 0 then
      select coalesce(min(m.order_index), 0)
      into v_after_idx
      from public.service_milestones m
      where m.service_id = v_service_id
        and lower(coalesce(m.title, '')) = 'open';
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
  end loop;
end $$;
