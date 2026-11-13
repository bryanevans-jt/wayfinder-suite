-- BACKFILL ONLY — do not apply automatically in agent/prod workflows without Bryan review.
-- Marks es_time_entries as billed when they already appear on a production IJP invoice
-- line_items[].entryId. If an entry appears on multiple invoices, the earliest
-- created invoice wins (first billed).

-- Prefer real UUID entryIds from billable lines (skip synthetic gvra-allowance:* / manual ids).
with line_hits as (
  select
    i.id as invoice_id,
    i.created_at as invoice_created_at,
    coalesce(i.compiled_at, i.created_at) as billed_at,
    (line.value ->> 'entryId') as entry_id_text
  from public.ijp_billing_invoices i
  cross join lateral jsonb_array_elements(coalesce(i.line_items, '[]'::jsonb)) as line(value)
  where i.is_test = false
    and (line.value ->> 'entryId') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ranked as (
  select
    entry_id_text::uuid as entry_id,
    invoice_id,
    billed_at,
    row_number() over (
      partition by entry_id_text
      order by invoice_created_at asc, invoice_id asc
    ) as rn
  from line_hits
)
update public.es_time_entries e
set
  ijp_billed_invoice_id = r.invoice_id,
  ijp_billed_at = r.billed_at
from ranked r
where e.id = r.entry_id
  and r.rn = 1
  and e.ijp_billed_invoice_id is null;

comment on column public.es_time_entries.ijp_billed_invoice_id is
  'IJP billing invoice that already included this time entry. Null = not yet billed. Backfill: 20261116120100_ijp_time_entry_billed_backfill.sql (review before apply).';
