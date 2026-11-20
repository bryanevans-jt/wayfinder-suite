-- Delete four mis-credited demo GVRA monthly allowance time entries (Oct 2026).
-- Tightly scoped by exact entry ids, assignee, clients, service_date, minutes,
-- status, allowance flag, and clients.is_demo so nothing else can match.
-- Does not touch profiles, clients, or es_client_assignments.
-- gvra_monthly_allowance_grants.es_time_entry_id is ON DELETE SET NULL.

do $$
declare
  entry_ids constant uuid[] := array[
    '7c012b94-ce2e-4ee7-b267-9e26d2581625'::uuid,
    'c06029f7-0ebe-4f46-8825-64460b515b05'::uuid,
    '246bf8ab-032e-4bf2-bc4c-c0f48865c2ff'::uuid,
    'a0b71064-65c9-4cd3-8d68-873d0d955387'::uuid
  ];
  client_ids constant uuid[] := array[
    '3d6a8605-0711-4d38-9808-f772e5723cb8'::uuid,
    '85da289d-5c8d-4798-938c-1b9228fc7ab6'::uuid,
    'b812ec62-2e2b-4999-b211-6844f6831c1a'::uuid,
    'bc2cc440-d916-453b-accd-34c31066ad36'::uuid
  ];
  assignee_id constant uuid := '8f022752-4beb-4aa4-9be6-1297bea34b5f'::uuid;
  match_count int;
  deleted_count int;
begin
  select count(*)::int
  into match_count
  from public.es_time_entries e
  join public.clients c on c.id = e.client_id
  where e.id = any (entry_ids)
    and e.es_user_id = assignee_id
    and e.client_id = any (client_ids)
    and e.service_date = date '2026-10-31'
    and e.duration_minutes = 120
    and e.status = 'approved'
    and coalesce((e.flags->>'gvra_monthly_admin_allowance')::boolean, false) = true
    and c.is_demo = true;

  if match_count <> 4 then
    raise exception
      'delete_demo_gvra_allowance_oct2026: expected exactly 4 matching rows, found %',
      match_count;
  end if;

  delete from public.es_time_entries e
  where e.id = any (entry_ids)
    and e.es_user_id = assignee_id
    and e.client_id = any (client_ids)
    and e.service_date = date '2026-10-31'
    and e.duration_minutes = 120
    and e.status = 'approved'
    and coalesce((e.flags->>'gvra_monthly_admin_allowance')::boolean, false) = true
    and exists (
      select 1
      from public.clients c
      where c.id = e.client_id
        and c.is_demo = true
    );

  get diagnostics deleted_count = row_count;

  if deleted_count <> 4 then
    raise exception
      'delete_demo_gvra_allowance_oct2026: deleted %, expected 4',
      deleted_count;
  end if;
end $$;
