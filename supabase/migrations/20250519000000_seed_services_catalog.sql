-- Seed Wayfinder service catalog + milestones (idempotent; safe on legacy schemas with state / name columns).

alter table public.service_milestones add column if not exists title text;
alter table public.service_milestones add column if not exists name text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_milestones' and column_name = 'name'
  ) then
    update public.service_milestones
    set title = coalesce(nullif(trim(title), ''), name)
    where title is null or trim(title) = '';
  end if;
end $$;

-- Insert services (with optional state enum column on legacy DBs).
do $$
declare
  v_has_state boolean;
  v_state_is_enum boolean;
  v_service_id uuid;
  v_tse_milestones text[] := array[
    'Phase 1: Intake',
    'Phase 2: Job Development',
    'Phase 3: Training & OS 1',
    'Phase 4: Training & OS 2',
    'Stabilization / Extended Support',
    'On Hold',
    'Dismissed',
    'Closed'
  ];
  v_default_milestones text[] := array[
    'Open',
    'On Hold',
    'Dismissed',
    'Closed'
  ];
  v_milestone_titles text[];
  v_title text;
  v_idx int;
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

  for rec in
    select *
    from (
      values
        ('Traditional Supported Employment (GA)', 'GA'),
        ('Individual Job Placement (GA)', 'GA'),
        ('Supported Employment (TN)', 'TN')
    ) as t(service_name, state_code)
  loop
    if v_has_state then
      if v_state_is_enum then
        execute '
          insert into public.services (name, state)
          select $1, $2::state_code
          where not exists (select 1 from public.services s where s.name = $1)
          returning id'
        into v_service_id
        using rec.service_name, rec.state_code;
      else
        execute '
          insert into public.services (name, state)
          select $1, $2
          where not exists (select 1 from public.services s where s.name = $1)
          returning id'
        into v_service_id
        using rec.service_name, rec.state_code;
      end if;
    else
      insert into public.services (name)
      select rec.service_name
      where not exists (select 1 from public.services s where s.name = rec.service_name)
      returning id into v_service_id;
    end if;

    if v_service_id is null then
      select id into v_service_id from public.services where name = rec.service_name limit 1;
    end if;

    if v_service_id is null then
      continue;
    end if;

    if rec.service_name = 'Traditional Supported Employment (GA)' then
      v_milestone_titles := v_tse_milestones;
    else
      v_milestone_titles := v_default_milestones;
    end if;

    v_idx := 0;
    foreach v_title in array v_milestone_titles loop
      v_idx := v_idx + 1;
      if not exists (
        select 1 from public.service_milestones m
        where m.service_id = v_service_id and m.order_index = v_idx
      ) then
        if exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'service_milestones' and column_name = 'name'
        ) then
          insert into public.service_milestones (service_id, order_index, title, name)
          values (v_service_id, v_idx, v_title, v_title);
        else
          insert into public.service_milestones (service_id, order_index, title)
          values (v_service_id, v_idx, v_title);
        end if;
      end if;
    end loop;

    v_service_id := null;
  end loop;
end $$;
