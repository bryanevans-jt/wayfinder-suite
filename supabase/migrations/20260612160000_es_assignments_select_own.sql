-- Ensure ES staff can read their own caseload assignment rows (required for server actions).

drop policy if exists "es_assignments_select_own" on public.es_client_assignments;
create policy "es_assignments_select_own"
  on public.es_client_assignments for select to authenticated
  using (es_user_id = (select auth.uid()));
