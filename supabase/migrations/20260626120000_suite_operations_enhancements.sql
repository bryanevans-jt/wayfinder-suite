-- Wayfinder suite enhancements: employment celebrations, accessibility, payroll settings.

alter table public.clients
  add column if not exists job_start_date date;

comment on column public.clients.job_start_date is
  'Actual employment start date (separate from application Hired date). Drives 30/60/90-day celebrations.';

alter table public.profiles
  add column if not exists accessibility_large_text boolean not null default false,
  add column if not exists accessibility_high_contrast boolean not null default false;

create table if not exists public.client_employment_celebrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  milestone text not null check (milestone in ('hire', 'day_30', 'day_60', 'day_90')),
  job_start_date date not null,
  created_at timestamptz not null default now(),
  unique (client_id, milestone)
);

create index if not exists client_employment_celebrations_client_idx
  on public.client_employment_celebrations (client_id);

alter table public.client_employment_celebrations enable row level security;

drop policy if exists "employment_celebrations_staff_read" on public.client_employment_celebrations;
create policy "employment_celebrations_staff_read"
  on public.client_employment_celebrations for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('es', 'supervisor', 'admin', 'super_admin', 'counselor')
    )
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and (c.user_id = auth.uid() or c.profile_id = auth.uid())
    )
    or exists (
      select 1 from public.support_client_assignments sca
      where sca.client_id = client_employment_celebrations.client_id
        and sca.support_user_id = auth.uid()
    )
  );

create table if not exists public.org_payroll_settings (
  id uuid primary key default gen_random_uuid(),
  pay_period_frequency text not null default 'biweekly'
    check (pay_period_frequency in ('weekly', 'biweekly', 'monthly')),
  period_start_date date not null default date_trunc('week', current_date)::date,
  period_end_date date,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.org_payroll_settings (pay_period_frequency, period_start_date)
select 'biweekly', date_trunc('week', current_date)::date
where not exists (select 1 from public.org_payroll_settings limit 1);

alter table public.org_payroll_settings enable row level security;

drop policy if exists "org_payroll_settings_read_staff" on public.org_payroll_settings;
create policy "org_payroll_settings_read_staff"
  on public.org_payroll_settings for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('accountant', 'admin', 'super_admin', 'supervisor')
    )
  );

drop policy if exists "org_payroll_settings_super_admin_write" on public.org_payroll_settings;
create policy "org_payroll_settings_super_admin_write"
  on public.org_payroll_settings for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );
