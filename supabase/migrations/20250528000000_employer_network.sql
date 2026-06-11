-- Employer network directory for ES workspace.

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'prospect')),
  industry text,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  state text check (state is null or state in ('GA', 'TN')),
  website text,
  notes text,
  office_id uuid references public.offices (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employers_name_lower_idx on public.employers (lower(name));
create index if not exists employers_status_idx on public.employers (status);
create index if not exists employers_office_idx on public.employers (office_id);

create or replace function public.set_employers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employers_updated_at on public.employers;
create trigger employers_updated_at
  before update on public.employers
  for each row execute function public.set_employers_updated_at();

alter table public.employers enable row level security;

drop policy if exists "employers_select_staff" on public.employers;
create policy "employers_select_staff"
  on public.employers for select to authenticated
  using (public.auth_user_has_staff_role());

drop policy if exists "employers_insert_es_workspace" on public.employers;
create policy "employers_insert_es_workspace"
  on public.employers for insert to authenticated
  with check (
    public.get_auth_user_role() in ('es', 'accountant', 'admin', 'super_admin')
  );

drop policy if exists "employers_update_es_workspace" on public.employers;
create policy "employers_update_es_workspace"
  on public.employers for update to authenticated
  using (
    public.get_auth_user_role() in ('es', 'accountant', 'admin', 'super_admin')
  )
  with check (
    public.get_auth_user_role() in ('es', 'accountant', 'admin', 'super_admin')
  );

drop policy if exists "employers_delete_admin_tier" on public.employers;
create policy "employers_delete_admin_tier"
  on public.employers for delete to authenticated
  using (public.auth_user_is_admin_tier());
