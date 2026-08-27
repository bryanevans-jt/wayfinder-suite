-- Add Job Coaching to the contact-log / service activity dropdown,
-- ordered immediately after On-the-Job Check-In (Client).

insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable, wayfinder_source_hint, sort_order, active)
values
  (
    'JT-ACT-032',
    'Placement & retention',
    'Job Coaching',
    30,
    30,
    480,
    true,
    true,
    true,
    'contact_log',
    85,
    true
  )
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  default_minutes = excluded.default_minutes,
  min_minutes = excluded.min_minutes,
  max_minutes = excluded.max_minutes,
  requires_client = excluded.requires_client,
  requires_narrative = excluded.requires_narrative,
  is_billable = excluded.is_billable,
  wayfinder_source_hint = excluded.wayfinder_source_hint,
  sort_order = excluded.sort_order,
  active = true;
