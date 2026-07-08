-- Legacy drift: clients.counselor_id FK references profiles(id) (counselor must be an auth login),
-- but canonical schema and the app's counselor lookups use counselors.id (directory table).
-- Drop the profiles FK FIRST, convert existing values to counselors.id, then add the correct FK.
-- This also lets directory-only counselors (no login) be assigned to clients.

alter table public.clients
  drop constraint if exists clients_counselor_id_fkey;

-- Existing rows may store a counselor's login id (counselors.user_id / profiles.id).
-- Convert those to the matching counselors.id.
update public.clients c
set counselor_id = ce.id
from public.counselors ce
where c.counselor_id is not null
  and c.counselor_id = ce.user_id
  and not exists (
    select 1 from public.counselors ci where ci.id = c.counselor_id
  );

-- Null out any counselor_id that still doesn't resolve to a counselors row.
update public.clients c
set counselor_id = null
where c.counselor_id is not null
  and not exists (
    select 1 from public.counselors ci where ci.id = c.counselor_id
  );

alter table public.clients
  add constraint clients_counselor_id_fkey
  foreign key (counselor_id) references public.counselors (id) on delete set null;
