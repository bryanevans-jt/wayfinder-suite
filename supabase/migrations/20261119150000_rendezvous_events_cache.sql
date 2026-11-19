-- Short-TTL Google Calendar events cache for Team Calendar (mirrors busy_cache).
-- Populated by the Rendezvous API via service_role; push webhook / booking
-- mutations delete rows for a staff user so the next view refetch is fresh.

create table rendezvous.events_cache (
  staff_user_id uuid not null references public.profiles (id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  events jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (staff_user_id, window_start, window_end),
  constraint events_cache_window_order check (window_start < window_end)
);

comment on table rendezvous.events_cache is
  'Cached Google Calendar events.list payloads for Team Calendar. Short TTL; invalidated by calendar push webhook and booking mutations.';

create index events_cache_fetched_idx on rendezvous.events_cache (fetched_at);

grant select, insert, update, delete on table rendezvous.events_cache to service_role;
grant select, insert, update, delete on table rendezvous.events_cache to authenticated;

alter table rendezvous.events_cache enable row level security;

create policy events_cache_select on rendezvous.events_cache
  for select to authenticated
  using (
    rendezvous.can_access_staff_app()
    or (
      rendezvous.feature_enabled()
      and rendezvous.can_view_staff_schedule(staff_user_id)
    )
  );

create policy events_cache_write on rendezvous.events_cache
  for all to authenticated
  using (rendezvous.can_access_staff_app())
  with check (rendezvous.can_access_staff_app());
