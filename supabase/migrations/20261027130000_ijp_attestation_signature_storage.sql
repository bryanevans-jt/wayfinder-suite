-- Retain digital signature payload so attestation PDFs can be regenerated when invoice # changes.

alter table public.ijp_monthly_attestations
  add column if not exists signature_data_url text;

comment on column public.ijp_monthly_attestations.signature_data_url is
  'Data URL for digital captures only; used to regenerate attestation PDFs after billing fields change.';
