-- Trim activity catalog, cap defaults at 30 min, allow 5-minute minimum durations.

update public.service_activity_types
set active = false
where code in (
  'JT-INT-002',
  'JT-INT-003',
  'JT-CON-015',
  'JT-PLC-043',
  'JT-CSE-052'
);

update public.service_activity_types
set
  name = 'Initial Intake Meeting',
  default_minutes = least(default_minutes, 30),
  min_minutes = 5
where active = true;

update public.service_activity_types
set default_minutes = least(default_minutes, 30)
where active = true;

update public.service_activity_types
set
  name = 'Initial Intake Meeting',
  default_minutes = 30,
  min_minutes = 5,
  max_minutes = 60
where code = 'JT-INT-001';
