-- Toggle Customized Supported Employment in service pickers (default off).
alter table public.admin_config
  add column if not exists customized_supported_employment_enabled boolean not null default false;

comment on column public.admin_config.customized_supported_employment_enabled is
  'When true, Customized Supported Employment appears in service selection lists.';
