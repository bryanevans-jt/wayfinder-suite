-- Align legacy contact_logs with Wayfinder ES / counselor portal columns.

alter table public.contact_logs
  add column if not exists logged_by uuid references auth.users (id) on delete set null;

alter table public.contact_logs
  add column if not exists public_outcome text;

alter table public.contact_logs
  add column if not exists notes text;

-- Legacy rows may use a generic outcome column name.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_logs'
      and column_name = 'outcome'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_logs'
      and column_name = 'public_outcome'
  ) then
    update public.contact_logs
    set public_outcome = coalesce(nullif(trim(public_outcome), ''), outcome)
    where public_outcome is null and outcome is not null;
  end if;
end $$;
