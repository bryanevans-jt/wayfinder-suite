-- Persist Hospitality / intake-assigned supervising staff on the client record.
alter table public.clients
  add column if not exists supervisor_user_id uuid references auth.users (id) on delete set null;

create index if not exists clients_supervisor_user_id_idx
  on public.clients (supervisor_user_id)
  where supervisor_user_id is not null;

comment on column public.clients.supervisor_user_id is
  'Supervising staff assigned at intake (Hospitality Start Client) or referral edit.';
