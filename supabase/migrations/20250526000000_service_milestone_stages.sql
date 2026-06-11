-- Service milestone stages: TSE (GA) path vs standard path for all other services.

create or replace function public.sync_service_milestone_titles(
  p_service_id uuid,
  p_titles text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid[];
  v_id uuid;
  v_i int;
  v_fallback uuid;
  v_title text;
  v_has_name_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_milestones'
      and column_name = 'name'
  ) into v_has_name_col;

  select coalesce(array_agg(id order by order_index), array[]::uuid[])
  into v_existing
  from public.service_milestones
  where service_id = p_service_id;

  v_fallback := null;

  for v_i in 1..coalesce(array_length(p_titles, 1), 0) loop
    v_title := p_titles[v_i];

    if v_i <= coalesce(array_length(v_existing, 1), 0) then
      v_id := v_existing[v_i];
      update public.service_milestones
      set
        title = v_title,
        order_index = v_i,
        name = case when v_has_name_col then v_title else name end
      where id = v_id;
    else
      if v_has_name_col then
        insert into public.service_milestones (service_id, order_index, title, name)
        values (p_service_id, v_i, v_title, v_title)
        returning id into v_id;
      else
        insert into public.service_milestones (service_id, order_index, title)
        values (p_service_id, v_i, v_title)
        returning id into v_id;
      end if;
    end if;

    if v_fallback is null then
      v_fallback := v_id;
    end if;
  end loop;

  if coalesce(array_length(v_existing, 1), 0) > coalesce(array_length(p_titles, 1), 0) then
    for v_i in (coalesce(array_length(p_titles, 1), 0) + 1)..array_length(v_existing, 1) loop
      v_id := v_existing[v_i];
      if v_fallback is not null then
        update public.clients
        set current_stage_id = v_fallback
        where current_stage_id = v_id;
      end if;
      delete from public.service_milestones where id = v_id;
    end loop;
  end if;

  if v_fallback is not null then
    update public.clients c
    set current_stage_id = v_fallback
    where c.current_service_id = p_service_id
      and c.current_stage_id is not null
      and not exists (
        select 1 from public.service_milestones m
        where m.id = c.current_stage_id and m.service_id = p_service_id
      );
  end if;
end;
$$;

do $$
declare
  v_tse_titles text[] := array[
    'Phase 1: Intake',
    'Phase 2: Job Development',
    'Phase 3: Training & OS 1',
    'Phase 4: Training & OS 2',
    'Stabilization / Extended Support',
    'On Hold',
    'Dismissed',
    'Closed'
  ];
  v_default_titles text[] := array[
    'Open',
    'On Hold',
    'Dismissed',
    'Closed'
  ];
  v_rec record;
  v_is_tse boolean;
  v_has_state boolean;
  v_state text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'state'
  ) into v_has_state;

  for v_rec in select id, name from public.services loop
    v_is_tse := v_rec.name = 'Traditional Supported Employment (GA)'
      or v_rec.name ilike 'Traditional Supported Employment (GA)%';

    if not v_is_tse and v_rec.name ilike 'Traditional Supported Employment%' then
      v_state := null;
      if v_has_state then
        execute 'select state::text from public.services where id = $1'
          into v_state
          using v_rec.id;
      end if;
      v_is_tse := v_rec.name ~ '\(GA\)' or upper(coalesce(v_state, '')) = 'GA';
    end if;

    if v_is_tse then
      perform public.sync_service_milestone_titles(v_rec.id, v_tse_titles);
    else
      perform public.sync_service_milestone_titles(v_rec.id, v_default_titles);
    end if;
  end loop;
end;
$$;

drop function if exists public.sync_service_milestone_titles(uuid, text[]);
