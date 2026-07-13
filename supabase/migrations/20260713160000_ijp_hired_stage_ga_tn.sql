-- Ensure Individual Job Placement (GA) and (TN) exist, with Hired under Open.

do $$
declare
  v_has_state boolean;
  v_state_is_enum boolean;
  v_has_name boolean;
  v_service_id uuid;
  v_open_idx int;
  rec record;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'state'
  ) into v_has_state;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'state'
      and udt_name = 'state_code'
  ) into v_state_is_enum;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_milestones' and column_name = 'name'
  ) into v_has_name;

  for rec in
    select * from (
      values
        ('Individual Job Placement (GA)', 'GA'),
        ('Individual Job Placement (TN)', 'TN')
    ) as t(service_name, state_code)
  loop
    select id into v_service_id from public.services where name = rec.service_name limit 1;

    if v_service_id is null then
      if v_has_state then
        if v_state_is_enum then
          execute '
            insert into public.services (name, state)
            values ($1, $2::state_code)
            returning id'
          into v_service_id
          using rec.service_name, rec.state_code;
        else
          insert into public.services (name, state)
          values (rec.service_name, rec.state_code)
          returning id into v_service_id;
        end if;
      else
        insert into public.services (name)
        values (rec.service_name)
        returning id into v_service_id;
      end if;
    end if;

    if v_service_id is null then
      continue;
    end if;

    -- Ensure Open exists when the service is empty.
    if not exists (
      select 1 from public.service_milestones m
      where m.service_id = v_service_id
        and lower(coalesce(m.title, '')) = 'open'
    ) then
      if not exists (
        select 1 from public.service_milestones where service_id = v_service_id
      ) then
        if v_has_name then
          insert into public.service_milestones (service_id, order_index, title, name)
          values
            (v_service_id, 1, 'Open', 'Open'),
            (v_service_id, 2, 'Hired', 'Hired'),
            (v_service_id, 3, 'On Hold', 'On Hold'),
            (v_service_id, 4, 'Dismissed', 'Dismissed'),
            (v_service_id, 5, 'Closed', 'Closed');
        else
          insert into public.service_milestones (service_id, order_index, title)
          values
            (v_service_id, 1, 'Open'),
            (v_service_id, 2, 'Hired'),
            (v_service_id, 3, 'On Hold'),
            (v_service_id, 4, 'Dismissed'),
            (v_service_id, 5, 'Closed');
        end if;
        continue;
      end if;

      if v_has_name then
        insert into public.service_milestones (service_id, order_index, title, name)
        values (v_service_id, 1, 'Open', 'Open');
      else
        insert into public.service_milestones (service_id, order_index, title)
        values (v_service_id, 1, 'Open');
      end if;
    end if;

    if exists (
      select 1 from public.service_milestones m
      where m.service_id = v_service_id
        and lower(coalesce(m.title, '')) = 'hired'
    ) then
      continue;
    end if;

    select coalesce(min(m.order_index), 1)
    into v_open_idx
    from public.service_milestones m
    where m.service_id = v_service_id
      and lower(coalesce(m.title, '')) = 'open';

    update public.service_milestones
    set order_index = order_index + 1
    where service_id = v_service_id
      and order_index > v_open_idx;

    if v_has_name then
      insert into public.service_milestones (service_id, order_index, title, name)
      values (v_service_id, v_open_idx + 1, 'Hired', 'Hired');
    else
      insert into public.service_milestones (service_id, order_index, title)
      values (v_service_id, v_open_idx + 1, 'Hired');
    end if;
  end loop;
end $$;
