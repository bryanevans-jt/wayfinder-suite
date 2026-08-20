-- Editable automated email templates (Super Admin).

create table if not exists public.email_templates (
  key text primary key,
  subject text not null,
  body text,
  intro text,
  closing text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.email_templates enable row level security;

revoke all on table public.email_templates from anon, authenticated;
grant all on table public.email_templates to service_role;

comment on table public.email_templates is
  'Super Admin–editable automated email templates. Defaults live in app code; rows override subject/body/intro/closing.';
