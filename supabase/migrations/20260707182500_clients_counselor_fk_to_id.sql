-- Legacy drift: clients.counselor_id FK references counselors.user_id (auth login),
-- but canonical schema and the app's counselor lookups use counselors.id.
-- Convert existing values from counselors.user_id -> counselors.id, then repoint the FK.
-- This also lets directory-only counselors (no login) be assigned to clients.

update public.clients c
set counselor_id = ce.id
from public.counselors ce
where c.counselor_id is not null
  and c.counselor_id = ce.user_id
  and not exists (
    select 1 from public.counselors ci where ci.id = c.counselor_id
  );

alter table public.clients
  drop constraint if exists clients_counselor_id_fkey;

alter table public.clients
  add constraint clients_counselor_id_fkey
  foreign key (counselor_id) references public.counselors (id) on delete set null;
