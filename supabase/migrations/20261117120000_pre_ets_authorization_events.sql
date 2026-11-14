-- Audit trail for Pre-ETS authorization number and roster student changes.
-- Staff APIs use service_role; no authenticated RLS policies (same pattern as
-- pre_ets_invoice_packet_events and other Pre-ETS domain tables). Live DB has
-- no role-scoped policies on these tables — do not add delete policies.
--
-- Also extends invoice packet event kinds so draft unit refreshes after roster /
-- auth edits can be audited without reusing notes_updated.

alter table public.pre_ets_invoice_packet_events
  drop constraint if exists pre_ets_invoice_packet_events_event_kind_check;

alter table public.pre_ets_invoice_packet_events
  add constraint pre_ets_invoice_packet_events_event_kind_check
  check (
    event_kind in (
      'created',
      'status_changed',
      'pdf_generated',
      'drive_archived',
      'notes_updated',
      'draft_totals_refreshed'
    )
  );

create table if not exists public.pre_ets_authorization_events (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.pre_ets_authorizations (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_kind text not null check (
    event_kind in (
      'auth_number_changed',
      'roster_students_changed'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_authorization_events_auth_idx
  on public.pre_ets_authorization_events (authorization_id, created_at desc);

alter table public.pre_ets_authorization_events enable row level security;

do $$
begin
  if to_regclass('public.pre_ets_authorization_events') is not null then
    revoke all on table public.pre_ets_authorization_events from anon, authenticated;
    grant all on table public.pre_ets_authorization_events to service_role;
  end if;
end $$;

comment on table public.pre_ets_authorization_events is
  'Audit log for Pre-ETS authorization number and roster student mutations. App APIs use service role; no direct authenticated access.';
