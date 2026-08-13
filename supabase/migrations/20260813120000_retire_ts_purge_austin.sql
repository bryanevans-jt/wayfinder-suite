-- 1) Retire Transition Specialist → Employment Specialist
-- 2) One-time hard-delete Austin Kitchens (austin.kitchens@thejoshuatree.org)

-- ---------------------------------------------------------------------------
-- Part A: Transition Specialist → ES
-- ---------------------------------------------------------------------------
update public.profiles
set role = 'es'
where role::text = 'transition_specialist';

alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (
  role::text in (
    'client',
    'support',
    'es',
    'supervisor',
    'accountant',
    'admin',
    'counselor',
    'super_admin',
    'hr',
    'hospitality_specialist',
    'wrt_admin'
  )
);

-- ---------------------------------------------------------------------------
-- Part B: Purge Austin Kitchens (idempotent by email)
-- ---------------------------------------------------------------------------
do $$
declare
  target_id uuid;
  target_email text := 'austin.kitchens@thejoshuatree.org';
begin
  select u.id
  into target_id
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise notice 'purge Austin: no auth user found for %', target_email;
    return;
  end if;

  -- Assignment / office links
  delete from public.supervisor_es_assignments
  where es_user_id = target_id or supervisor_user_id = target_id;

  if to_regclass('public.es_client_assignments') is not null then
    delete from public.es_client_assignments where es_user_id = target_id;
  end if;

  if to_regclass('public.staff_office_assignments') is not null then
    delete from public.staff_office_assignments where user_id = target_id;
  end if;

  -- ON DELETE RESTRICT blockers
  if to_regclass('public.protected_accounts') is not null then
    delete from public.protected_accounts where profile_id = target_id;
  end if;

  if to_regclass('public.staff_time_clock_edit_logs') is not null then
    delete from public.staff_time_clock_edit_logs where edited_by = target_id;
  end if;

  if to_regclass('public.staff_pto_request_edits') is not null then
    delete from public.staff_pto_request_edits where edited_by = target_id;
  end if;

  if to_regclass('public.client_staff_notes') is not null then
    delete from public.client_staff_notes where author_user_id = target_id;
  end if;

  if to_regclass('public.hospitality_client_contacts') is not null then
    delete from public.hospitality_client_contacts where contacted_by = target_id;
  end if;

  -- Soft FKs that may lack ON DELETE CASCADE
  if to_regclass('public.report_user_roles') is not null then
    delete from public.report_user_roles where user_id = target_id;
    update public.report_user_roles set created_by = null where created_by = target_id;
  end if;

  if to_regclass('public.es_time_entries') is not null then
    update public.es_time_entries set approved_by = null where approved_by = target_id;
  end if;

  if to_regclass('public.es_time_week_submissions') is not null then
    update public.es_time_week_submissions set approved_by = null where approved_by = target_id;
  end if;

  if to_regclass('public.staff_pto_requests') is not null then
    update public.staff_pto_requests set decided_by = null where decided_by = target_id;
  end if;

  if to_regclass('public.org_pto_settings') is not null then
    update public.org_pto_settings set updated_by = null where updated_by = target_id;
  end if;

  if to_regclass('public.intake_billings') is not null then
    update public.intake_billings set billed_by = null where billed_by = target_id;
    update public.intake_billings set paid_by = null where paid_by = target_id;
  end if;

  if to_regclass('public.client_message_threads') is not null then
    update public.client_message_threads
    set current_es_user_id = null
    where current_es_user_id = target_id;
  end if;

  -- NOT NULL + ON DELETE SET NULL columns will block auth delete; clear rows first
  if to_regclass('public.client_messages') is not null then
    delete from public.client_messages where sender_user_id = target_id;
  end if;

  if to_regclass('public.admin_config') is not null then
    update public.admin_config set updated_by = null where updated_by = target_id;
  end if;

  if to_regclass('public.supervisor_invites') is not null then
    update public.supervisor_invites set created_by = null where created_by = target_id;
  end if;

  -- Profile first (cascades most public FKs), then auth user
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;

  raise notice 'purge Austin: deleted user % (%)', target_id, target_email;
end $$;
