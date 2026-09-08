-- Vocational service episodes, participant linking, milestone convergence (Complete + Dismissed),
-- simplified billable time logging, and counselor history preferences.

-- ---------------------------------------------------------------------------
-- Participants (DOB-anchored identity across referrals)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  date_of_birth date not null,
  normalized_name text,
  primary_email text,
  created_at timestamptz not null default now()
);

create index if not exists participants_dob_idx on public.participants (date_of_birth);

alter table public.clients
  add column if not exists participant_id uuid references public.participants (id) on delete set null;

create index if not exists clients_participant_id_idx
  on public.clients (participant_id)
  where participant_id is not null;

-- Fuzzy / near matches awaiting staff confirmation (does not block intake)
create table if not exists public.participant_link_flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  suggested_participant_id uuid not null references public.participants (id) on delete cascade,
  match_reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index if not exists participant_link_flags_pending_idx
  on public.participant_link_flags (status)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Service episodes (one per authorization / referral activation)
-- ---------------------------------------------------------------------------
create table if not exists public.service_episodes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  service_id uuid not null references public.services (id) on delete restrict,
  authorization_number text not null,
  status text not null default 'active'
    check (status in ('active', 'complete', 'dismissed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id)
);

create index if not exists service_episodes_participant_idx
  on public.service_episodes (participant_id, started_at desc);

create index if not exists service_episodes_auth_idx
  on public.service_episodes (authorization_number);

create index if not exists service_episodes_active_idx
  on public.service_episodes (participant_id, status)
  where status = 'active';

-- Activity bound to episode
alter table public.contact_logs
  add column if not exists service_episode_id uuid references public.service_episodes (id) on delete set null;

alter table public.applications
  add column if not exists service_episode_id uuid references public.service_episodes (id) on delete set null;

alter table public.client_stage_events
  add column if not exists service_episode_id uuid references public.service_episodes (id) on delete set null;

alter table public.es_time_entries
  add column if not exists service_episode_id uuid references public.service_episodes (id) on delete set null,
  add column if not exists client_present boolean not null default false,
  add column if not exists delivery_mode text
    check (delivery_mode is null or delivery_mode in ('in_person', 'virtual', 'phone'));

-- Counselor preference: show prior service history (default on)
alter table public.profiles
  add column if not exists counselor_show_prior_service_history boolean not null default true;

comment on column public.profiles.counselor_show_prior_service_history is
  'When false, counselor client profiles show only current authorization activity.';

-- GA-only operations flag (default off until explicitly enabled in Super Admin)
alter table public.admin_config
  add column if not exists ga_only_mode boolean not null default false;

comment on column public.admin_config.ga_only_mode is
  'When true, TN services/offices are hidden from active workflows; counselors never see TN data.';

-- ---------------------------------------------------------------------------
-- Milestones: Complete + Dismissed; retire Closed / Closed Successfully
-- ---------------------------------------------------------------------------

-- Rename Closed Successfully → Complete where it exists
update public.service_milestones
set title = 'Complete', name = 'complete'
where lower(trim(title)) = 'closed successfully';

-- Rename Closed → Complete for GA placement services (not TN-only rows)
update public.service_milestones sm
set title = 'Complete', name = 'complete'
from public.services s
where sm.service_id = s.id
  and (s.state is null or s.state = 'GA')
  and lower(trim(sm.title)) = 'closed'
  and s.name not like '%(TN)%';

-- Ensure Complete exists on GA WRT, IJP, Job Coaching
insert into public.service_milestones (service_id, order_index, title, name)
select s.id, 900, 'Complete', 'complete'
from public.services s
where s.name in (
  'Workplace Readiness Training (GA)',
  'Individual Job Placement (GA)',
  'Job Coaching (GA)'
)
and not exists (
  select 1 from public.service_milestones m
  where m.service_id = s.id and lower(trim(m.title)) = 'complete'
);

-- Job Coaching GA: remove redundant Closed if Complete exists and nothing references Closed
delete from public.service_milestones sm
using public.services s
where sm.service_id = s.id
  and s.name = 'Job Coaching (GA)'
  and lower(trim(sm.title)) = 'closed'
  and exists (
    select 1 from public.service_milestones m2
    where m2.service_id = s.id and lower(trim(m2.title)) = 'complete'
  )
  and not exists (
    select 1 from public.clients c where c.current_stage_id = sm.id
  )
  and not exists (
    select 1 from public.client_stage_events e where e.milestone_id = sm.id
  );

-- Move clients on old Closed milestones to Complete
update public.clients c
set current_stage_id = complete_ms.id
from public.service_milestones old_ms
join public.service_milestones complete_ms
  on complete_ms.service_id = old_ms.service_id
  and lower(trim(complete_ms.title)) = 'complete'
where c.current_stage_id = old_ms.id
  and lower(trim(old_ms.title)) in ('closed', 'closed successfully');

-- Archive trigger: Complete and Dismissed (+ legacy TN interrupted)
create or replace function public.sync_client_archived_at()
returns trigger
language plpgsql
as $$
declare
  stage_title text;
begin
  if tg_op = 'INSERT' or new.current_stage_id is distinct from old.current_stage_id then
    if new.current_stage_id is null then
      new.archived_at := null;
    else
      select title into stage_title
      from public.service_milestones
      where id = new.current_stage_id;

      if stage_title ~* '^(complete|dismissed|closed(\s+successfully)?|services[[:space:]]+interrupted)$' then
        new.archived_at := now() + interval '24 hours';
      else
        new.archived_at := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on column public.clients.archived_at is
  'When current stage is Complete, Dismissed, or legacy Closed: scheduled archive (now+24h). Cleared when stage changes back.';

-- Sync episode status when client reaches terminal milestone
create or replace function public.sync_service_episode_on_stage_change()
returns trigger
language plpgsql
as $$
declare
  stage_title text;
  episode_status text;
begin
  if tg_op = 'INSERT' or new.current_stage_id is distinct from old.current_stage_id then
    if new.current_stage_id is null then
      return new;
    end if;

    select lower(trim(title)) into stage_title
    from public.service_milestones
    where id = new.current_stage_id;

    if stage_title = 'complete' then
      episode_status := 'complete';
    elsif stage_title = 'dismissed' then
      episode_status := 'dismissed';
    elsif stage_title ~ '^(closed(\s+successfully)?|services[[:space:]]+interrupted)$' then
      episode_status := 'complete';
    else
      episode_status := null;
    end if;

    if episode_status is not null then
      update public.service_episodes
      set status = episode_status,
          ended_at = coalesce(ended_at, now())
      where client_id = new.id
        and status = 'active';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_sync_service_episode on public.clients;
create trigger clients_sync_service_episode
  after insert or update of current_stage_id on public.clients
  for each row
  execute function public.sync_service_episode_on_stage_change();

-- ---------------------------------------------------------------------------
-- Simplify es_time_entries: no approval workflow; new entries are approved.
-- Preserve rejected entries for audit; only promote in-flight draft/submitted rows.
update public.es_time_entries
set status = 'approved',
    approved_at = coalesce(approved_at, created_at)
where status in ('draft', 'submitted');

alter table public.es_time_entries
  alter column status set default 'approved';

-- Backfill service episodes for active clients with authorization numbers
insert into public.service_episodes (
  client_id,
  participant_id,
  service_id,
  authorization_number,
  status,
  started_at
)
select
  c.id,
  c.participant_id,
  c.current_service_id,
  coalesce(nullif(trim(c.authorization_number), ''), 'PENDING'),
  case
    when c.archived_at is not null and c.archived_at <= now() then 'complete'
    else 'active'
  end,
  coalesce(c.intake_status_changed_at, c.referred_at, c.created_at, now())
from public.clients c
where c.current_service_id is not null
  and c.intake_status = 'active'
  and not exists (
    select 1 from public.service_episodes se where se.client_id = c.id
  )
on conflict (client_id) do nothing;

-- Link existing activity to episodes where possible
update public.contact_logs cl
set service_episode_id = se.id
from public.service_episodes se
where cl.service_episode_id is null
  and cl.client_id = se.client_id;

update public.applications a
set service_episode_id = se.id
from public.service_episodes se
where a.service_episode_id is null
  and a.client_id = se.client_id;

update public.client_stage_events e
set service_episode_id = se.id
from public.service_episodes se
where e.service_episode_id is null
  and e.client_id = se.client_id;

update public.es_time_entries t
set service_episode_id = se.id
from public.service_episodes se
where t.service_episode_id is null
  and t.client_id = se.client_id;

-- RLS: service episodes readable by staff; counselors via assigned clients only (app layer)
alter table public.participants enable row level security;
alter table public.service_episodes enable row level security;
alter table public.participant_link_flags enable row level security;

create policy service_episodes_service_role on public.service_episodes
  for all using (auth.role() = 'service_role');

create policy participants_service_role on public.participants
  for all using (auth.role() = 'service_role');

create policy participant_link_flags_service_role on public.participant_link_flags
  for all using (auth.role() = 'service_role');

-- Bind new stage events to the client's service episode
create or replace function public.log_client_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  episode_id uuid;
begin
  if tg_op = 'UPDATE'
     and new.current_stage_id is distinct from old.current_stage_id
     and new.current_stage_id is not null then
    select id into episode_id
    from public.service_episodes
    where client_id = new.id
    limit 1;

    insert into public.client_stage_events (client_id, milestone_id, created_at, service_episode_id)
    values (new.id, new.current_stage_id, now(), episode_id);
  end if;
  return new;
end;
$$;
