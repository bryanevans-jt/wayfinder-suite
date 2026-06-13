-- Allow supervisors to add and edit Community Partners (employers).

drop policy if exists "employers_insert_community_partners" on public.employers;
create policy "employers_insert_community_partners"
  on public.employers for insert to authenticated
  with check (
    public.get_auth_user_role() in ('es', 'supervisor', 'admin', 'super_admin')
  );

drop policy if exists "employers_update_community_partners" on public.employers;
create policy "employers_update_community_partners"
  on public.employers for update to authenticated
  using (
    public.get_auth_user_role() in ('es', 'supervisor', 'admin', 'super_admin')
  )
  with check (
    public.get_auth_user_role() in ('es', 'supervisor', 'admin', 'super_admin')
  );
