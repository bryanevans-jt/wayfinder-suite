-- Remove staff office assignments to Tennessee sunset locations with no active clients,
-- and any links whose office row no longer exists.

delete from public.staff_office_assignments soa
where not exists (
  select 1 from public.offices o where o.id = soa.office_id
);

delete from public.staff_office_assignments soa
using public.offices o
where soa.office_id = o.id
  and (
    upper(trim(coalesce(o.state, ''))) = 'TN'
    or o.name ~* '\(TN\)\s*$'
  )
  and not exists (
    select 1
    from public.clients c
    where c.office_id = o.id
      and (c.archived_at is null or c.archived_at = '')
  );
