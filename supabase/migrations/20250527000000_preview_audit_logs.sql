-- Super-admin preview audit (enter/exit only). Not visible to preview targets.

create table if not exists public.preview_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  target_role text not null,
  action text not null,
  created_at timestamptz not null default now(),
  constraint preview_audit_action_allowed check (action in ('enter', 'exit'))
);

create index if not exists preview_audit_logs_actor_created_idx
  on public.preview_audit_logs (actor_user_id, created_at desc);

create index if not exists preview_audit_logs_target_created_idx
  on public.preview_audit_logs (target_user_id, created_at desc);

alter table public.preview_audit_logs enable row level security;

drop policy if exists "preview_audit_logs_select_super_admin" on public.preview_audit_logs;
create policy "preview_audit_logs_select_super_admin"
  on public.preview_audit_logs for select to authenticated
  using (public.auth_user_is_super_admin());
