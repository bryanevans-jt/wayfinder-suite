-- Remove per-activity max caps for enforcement (app ignores max) and raise the floor to 30 minutes.

update public.service_activity_types
set
  min_minutes = 30,
  default_minutes = greatest(default_minutes, 30),
  max_minutes = greatest(max_minutes, 480)
where active = true;
