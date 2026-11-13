-- Track which IJP invoice already billed each es_time_entries row so weekly
-- Generate Month runs never double-bill hours. GVRA invoices remain monthly:
-- weekly runs append unbilled hours into the client's draft month invoice.

alter table public.es_time_entries
  add column if not exists ijp_billed_invoice_id uuid
    references public.ijp_billing_invoices (id) on delete set null,
  add column if not exists ijp_billed_at timestamptz;

create index if not exists es_time_entries_ijp_unbilled_idx
  on public.es_time_entries (client_id, service_date)
  where ijp_billed_invoice_id is null;

create index if not exists es_time_entries_ijp_billed_invoice_idx
  on public.es_time_entries (ijp_billed_invoice_id)
  where ijp_billed_invoice_id is not null;

comment on column public.es_time_entries.ijp_billed_invoice_id is
  'IJP billing invoice that already included this time entry. Null = not yet billed. Prevents double-billing across weekly generate runs.';
comment on column public.es_time_entries.ijp_billed_at is
  'When this entry was linked to an IJP invoice for billing.';

-- Authenticated ES/supervisor must not edit or delete billed entries (would
-- silently desync a billed invoice). Admin tier may still update via RLS for
-- exceptional corrections; app APIs block/flag billed edits by default.
-- Service role (staff APIs) is unaffected by these policies.

drop policy if exists es_time_entries_update on public.es_time_entries;
create policy es_time_entries_update on public.es_time_entries
  for update to authenticated
  using (
    (
      es_user_id = auth.uid()
      and public.get_auth_user_role() = 'es'
      and status in ('draft', 'rejected')
      and ijp_billed_invoice_id is null
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and es_user_id in (select public.auth_user_supervised_es_ids())
      and ijp_billed_invoice_id is null
    )
    or public.auth_user_is_admin_tier()
  )
  with check (
    (
      es_user_id = auth.uid()
      and public.get_auth_user_role() = 'es'
      and status in ('draft', 'rejected')
      and ijp_billed_invoice_id is null
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and es_user_id in (select public.auth_user_supervised_es_ids())
      and ijp_billed_invoice_id is null
    )
    or public.auth_user_is_admin_tier()
  );

drop policy if exists es_time_entries_delete on public.es_time_entries;
create policy es_time_entries_delete on public.es_time_entries
  for delete to authenticated
  using (
    (
      es_user_id = auth.uid()
      and public.get_auth_user_role() = 'es'
      and status in ('draft', 'rejected')
      and ijp_billed_invoice_id is null
    )
    or (
      public.get_auth_user_role() = 'supervisor'
      and es_user_id in (select public.auth_user_supervised_es_ids())
      and ijp_billed_invoice_id is null
    )
    or public.auth_user_is_admin_tier()
  );
