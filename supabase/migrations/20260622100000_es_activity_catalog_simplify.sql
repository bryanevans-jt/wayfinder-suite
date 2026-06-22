-- Simplify ES activity catalog to 15 billable types; deactivate legacy codes (historical time entries keep their FK).

update public.service_activity_types
set active = false
where code not in (
  'JT-ACT-001',
  'JT-ACT-010',
  'JT-ACT-011',
  'JT-ACT-012',
  'JT-ACT-020',
  'JT-ACT-021',
  'JT-ACT-022',
  'JT-ACT-030',
  'JT-ACT-031',
  'JT-ACT-040',
  'JT-ACT-041',
  'JT-ACT-050',
  'JT-ACT-060',
  'JT-ACT-061',
  'JT-ACT-062'
);

insert into public.service_activity_types
  (code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable, wayfinder_source_hint, sort_order, active)
values
  ('JT-ACT-001', 'Client meetings', 'Initial Intake Meeting', 30, 5, 60, true, true, true, 'contact_log · meeting', 10, true),
  ('JT-ACT-010', 'Client contact', 'Client Phone Contact', 15, 5, 45, true, true, true, 'contact_log', 20, true),
  ('JT-ACT-011', 'Client meetings', 'In-Person Meeting', 30, 5, 120, true, true, true, 'contact_log · meeting', 30, true),
  ('JT-ACT-012', 'Client meetings', 'Virtual Meeting', 30, 5, 90, true, true, true, 'contact_log · meeting', 40, true),
  ('JT-ACT-020', 'Employment services', 'Application Submitted', 15, 5, 45, true, true, true, 'contact_log · applications', 50, true),
  ('JT-ACT-021', 'Employment services', 'Job Canvassing', 30, 5, 180, true, true, true, 'contact_log', 60, true),
  ('JT-ACT-022', 'Employment services', 'Interview Assistance', 30, 5, 90, true, true, true, 'contact_log', 70, true),
  ('JT-ACT-030', 'Placement & retention', 'On-the-Job Check-In (Client)', 30, 5, 60, true, true, true, 'contact_log', 80, true),
  ('JT-ACT-031', 'Placement & retention', 'Employer Follow-Up', 20, 5, 45, true, true, true, 'contact_log · employer', 90, true),
  ('JT-ACT-040', 'Case management', 'Case File Review', 30, 5, 60, true, true, true, 'contact_log · stage_event', 100, true),
  ('JT-ACT-041', 'Case management', 'Crisis / Urgent Client Intervention', 30, 5, 120, true, true, true, 'contact_log', 110, true),
  ('JT-ACT-050', 'Travel', 'Client-Related Travel Time', 30, 5, 120, true, true, true, 'manual', 120, true),
  ('JT-ACT-060', 'Staff & administration', 'Team Meeting', 30, 5, 120, false, true, true, 'manual', 130, true),
  ('JT-ACT-061', 'Staff & administration', 'Training', 30, 5, 240, false, true, true, 'manual', 140, true),
  ('JT-ACT-062', 'Staff & administration', 'Administration', 30, 5, 120, false, true, true, 'manual', 150, true)
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
