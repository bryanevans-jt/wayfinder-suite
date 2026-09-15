-- Drop staff/counselor office links for Tennessee and missing offices (immediate removal, not sunset exceptions).

delete from public.staff_office_assignments soa
where not exists (
  select 1 from public.offices o where o.id = soa.office_id
);

delete from public.staff_office_assignments soa
using public.offices o
where soa.office_id = o.id
  and (
    (o.state is not null and o.state::text = 'TN')
    or o.name ~* '\(TN\)\s*$'
  );

delete from public.counselor_office_assignments coa
where not exists (
  select 1 from public.offices o where o.id = coa.office_id
);

delete from public.counselor_office_assignments coa
using public.offices o
where coa.office_id = o.id
  and (
    (o.state is not null and o.state::text = 'TN')
    or o.name ~* '\(TN\)\s*$'
  );

update public.offices o
set is_hidden = true
where (
    (o.state is not null and o.state::text = 'TN')
    or o.name ~* '\(TN\)\s*$'
  )
  and coalesce(o.is_hidden, false) = false;
