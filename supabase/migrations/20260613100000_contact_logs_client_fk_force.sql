-- Ensure contact_logs.client_id always references clients(id) so ES inserts work for every client row.

update public.contact_logs cl
set client_id = c.id
from public.clients c
where cl.client_id = c.user_id
   or cl.client_id = c.profile_id;

alter table public.contact_logs drop constraint if exists contact_logs_client_id_fkey;

alter table public.contact_logs
  add constraint contact_logs_client_id_fkey
  foreign key (client_id) references public.clients (id) on delete cascade;
