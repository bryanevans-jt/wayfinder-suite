-- Legacy contact_logs often reference profiles(id) / auth user id instead of clients(id).
-- Repoint the FK and backfill rows when needed.

do $$
declare
  ref_table text;
begin
  select ccu.table_name
  into ref_table
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'contact_logs'
    and kcu.column_name = 'client_id'
  limit 1;

  if ref_table in ('profiles', 'users') then
    update public.contact_logs cl
    set client_id = c.id
    from public.clients c
    where cl.client_id = c.user_id
       or cl.client_id = c.profile_id;

    alter table public.contact_logs drop constraint if exists contact_logs_client_id_fkey;

    alter table public.contact_logs
      add constraint contact_logs_client_id_fkey
      foreign key (client_id) references public.clients (id) on delete cascade;
  end if;
end $$;
