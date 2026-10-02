-- Tie each authorization to the exact spreadsheet group header line it was imported under.
alter table public.pre_ets_authorizations
  add column if not exists worksheet_header_key text;

create index if not exists pre_ets_authorizations_program_header_idx
  on public.pre_ets_authorizations (program_group_id, worksheet_header_key);
