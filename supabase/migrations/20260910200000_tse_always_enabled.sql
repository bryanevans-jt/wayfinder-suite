-- Traditional Supported Employment (GA) remains a core offering — not toggle-gated.

alter table public.admin_config
  alter column traditional_supported_employment_enabled set default true;

update public.admin_config
set traditional_supported_employment_enabled = true;

comment on column public.admin_config.traditional_supported_employment_enabled is
  'Legacy column — app always offers Traditional Supported Employment. Kept true for compatibility.';
