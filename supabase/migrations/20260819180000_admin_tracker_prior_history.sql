-- Per-notification dismiss (hide without deleting) and optional prior-enrollment
-- link when a closed client returns as a new referral.

alter table public.in_app_notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists in_app_notifications_user_visible_idx
  on public.in_app_notifications (user_id, created_at desc)
  where dismissed_at is null;

comment on column public.in_app_notifications.dismissed_at is
  'When set, the notification is hidden from the in-app bell. Distinct from read_at.';

alter table public.clients
  add column if not exists prior_client_id uuid references public.clients (id) on delete set null;

create index if not exists clients_prior_client_id_idx
  on public.clients (prior_client_id)
  where prior_client_id is not null;

comment on column public.clients.prior_client_id is
  'Optional link to a previous closed enrollment for the same person. New referral stays a separate record; staff casework may show prior activity.';
