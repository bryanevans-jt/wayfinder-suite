-- Worksheet import archive and commit warnings.

alter table public.pre_ets_worksheet_imports
  add column if not exists file_content text,
  add column if not exists drive_file_id text,
  add column if not exists drive_file_name text,
  add column if not exists archived_at timestamptz,
  add column if not exists commit_warnings jsonb not null default '[]'::jsonb;
