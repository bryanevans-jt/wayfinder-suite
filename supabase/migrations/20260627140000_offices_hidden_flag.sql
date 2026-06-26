-- Allow super admins to hide offices that are not in use yet (still in reference data).
alter table public.offices
  add column if not exists is_hidden boolean not null default false;

create index if not exists offices_visible_name_idx
  on public.offices (name)
  where not is_hidden;

comment on column public.offices.is_hidden is
  'When true, office is omitted from admin/supervisor pickers until unhidden by super admin.';
