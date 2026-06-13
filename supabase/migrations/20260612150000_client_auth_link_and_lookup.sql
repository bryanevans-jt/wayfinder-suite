-- Client portal: resolve clients.id for signed-in users (by auth link or contact email).

create or replace function public.get_client_id_for_auth_user()
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_client_id uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select c.id
  into v_client_id
  from public.clients c
  where coalesce(c.user_id, c.profile_id) = v_uid
  order by c.created_at asc nulls last
  limit 1;

  if v_client_id is not null then
    return v_client_id;
  end if;

  select lower(u.email)
  into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or v_email = '' then
    return null;
  end if;

  select c.id
  into v_client_id
  from public.clients c
  where lower(trim(c.contact_email)) = v_email
  order by c.created_at asc nulls last
  limit 1;

  return v_client_id;
end;
$$;

revoke all on function public.get_client_id_for_auth_user() from public;
grant execute on function public.get_client_id_for_auth_user() to authenticated;

drop policy if exists "clients_select_own_by_email" on public.clients;
create policy "clients_select_own_by_email"
  on public.clients for select to authenticated
  using (
    lower(trim(contact_email)) = lower(
      coalesce(
        (select email from auth.users where id = (select auth.uid())),
        ''
      )
    )
  );
