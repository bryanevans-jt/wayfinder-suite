-- Legacy clients rows require profile_id (profiles.id). Wayfinder uses user_id.
-- Keep both columns aligned on insert/update and backfill existing rows.

alter table public.clients
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.clients
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

create or replace function public.sync_clients_auth_columns()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id is null and new.user_id is not null then
    new.profile_id := new.user_id;
  elsif new.user_id is null and new.profile_id is not null then
    new.user_id := new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_sync_auth_columns on public.clients;

create trigger clients_sync_auth_columns
  before insert or update on public.clients
  for each row
  execute function public.sync_clients_auth_columns();

update public.clients
set profile_id = user_id
where profile_id is null
  and user_id is not null;

update public.clients
set user_id = profile_id
where user_id is null
  and profile_id is not null;
