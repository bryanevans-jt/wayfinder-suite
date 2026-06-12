-- Offices were created with name only; admin portal expects city and state.
alter table public.offices
  add column if not exists state text;

alter table public.offices
  add column if not exists city text;
