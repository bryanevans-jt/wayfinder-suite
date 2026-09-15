-- Ryan Herrington (admin) supervises all Employment Specialists org-wide.
-- Transition Specialists remain on regional supervisor_es_assignments only.

do $$
declare
  ryan_id uuid;
  es_row record;
begin
  select u.id into ryan_id
  from auth.users u
  where lower(u.email) = 'ryan.herrington@thejoshuatree.org'
  limit 1;

  if ryan_id is null then
    raise notice 'Org ES supervisor migration skipped: Ryan Herrington auth user not found';
    return;
  end if;

  for es_row in
    select p.id as user_id
    from public.profiles p
    where p.role = 'es'
      and coalesce(p.is_active, true) = true
      and p.id <> ryan_id
  loop
    insert into public.supervisor_es_assignments (supervisor_user_id, es_user_id)
    values (ryan_id, es_row.user_id)
    on conflict (supervisor_user_id, es_user_id) do nothing;
  end loop;
end $$;
