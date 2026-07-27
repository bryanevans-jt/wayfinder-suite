-- Part 1 of 2: add Transition Specialist + WRT Admin enum values (must commit before Part 2).

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    begin
      alter type public.user_role add value if not exists 'transition_specialist';
    exception
      when duplicate_object then null;
    end;
    begin
      alter type public.user_role add value if not exists 'wrt_admin';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
