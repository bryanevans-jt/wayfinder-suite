-- Structured booking reason options + optional notes for Rendezvous.
alter table rendezvous.bookings
  add column if not exists notes text;

alter table rendezvous.bookings
  drop constraint if exists bookings_notes_len;

alter table rendezvous.bookings
  add constraint bookings_notes_len check (notes is null or char_length(notes) <= 500);

comment on column rendezvous.bookings.reason is
  'Meeting reason category: Intake, Progress Meeting, or Other.';

comment on column rendezvous.bookings.notes is
  'Optional free-text notes. Do not store sensitive client details.';
