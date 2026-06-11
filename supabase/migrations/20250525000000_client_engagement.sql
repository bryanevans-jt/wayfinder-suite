-- Client engagement: applications status, messaging, meetings, natural support, notifications.

-- ---------------------------------------------------------------------------
-- Applications: standardized statuses + Other reason
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists status_other_reason text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.applications_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at
  before update on public.applications
  for each row
  execute function public.applications_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Natural support contacts (invited as profiles.role = support)
-- ---------------------------------------------------------------------------
create table if not exists public.natural_support_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text not null,
  email text not null,
  relationship text not null,
  relationship_other text,
  support_user_id uuid references auth.users (id) on delete set null,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint natural_support_relationship_allowed check (
    relationship in ('parent', 'guardian', 'spouse', 'family', 'other')
  ),
  unique (client_id, email)
);

create index if not exists natural_support_contacts_client_idx
  on public.natural_support_contacts (client_id);

-- ---------------------------------------------------------------------------
-- Client ↔ ES messaging (one thread per client)
-- ---------------------------------------------------------------------------
create table if not exists public.client_message_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid unique references public.clients (id) on delete set null,
  client_label text,
  current_es_user_id uuid references auth.users (id) on delete set null,
  last_client_message_at timestamptz,
  last_es_message_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_message_threads_es_idx
  on public.client_message_threads (current_es_user_id);

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_message_threads (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint client_messages_sender_role_allowed check (
    sender_role in ('client', 'es', 'supervisor')
  )
);

create index if not exists client_messages_thread_created_idx
  on public.client_messages (thread_id, created_at asc);

create table if not exists public.message_sla_dismissals (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_message_threads (id) on delete cascade,
  dismissed_by uuid not null references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  unique (thread_id, dismissed_by)
);

-- ---------------------------------------------------------------------------
-- Meeting requests
-- ---------------------------------------------------------------------------
create table if not exists public.client_meeting_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  client_label text,
  es_user_id uuid not null references auth.users (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  status text not null default 'pending',
  starts_at timestamptz not null,
  timezone text not null default 'America/New_York',
  location text not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint client_meeting_status_allowed check (
    status in ('pending', 'accepted', 'declined', 'cancelled')
  )
);

create index if not exists client_meeting_requests_client_starts_idx
  on public.client_meeting_requests (client_id, starts_at desc);

create index if not exists client_meeting_requests_es_idx
  on public.client_meeting_requests (es_user_id);

-- ---------------------------------------------------------------------------
-- In-app notifications + push subscription stubs
-- ---------------------------------------------------------------------------
create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link_path text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists in_app_notifications_user_unread_idx
  on public.in_app_notifications (user_id, created_at desc)
  where read_at is null;

create table if not exists public.push_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.message_retention_purge_runs (
  id uuid primary key default gen_random_uuid(),
  purged_before timestamptz not null,
  message_count int not null default 0,
  triggered_by uuid references auth.users (id) on delete set null,
  trigger_kind text not null,
  created_at timestamptz not null default now(),
  constraint message_retention_trigger_kind check (trigger_kind in ('manual', 'scheduled'))
);

-- Sync thread ES when assignment changes (keep one thread, update ES name via profile)
create or replace function public.sync_message_thread_es_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  select coalesce(p.full_name, c.contact_email, 'Client')
  into v_label
  from public.clients c
  left join public.profiles p on p.id = c.user_id
  where c.id = coalesce(new.client_id, old.client_id);

  insert into public.client_message_threads (client_id, client_label, current_es_user_id)
  values (new.client_id, v_label, new.es_user_id)
  on conflict (client_id) do update
    set current_es_user_id = excluded.current_es_user_id,
        client_label = coalesce(public.client_message_threads.client_label, excluded.client_label);

  return coalesce(new, old);
end;
$$;

drop trigger if exists es_client_assignments_sync_message_thread on public.es_client_assignments;
create trigger es_client_assignments_sync_message_thread
  after insert or update on public.es_client_assignments
  for each row
  execute function public.sync_message_thread_es_assignment();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.natural_support_contacts enable row level security;
alter table public.client_message_threads enable row level security;
alter table public.client_messages enable row level security;
alter table public.message_sla_dismissals enable row level security;
alter table public.client_meeting_requests enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.push_notification_subscriptions enable row level security;
alter table public.message_retention_purge_runs enable row level security;

-- Natural support: staff tiers manage; support reads own assignment row only indirectly via clients
drop policy if exists "natural_support_staff_manage" on public.natural_support_contacts;
create policy "natural_support_staff_manage"
  on public.natural_support_contacts for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'admin', 'super_admin')
    )
  );

drop policy if exists "natural_support_select_support" on public.natural_support_contacts;
create policy "natural_support_select_support"
  on public.natural_support_contacts for select to authenticated
  using (support_user_id = (select auth.uid()));

-- Message threads: client owns thread; ES assigned; supervisor over ES; admin read
drop policy if exists "message_threads_select_participants" on public.client_message_threads;
create policy "message_threads_select_participants"
  on public.client_message_threads for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_message_threads.client_id
        and c.user_id = (select auth.uid())
    )
    or current_es_user_id = (select auth.uid())
    or exists (
      select 1 from public.supervisor_es_assignments s
      where s.supervisor_user_id = (select auth.uid())
        and s.es_user_id = client_message_threads.current_es_user_id
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "message_threads_insert_client" on public.client_message_threads;
create policy "message_threads_insert_client"
  on public.client_message_threads for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_message_threads.client_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "message_threads_update_es" on public.client_message_threads;
create policy "message_threads_update_es"
  on public.client_message_threads for update to authenticated
  using (
    current_es_user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin', 'supervisor')
    )
  );

-- Messages
drop policy if exists "client_messages_select_participants" on public.client_messages;
create policy "client_messages_select_participants"
  on public.client_messages for select to authenticated
  using (
    exists (
      select 1 from public.client_message_threads t
      join public.clients c on c.id = t.client_id
      where t.id = client_messages.thread_id
        and c.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.client_message_threads t
      where t.id = client_messages.thread_id
        and t.current_es_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.client_message_threads t
      join public.supervisor_es_assignments s on s.es_user_id = t.current_es_user_id
      where t.id = client_messages.thread_id
        and s.supervisor_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "client_messages_insert_participants" on public.client_messages;
create policy "client_messages_insert_participants"
  on public.client_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.client_message_threads t
        join public.clients c on c.id = t.client_id
        where t.id = client_messages.thread_id
          and c.user_id = (select auth.uid())
          and client_messages.sender_role = 'client'
      )
      or exists (
        select 1 from public.client_message_threads t
        where t.id = client_messages.thread_id
          and t.current_es_user_id = (select auth.uid())
          and client_messages.sender_role = 'es'
      )
      or exists (
        select 1 from public.client_message_threads t
        join public.supervisor_es_assignments s on s.es_user_id = t.current_es_user_id
        where t.id = client_messages.thread_id
          and s.supervisor_user_id = (select auth.uid())
          and client_messages.sender_role = 'supervisor'
      )
    )
  );

-- SLA dismissals: supervisors only
drop policy if exists "message_sla_dismissals_supervisor" on public.message_sla_dismissals;
create policy "message_sla_dismissals_supervisor"
  on public.message_sla_dismissals for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('supervisor', 'admin', 'super_admin')
    )
  )
  with check (
    dismissed_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('supervisor', 'admin', 'super_admin')
    )
  );

-- Meetings
drop policy if exists "meetings_select_participants" on public.client_meeting_requests;
create policy "meetings_select_participants"
  on public.client_meeting_requests for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and c.user_id = (select auth.uid())
    )
    or es_user_id = (select auth.uid())
    or exists (
      select 1 from public.support_client_assignments s
      where s.client_id = client_meeting_requests.client_id
        and s.support_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('supervisor', 'admin', 'super_admin')
    )
  );

drop policy if exists "meetings_insert_es" on public.client_meeting_requests;
create policy "meetings_insert_es"
  on public.client_meeting_requests for insert to authenticated
  with check (
    es_user_id = (select auth.uid())
    and exists (
      select 1 from public.es_client_assignments e
      where e.es_user_id = (select auth.uid())
        and e.client_id = client_meeting_requests.client_id
    )
  );

drop policy if exists "meetings_update_participants" on public.client_meeting_requests;
create policy "meetings_update_participants"
  on public.client_meeting_requests for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_meeting_requests.client_id
        and c.user_id = (select auth.uid())
    )
    or es_user_id = (select auth.uid())
  );

-- Notifications: own rows only
drop policy if exists "in_app_notifications_own" on public.in_app_notifications;
create policy "in_app_notifications_own"
  on public.in_app_notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_own" on public.push_notification_subscriptions;
create policy "push_subscriptions_own"
  on public.push_notification_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "message_purge_runs_admin" on public.message_retention_purge_runs;
create policy "message_purge_runs_admin"
  on public.message_retention_purge_runs for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'super_admin')
    )
  );

-- Application updates for staff
drop policy if exists "applications_update_staff" on public.applications;
create policy "applications_update_staff"
  on public.applications for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('es', 'supervisor', 'admin', 'super_admin')
    )
  );
