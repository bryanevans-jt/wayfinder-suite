-- Add PTS Job Preparation and PTS Job Placement to the GA services catalog.
-- New services only; does not rename or merge existing catalog rows.

do $$
declare
  sid uuid;
  milestone_count int;
begin
  -- PTS Job Preparation
  select id into sid from public.services where trim(name) = 'PTS Job Preparation' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('PTS Job Preparation', 'GA')
    returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Complete', 'complete');
  end if;

  -- PTS Job Placement
  select id into sid from public.services where trim(name) = 'PTS Job Placement' limit 1;
  if sid is null then
    insert into public.services (name, state) values ('PTS Job Placement', 'GA')
    returning id into sid;
  end if;
  select count(*) into milestone_count from public.service_milestones where service_id = sid;
  if milestone_count = 0 then
    insert into public.service_milestones (service_id, order_index, title, name) values
      (sid, 10, 'Open', 'Open'),
      (sid, 20, 'On Hold', 'On Hold'),
      (sid, 30, 'Dismissed', 'Dismissed'),
      (sid, 40, 'Complete', 'complete');
  end if;
end $$;
