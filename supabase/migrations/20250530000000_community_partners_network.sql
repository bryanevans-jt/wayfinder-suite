-- Community Partners Network: pending review, status audit log, submission source.

alter table public.employers drop constraint if exists employers_status_check;
alter table public.employers add constraint employers_status_check
  check (status in ('active', 'inactive', 'prospect', 'pending_review'));

alter table public.employers
  add column if not exists submission_source text not null default 'staff'
    check (submission_source in ('staff', 'public'));

create table if not exists public.employer_status_logs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  changed_by uuid references auth.users (id) on delete set null,
  old_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists employer_status_logs_employer_idx
  on public.employer_status_logs (employer_id, created_at desc);

alter table public.employer_status_logs enable row level security;

drop policy if exists "employer_status_logs_select_staff" on public.employer_status_logs;
create policy "employer_status_logs_select_staff"
  on public.employer_status_logs for select to authenticated
  using (public.auth_user_has_staff_role());

-- Accountants no longer manage employers; ES + admin tier only.
drop policy if exists "employers_insert_es_workspace" on public.employers;
drop policy if exists "employers_insert_community_partners" on public.employers;
create policy "employers_insert_community_partners"
  on public.employers for insert to authenticated
  with check (
    public.get_auth_user_role() in ('es', 'admin', 'super_admin')
  );

drop policy if exists "employers_update_es_workspace" on public.employers;
drop policy if exists "employers_update_community_partners" on public.employers;
create policy "employers_update_community_partners"
  on public.employers for update to authenticated
  using (
    public.get_auth_user_role() in ('es', 'admin', 'super_admin')
  )
  with check (
    public.get_auth_user_role() in ('es', 'admin', 'super_admin')
  );
