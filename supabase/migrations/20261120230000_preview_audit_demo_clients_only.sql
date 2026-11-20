-- Optional flag for View as sessions limited to is_demo clients.
alter table public.preview_audit_logs
  add column if not exists demo_clients_only boolean not null default false;
