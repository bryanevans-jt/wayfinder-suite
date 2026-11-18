-- Merge duplicate GA service catalog rows (bare name vs "(GA)" suffix) into one
-- canonical row per base service, then strip trailing state suffixes from ALL
-- service names (including repeated "(GA) (GA)").
--
-- Canonical IDs: prefer the existing "(GA)"-named row when both exist so KRA
-- rules / settings that already point at those UUIDs stay valid. After merge,
-- rename survivors to the plain base name (e.g. "Individual Job Placement").
--
-- Does NOT delete contact logs, time entries, applications, or stage events —
-- only repoints FKs / soft refs, then removes unused duplicate milestones +
-- the unused services row.
--
-- Idempotent and transactional (single migration transaction).
-- Dry-run: node scripts/merge-duplicate-services.mjs

create or replace function public.merge_duplicate_service_by_id(
  p_canonical_id uuid,
  p_duplicate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fallback_stage_id uuid;
  v_rules jsonb;
  v_rule jsonb;
  v_ids jsonb;
  v_new_ids jsonb;
  v_sid text;
  v_seen text[];
  v_new_rules jsonb := '[]'::jsonb;
  v_settings_id uuid;
begin
  if p_canonical_id is null
     or p_duplicate_id is null
     or p_canonical_id = p_duplicate_id then
    return;
  end if;

  if not exists (select 1 from public.services where id = p_canonical_id) then
    return;
  end if;

  if not exists (select 1 from public.services where id = p_duplicate_id) then
    return;
  end if;

  select id into v_fallback_stage_id
  from public.service_milestones
  where service_id = p_canonical_id
  order by order_index nulls last, id
  limit 1;

  -- Clients: remap stage by matching milestone title/name, then service id.
  update public.clients c
  set
    current_service_id = p_canonical_id,
    current_stage_id = new_ms.id
  from public.service_milestones old_ms
  join public.service_milestones new_ms
    on new_ms.service_id = p_canonical_id
    and lower(trim(coalesce(new_ms.title, new_ms.name, ''))) =
        lower(trim(coalesce(old_ms.title, old_ms.name, '')))
  where c.current_service_id = p_duplicate_id
    and c.current_stage_id = old_ms.id
    and old_ms.service_id = p_duplicate_id;

  update public.clients c
  set
    current_service_id = p_canonical_id,
    current_stage_id = coalesce(c.current_stage_id, v_fallback_stage_id)
  where c.current_service_id = p_duplicate_id;

  update public.clients c
  set current_stage_id = v_fallback_stage_id
  where c.current_service_id = p_canonical_id
    and c.current_stage_id is not null
    and exists (
      select 1 from public.service_milestones old_ms
      where old_ms.id = c.current_stage_id
        and old_ms.service_id = p_duplicate_id
    );

  if to_regclass('public.service_episodes') is not null then
    update public.service_episodes
    set service_id = p_canonical_id
    where service_id = p_duplicate_id;
  end if;

  update public.client_stage_events e
  set milestone_id = new_ms.id
  from public.service_milestones old_ms
  join public.service_milestones new_ms
    on new_ms.service_id = p_canonical_id
    and lower(trim(coalesce(new_ms.title, new_ms.name, ''))) =
        lower(trim(coalesce(old_ms.title, old_ms.name, '')))
  where e.milestone_id = old_ms.id
    and old_ms.service_id = p_duplicate_id;

  if to_regclass('public.client_meeting_requests') is not null then
    update public.client_meeting_requests
    set service_id = p_canonical_id
    where service_id = p_duplicate_id;
  end if;

  if to_regclass('public.ijp_billing_settings') is not null then
    update public.ijp_billing_settings
    set ga_ijp_service_id = p_canonical_id
    where ga_ijp_service_id = p_duplicate_id;
  end if;

  -- Soft JSONB refs on KRA settings: replace duplicate ids, dedupe within each rule.
  if to_regclass('public.org_kra_billable_settings') is not null then
    for v_settings_id, v_rules in
      select id, coalesce(rules, '[]'::jsonb)
      from public.org_kra_billable_settings
    loop
      v_new_rules := '[]'::jsonb;
      for v_rule in select * from jsonb_array_elements(v_rules)
      loop
        v_ids := coalesce(v_rule -> 'service_ids', '[]'::jsonb);
        v_new_ids := '[]'::jsonb;
        v_seen := array[]::text[];
        for v_sid in select jsonb_array_elements_text(v_ids)
        loop
          if v_sid = p_duplicate_id::text then
            v_sid := p_canonical_id::text;
          end if;
          if v_sid = any (v_seen) then
            continue;
          end if;
          v_seen := array_append(v_seen, v_sid);
          v_new_ids := v_new_ids || to_jsonb(v_sid);
        end loop;
        v_new_rules := v_new_rules || jsonb_build_array(
          jsonb_set(v_rule, '{service_ids}', v_new_ids, true)
        );
      end loop;

      update public.org_kra_billable_settings
      set rules = v_new_rules
      where id = v_settings_id;
    end loop;
  end if;

  delete from public.service_milestones
  where service_id = p_duplicate_id;

  delete from public.services
  where id = p_duplicate_id;
end;
$$;

create or replace function public.strip_service_state_suffixes(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_name, ''));
begin
  while v ~* '\s+\([A-Z]{2}\)\s*$' loop
    v := trim(regexp_replace(v, '\s+\([A-Z]{2}\)\s*$', '', 'i'));
  end loop;
  return v;
end;
$$;

do $$
declare
  rec record;
  v_canonical uuid;
  v_dup uuid;
  v_new_name text;
  v_conflict uuid;
begin
  -- 1) Merge duplicates: keep the "(GA)"-named row's id as canonical when both exist.
  for rec in
    with catalog as (
      select
        id,
        name,
        upper(coalesce(state::text, '')) as state_code,
        lower(public.strip_service_state_suffixes(name)) as base_key,
        (trim(name) ~* '\([A-Z]{2}\)\s*$') as has_suffix
      from public.services
    ),
    ranked as (
      select
        *,
        count(*) over (partition by base_key, state_code) as grp_size
      from catalog
    )
    select base_key, state_code
    from ranked
    where grp_size > 1
    group by base_key, state_code
  loop
    select id into v_canonical
    from public.services
    where lower(public.strip_service_state_suffixes(name)) = rec.base_key
      and upper(coalesce(state::text, '')) = rec.state_code
    order by
      (trim(name) ~* '\([A-Z]{2}\)\s*$') desc,
      id asc
    limit 1;

    for v_dup in
      select id
      from public.services
      where lower(public.strip_service_state_suffixes(name)) = rec.base_key
        and upper(coalesce(state::text, '')) = rec.state_code
        and id <> v_canonical
    loop
      perform public.merge_duplicate_service_by_id(v_canonical, v_dup);
    end loop;
  end loop;

  -- 2) Rename every remaining service to the plain base name (no "(GA)" suffix).
  --    Skip when another row already owns the target name (should not happen after merge).
  for rec in
    select id, name, public.strip_service_state_suffixes(name) as base_name
    from public.services
    where trim(name) is distinct from public.strip_service_state_suffixes(name)
  loop
    v_new_name := rec.base_name;
    if v_new_name = '' then
      continue;
    end if;

    select id into v_conflict
    from public.services
    where id <> rec.id
      and lower(trim(name)) = lower(v_new_name)
    limit 1;

    if v_conflict is not null then
      -- Collision: merge the leftover bare-name row into this canonical id, then rename.
      perform public.merge_duplicate_service_by_id(rec.id, v_conflict);
    end if;

    update public.services
    set name = v_new_name
    where id = rec.id
      and trim(name) is distinct from v_new_name;
  end loop;
end;
$$;

drop function if exists public.merge_duplicate_service_by_id(uuid, uuid);
drop function if exists public.strip_service_state_suffixes(text);
