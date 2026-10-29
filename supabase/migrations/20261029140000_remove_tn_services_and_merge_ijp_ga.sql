-- Remove Tennessee service catalog rows entirely (no merge into GA).
-- Collapse legacy duplicate GA IJP names into "Individual Job Placement (GA)".

create or replace function public.merge_service_catalog_row(p_keep_name text, p_remove_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_id uuid;
  v_remove_id uuid;
  v_fallback_stage_id uuid;
begin
  select id into v_keep_id
  from public.services
  where trim(name) = trim(p_keep_name)
  limit 1;

  select id into v_remove_id
  from public.services
  where trim(name) = trim(p_remove_name)
  limit 1;

  if v_keep_id is null or v_remove_id is null or v_keep_id = v_remove_id then
    return;
  end if;

  select id into v_fallback_stage_id
  from public.service_milestones
  where service_id = v_keep_id
  order by order_index
  limit 1;

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

  if to_regclass('public.service_episodes') is not null then
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

  if to_regclass('public.client_engagement') is not null then
    update public.client_engagement ce
    set service_id = v_keep_id
    where service_id = v_remove_id;
  end if;

  delete from public.service_milestones
  where service_id = v_remove_id;

  delete from public.services
  where id = v_remove_id;
end;
$$;

create or replace function public.delete_tennessee_service_catalog_row(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_service_id is null then
    return;
  end if;

  update public.clients
  set
    current_service_id = null,
    current_stage_id = null
  where current_service_id = p_service_id;

  if to_regclass('public.service_episodes') is not null then
    delete from public.service_episodes
    where service_id = p_service_id;
  end if;

  if to_regclass('public.client_engagement') is not null then
    update public.client_engagement
    set service_id = null
    where service_id = p_service_id;
  end if;

  if to_regclass('public.org_ijp_billing_settings') is not null then
    update public.org_ijp_billing_settings
    set ga_ijp_service_id = null
    where ga_ijp_service_id = p_service_id;
  end if;

  delete from public.services
  where id = p_service_id;
end;
$$;

do $$
declare
  rec record;
begin
  -- GA-only: one canonical Individual Job Placement row.
  perform public.merge_service_catalog_row(
    'Individual Job Placement (GA)',
    'Individual Job Placement'
  );
  perform public.merge_service_catalog_row(
    'Individual Job Placement (GA)',
    'Individual Job Placement (IJP)'
  );

  for rec in
    select s.id
    from public.services s
    where upper(coalesce(s.state::text, '')) = 'TN'
       or trim(s.name) ~* '\(TN\)\s*$'
       or trim(s.name) ilike '% (tn)'
  loop
    perform public.delete_tennessee_service_catalog_row(rec.id);
  end loop;

  if to_regclass('public.report_type_catalog') is not null then
    delete from public.report_type_catalog
    where upper(trim(state)) = 'TN';
  end if;

  if to_regclass('public.org_ijp_billing_settings') is not null then
    update public.org_ijp_billing_settings
    set ga_ijp_service_id = (
      select id from public.services
      where trim(name) = 'Individual Job Placement (GA)'
      limit 1
    )
    where ga_ijp_service_id is null
       or ga_ijp_service_id not in (select id from public.services);
  end if;
end;
$$;

drop function if exists public.delete_tennessee_service_catalog_row(uuid);
drop function if exists public.merge_service_catalog_row(text, text);
