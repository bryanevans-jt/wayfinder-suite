-- Multi-use Wayfinder Pro sign-in links (counselors / external emails). One active row per auth user.

create table if not exists public.staff_reusable_signin_tokens (
  token_hash text primary key,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists staff_reusable_signin_tokens_auth_user_id_idx
  on public.staff_reusable_signin_tokens (auth_user_id);

create index if not exists staff_reusable_signin_tokens_expires_at_idx
  on public.staff_reusable_signin_tokens (expires_at);

alter table public.staff_reusable_signin_tokens enable row level security;
