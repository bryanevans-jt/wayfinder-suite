-- Invoice packet PDF archive fields and audit event log.

alter table public.pre_ets_invoice_packets
  add column if not exists drive_file_id text,
  add column if not exists drive_file_name text,
  add column if not exists generated_at timestamptz;

create table if not exists public.pre_ets_invoice_packet_events (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.pre_ets_invoice_packets (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_kind text not null check (
    event_kind in (
      'created',
      'status_changed',
      'pdf_generated',
      'drive_archived',
      'notes_updated'
    )
  ),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pre_ets_invoice_packet_events_packet_idx
  on public.pre_ets_invoice_packet_events (packet_id, created_at desc);

do $$
begin
  if to_regclass('public.pre_ets_invoice_packet_events') is not null then
    revoke all on table public.pre_ets_invoice_packet_events from anon, authenticated;
    grant all on table public.pre_ets_invoice_packet_events to service_role;
  end if;
end $$;
