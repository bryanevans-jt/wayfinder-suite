-- Wayfinder: profiles for multi-role routing (run in Supabase SQL editor or via CLI).
-- Adjust the trigger if you manage profile creation elsewhere.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  full_name text,
  updated_at timestamptz not null default now(),
  constraint profiles_role_allowed check (
    role in (
      'client',
      'support',
      'es',
      'supervisor',
      'accountant',
      'admin'
    )
  )
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Optional: auto-create a profile for new auth users (default client).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, is_active)
  values (new.id, 'client', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
