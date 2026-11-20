-- Private achievement badges for Employment Specialists and Transition Specialists.
-- Awards are frozen once written; later caseload edits never delete rows.
-- Authenticated users may read only their own badges. Writes are service-role only.

create table if not exists public.staff_badges (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  -- America/New_York month key YYYY-MM for monthly awards; empty string for lifetime.
  period_key text not null default '',
  earned_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  constraint staff_badges_staff_badge_period unique (staff_user_id, badge_key, period_key)
);

create index if not exists staff_badges_staff_earned_idx
  on public.staff_badges (staff_user_id, earned_at desc);

comment on table public.staff_badges is
  'Frozen private ES/TS achievement badges. Insert-only for awards; RLS allows self-read only.';

comment on column public.staff_badges.badge_key is
  'Stable id e.g. placements_1, kra_100, every_client_contacted, first_placement, career_placements_25.';

comment on column public.staff_badges.period_key is
  'YYYY-MM for month-scoped awards (America/New_York); empty string for lifetime awards.';

alter table public.staff_badges enable row level security;

drop policy if exists staff_badges_select_own on public.staff_badges;
create policy staff_badges_select_own on public.staff_badges
  for select to authenticated
  using (staff_user_id = auth.uid());

-- No insert/update/delete policies for authenticated — service role awards only.

grant select on public.staff_badges to authenticated;
grant all on public.staff_badges to service_role;
