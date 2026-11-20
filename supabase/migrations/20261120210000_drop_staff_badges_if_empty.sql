-- Staff badges were rolled back as a product decision (kept on feature/staff-badges).
-- Drop the table only when unused so we never discard earned rows if any exist.

do $$
declare
  n bigint;
begin
  if to_regclass('public.staff_badges') is null then
    raise notice 'staff_badges does not exist; nothing to drop';
    return;
  end if;

  select count(*) into n from public.staff_badges;
  if n = 0 then
    drop policy if exists staff_badges_select_own on public.staff_badges;
    drop table public.staff_badges;
    raise notice 'Dropped empty staff_badges table';
  else
    raise notice 'Leaving staff_badges in place (% rows)', n;
  end if;
end $$;
