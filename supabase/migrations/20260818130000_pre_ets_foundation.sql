-- Pre-ETS program foundation: org settings, instructor role, service-role-only access.

-- ---------------------------------------------------------------------------
-- Instructor role on profiles
-- ---------------------------------------------------------------------------
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
    'wrt_admin',
    'instructor'
  )
);

-- ---------------------------------------------------------------------------
-- Pre-ETS org settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_ets_settings (
  id uuid primary key default gen_random_uuid(),
  module_enabled boolean not null default true,
  enabled_roles text[] not null default array['super_admin']::text[],
  school_year text not null default '2025-2026',
  drive_signed_roster_folder_id text,
  drive_invoice_archive_folder_id text,
  drive_worksheet_archive_folder_id text,
  drive_folder_path_template text not null default '{SchoolYear}/{District}/{School}/{Month}',
  template_roster_doc_id text,
  template_car_doc_id text,
  template_invoice_cover_doc_id text,
  template_invoice_attestation_doc_id text,
  template_individual_roster_doc_id text,
  default_rate_cents integer not null default 9000,
  provider_name text not null default 'Joshua Tree Service Group',
  remit_address text not null default '505 S. Tennille Ave. Donalsonville, GA 39845',
  ytd_unit_warning_threshold integer not null default 15,
  invoice_export_mode text not null default 'both'
    check (invoice_export_mode in ('combined_pdf', 'sections_only', 'both')),
  submission_deadline_hours integer not null default 24,
  group_auth_digit_count integer not null default 5,
  not_approved_marker text not null default 'NOT APPROVED',
  service_codes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.pre_ets_settings (module_enabled, enabled_roles, school_year)
select true, array['super_admin']::text[], '2025-2026'
where not exists (select 1 from public.pre_ets_settings limit 1);

alter table public.pre_ets_settings enable row level security;

drop policy if exists "pre_ets_settings_super_admin_all" on public.pre_ets_settings;
create policy "pre_ets_settings_super_admin_all"
  on public.pre_ets_settings for all to authenticated
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

comment on table public.pre_ets_settings is
  'Pre-ETS program configuration. Super admin settings UI; staff APIs use service role.';

-- App APIs use service role for reads when checking enabled_roles in middleware.
revoke all on table public.pre_ets_settings from anon, authenticated;
grant all on table public.pre_ets_settings to service_role;
