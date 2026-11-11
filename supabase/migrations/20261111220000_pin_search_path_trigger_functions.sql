-- Pin search_path on five SECURITY INVOKER trigger helpers that previously
-- inherited a mutable path. Bodies are unchanged; references stay schema-qualified.

alter function public.sync_service_episode_on_stage_change()
  set search_path = public;

alter function public.sync_clients_auth_columns()
  set search_path = public;

alter function public.applications_touch_updated_at()
  set search_path = public;

alter function public.set_employers_updated_at()
  set search_path = public;

alter function public.sync_client_archived_at()
  set search_path = public;
