-- Part 1 of 2: add enum values only (must commit before Part 2).
-- If your DB stores profiles.role as text (no user_role enum), this is a no-op.

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    begin
      alter type public.user_role add value if not exists 'hr';
    exception
      when duplicate_object then null;
    end;
    begin
      alter type public.user_role add value if not exists 'hospitality_specialist';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
