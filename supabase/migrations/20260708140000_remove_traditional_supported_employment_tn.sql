-- Remove any remaining "Traditional Supported Employment (TN)" rows and reassign clients
-- to the canonical "Supported Employment (TN)" service.

do $$
declare
  v_keep_id uuid;
  v_remove_id uuid;
  v_first_stage_id uuid;
begin
  select id into v_keep_id
  from public.services
  where trim(name) = 'Supported Employment (TN)'
  limit 1;

  if v_keep_id is null then
    return;
  end if;

  select id into v_first_stage_id
  from public.service_milestones
  where service_id = v_keep_id
  order by order_index
  limit 1;

  for v_remove_id in
    select id
    from public.services
    where id <> v_keep_id
      and (
        trim(name) ilike 'Traditional Supported Employment (TN)'
        or (
          trim(name) ilike 'Traditional Supported Employment%'
          and upper(coalesce(state::text, '')) = 'TN'
        )
      )
  loop
    update public.clients
    set
      current_service_id = v_keep_id,
      current_stage_id = coalesce(v_first_stage_id, current_stage_id)
    where current_service_id = v_remove_id;

    delete from public.services where id = v_remove_id;
  end loop;
end;
$$;
