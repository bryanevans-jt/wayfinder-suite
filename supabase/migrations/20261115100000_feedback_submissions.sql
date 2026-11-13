-- Team feedback: problems and feature requests from signed-in Wayfinder Pro users.
-- Do not apply from the agent — ship the file for human review / staged apply.

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid not null references auth.users (id) on delete cascade,
  submitter_name text,
  submitter_email text,
  submitter_role text,
  feedback_type text not null
    check (feedback_type in ('problem', 'feature')),
  title text not null,
  description text not null,
  page_url text,
  user_agent text,
  app_version text,
  attachment_path text,
  status text not null default 'new'
    check (
      status in (
        'new',
        'under_review',
        'approved',
        'on_hold',
        'ignored',
        'fixed'
      )
    ),
  decision_notes text
);

create index if not exists feedback_submissions_created_at_idx
  on public.feedback_submissions (created_at desc);

create index if not exists feedback_submissions_submitted_by_idx
  on public.feedback_submissions (submitted_by);

create index if not exists feedback_submissions_status_idx
  on public.feedback_submissions (status);

comment on table public.feedback_submissions is
  'Team member problem reports and feature suggestions from Wayfinder Pro.';

create or replace function public.feedback_submissions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_submissions_set_updated_at on public.feedback_submissions;
create trigger feedback_submissions_set_updated_at
  before update on public.feedback_submissions
  for each row
  execute function public.feedback_submissions_set_updated_at();

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_submissions_insert_own" on public.feedback_submissions;
create policy "feedback_submissions_insert_own"
  on public.feedback_submissions
  for insert
  to authenticated
  with check (auth.uid() = submitted_by);

drop policy if exists "feedback_submissions_select_own_or_admin" on public.feedback_submissions;
create policy "feedback_submissions_select_own_or_admin"
  on public.feedback_submissions
  for select
  to authenticated
  using (
    auth.uid() = submitted_by
    or public.auth_user_is_admin_tier()
  );

drop policy if exists "feedback_submissions_update_admin" on public.feedback_submissions;
create policy "feedback_submissions_update_admin"
  on public.feedback_submissions
  for update
  to authenticated
  using (public.auth_user_is_admin_tier())
  with check (public.auth_user_is_admin_tier());

grant select, insert, update on public.feedback_submissions to authenticated;

-- Optional screenshot / file attachments (signed upload URLs via service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
