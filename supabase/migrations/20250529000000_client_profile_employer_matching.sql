-- Client profile fields, employer position needs, application linking, geocoordinates.

alter table public.clients
  add column if not exists home_address_line1 text,
  add column if not exists home_address_line2 text,
  add column if not exists home_city text,
  add column if not exists home_state text check (home_state is null or home_state in ('GA', 'TN')),
  add column if not exists home_zip text,
  add column if not exists home_latitude double precision,
  add column if not exists home_longitude double precision,
  add column if not exists primary_phone text,
  add column if not exists secondary_phone text,
  add column if not exists employment_goal_primary text,
  add column if not exists employment_goal_primary_other text,
  add column if not exists employment_goal_secondary text,
  add column if not exists employment_goal_secondary_other text;

alter table public.employers
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists zip text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists position_need_primary text,
  add column if not exists position_need_primary_other text,
  add column if not exists position_need_secondary text,
  add column if not exists position_need_secondary_other text;

alter table public.applications
  add column if not exists employer_id uuid references public.employers (id) on delete set null;

create index if not exists applications_employer_idx on public.applications (employer_id);
create index if not exists clients_home_geo_idx on public.clients (home_latitude, home_longitude);
create index if not exists employers_geo_idx on public.employers (latitude, longitude);
