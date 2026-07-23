-- Staff payroll time clock (separate from client billable es_time_entries).
-- America/New_York local dates; counselors/clients/supports have no access.

create table if not exists public.staff_time_clock_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  local_date date not null,
  auto_out_reason text,
  needs_attention boolean not null default false,
  attention_cleared_at timestamptz,
  still_working_prompted_at timestamptz,
  still_working_ack_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_clock_shifts_out_after_in
    check (clock_out_at is null or clock_out_at >= clock_in_at),
  constraint staff_time_clock_shifts_auto_out_reason_check
    check (
      auto_out_reason is null
      or auto_out_reason in ('still_working_timeout', 'midnight_split')
    )
);

create unique index if not exists staff_time_clock_one_open_idx
  on public.staff_time_clock_shifts (staff_user_id)
  where clock_out_at is null;

create index if not exists staff_time_clock_shifts_staff_date_idx
  on public.staff_time_clock_shifts (staff_user_id, local_date desc);

create index if not exists staff_time_clock_shifts_open_idx
  on public.staff_time_clock_shifts (clock_out_at)
  where clock_out_at is null;

create index if not exists staff_time_clock_shifts_attention_idx
  on public.staff_time_clock_shifts (staff_user_id, needs_attention)
  where needs_attention = true;

create table if not exists public.staff_time_clock_edit_logs (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.staff_time_clock_shifts (id) on delete cascade,
  edited_by uuid not null references public.profiles (id) on delete restrict,
  edited_at timestamptz not null default now(),
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  reason text,
  constraint staff_time_clock_edit_logs_action_check
    check (action in ('edit_times', 'clear_attention', 'auto_out', 'midnight_split', 'clock_in', 'clock_out'))
);

create index if not exists staff_time_clock_edit_logs_shift_idx
  on public.staff_time_clock_edit_logs (shift_id, edited_at desc);

create or replace function public.auth_user_can_use_staff_clock()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.get_auth_user_role() in (
      'es',
      'supervisor',
      'accountant',
      'admin',
      'super_admin',
      'hr',
      'hospitality_specialist'
    ),
    false
  );
$$;

create or replace function public.auth_user_can_view_staff_clock(target_staff_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      public.auth_user_can_use_staff_clock()
      and auth.uid() = target_staff_user_id
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and target_staff_user_id in (select public.auth_user_supervised_es_ids())
    )
    or public.auth_user_is_admin_tier(),
    false
  );
$$;

grant execute on function public.auth_user_can_use_staff_clock() to authenticated;
grant execute on function public.auth_user_can_view_staff_clock(uuid) to authenticated;

alter table public.staff_time_clock_shifts enable row level security;
alter table public.staff_time_clock_edit_logs enable row level security;

drop policy if exists staff_time_clock_shifts_select on public.staff_time_clock_shifts;
create policy staff_time_clock_shifts_select on public.staff_time_clock_shifts
  for select to authenticated
  using (public.auth_user_can_view_staff_clock(staff_user_id));

drop policy if exists staff_time_clock_shifts_insert on public.staff_time_clock_shifts;
create policy staff_time_clock_shifts_insert on public.staff_time_clock_shifts
  for insert to authenticated
  with check (
    staff_user_id = auth.uid()
    and public.auth_user_can_use_staff_clock()
  );

drop policy if exists staff_time_clock_shifts_update on public.staff_time_clock_shifts;
create policy staff_time_clock_shifts_update on public.staff_time_clock_shifts
  for update to authenticated
  using (
    (
      staff_user_id = auth.uid()
      and public.auth_user_can_use_staff_clock()
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and staff_user_id in (select public.auth_user_supervised_es_ids())
    )
    or public.auth_user_is_admin_tier()
  );

drop policy if exists staff_time_clock_edit_logs_select on public.staff_time_clock_edit_logs;
create policy staff_time_clock_edit_logs_select on public.staff_time_clock_edit_logs
  for select to authenticated
  using (
    exists (
      select 1
      from public.staff_time_clock_shifts s
      where s.id = shift_id
        and public.auth_user_can_view_staff_clock(s.staff_user_id)
    )
  );

drop policy if exists staff_time_clock_edit_logs_insert on public.staff_time_clock_edit_logs;
create policy staff_time_clock_edit_logs_insert on public.staff_time_clock_edit_logs
  for insert to authenticated
  with check (
    edited_by = auth.uid()
    and exists (
      select 1
      from public.staff_time_clock_shifts s
      where s.id = shift_id
        and (
          (
            s.staff_user_id = auth.uid()
            and public.auth_user_can_use_staff_clock()
          )
          or (
            public.get_auth_user_role() = 'supervisor'
            and s.staff_user_id in (select public.auth_user_supervised_es_ids())
          )
          or public.auth_user_is_admin_tier()
        )
    )
  );
