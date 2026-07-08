-- TN supported employment: one service ("Supported Employment (TN)") with TN-specific stages.
-- Remove duplicate "Traditional Supported Employment (TN)" created during TSE alignment.

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
  v_tn_se_titles text[] := array[
    'Consultation',
    'Career Development',
    'Career Stabilization',
    'Successful Outcome',
    'Services Interrupted'
  ];
  v_keep_id uuid;
  v_remove_id uuid;
  v_first_stage_id uuid;
begin
  select id into v_keep_id
  from public.services
  where name = 'Supported Employment (TN)'
  limit 1;

  if v_keep_id is null then
    raise exception 'Supported Employment (TN) service not found';
  end if;

  select id into v_remove_id
  from public.services
  where name = 'Traditional Supported Employment (TN)'
  limit 1;

  perform public.sync_service_milestone_titles(v_keep_id, v_tn_se_titles);

  select id into v_first_stage_id
  from public.service_milestones
  where service_id = v_keep_id
  order by order_index
  limit 1;

  if v_remove_id is not null then
    update public.clients
    set
      current_service_id = v_keep_id,
      current_stage_id = coalesce(v_first_stage_id, current_stage_id)
    where current_service_id = v_remove_id;

    delete from public.services where id = v_remove_id;
  end if;
end;
$$;

drop function if exists public.sync_service_milestone_titles(uuid, text[]);
