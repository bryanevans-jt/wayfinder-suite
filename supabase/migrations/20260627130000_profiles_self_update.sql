-- Allow staff to update their own profile fields (name, contact, bio).

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
