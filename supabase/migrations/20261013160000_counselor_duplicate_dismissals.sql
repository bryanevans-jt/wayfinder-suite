-- Super Admin: persist "not the same person" for counselor possible-duplicate pairs.

create table if not exists public.counselor_duplicate_dismissals (
  pair_key text primary key,
  counselor_id_a uuid not null references public.counselors (id) on delete cascade,
  counselor_id_b uuid not null references public.counselors (id) on delete cascade,
  dismissed_by uuid references auth.users (id) on delete set null,
  dismissed_at timestamptz not null default now(),
  constraint counselor_duplicate_dismissals_distinct check (counselor_id_a <> counselor_id_b)
);

create index if not exists counselor_duplicate_dismissals_dismissed_at_idx
  on public.counselor_duplicate_dismissals (dismissed_at desc);

alter table public.counselor_duplicate_dismissals enable row level security;
