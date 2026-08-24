-- Ensure instructor exists on legacy user_role enums (capacity / portal filters).

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    begin
      alter type public.user_role add value if not exists 'instructor';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
