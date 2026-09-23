-- Link intake billing "ready to bill" to the casework contact log that triggered it.

alter table public.intake_billings
  add column if not exists ready_contact_log_id uuid references public.contact_logs (id) on delete set null;

create index if not exists intake_billings_ready_contact_log_idx
  on public.intake_billings (ready_contact_log_id)
  where ready_contact_log_id is not null;

comment on column public.intake_billings.ready_contact_log_id is
  'First qualifying casework contact log when status became ready_to_bill (contact_log reason).';
