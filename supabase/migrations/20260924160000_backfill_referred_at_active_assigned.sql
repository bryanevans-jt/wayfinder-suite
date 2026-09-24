-- Referral Queue "Include Active" requires referred_at for most active rows.
-- Backfill activated/assigned clients that were missing referred_at (e.g. profile activate path).

update public.clients c
set
  referred_at = coalesce(c.intake_status_changed_at, c.created_at, now()),
  last_activity_at = now()
where coalesce(nullif(trim(c.intake_status), ''), 'active') = 'active'
  and c.referred_at is null
  and (
    exists (select 1 from public.es_client_assignments e where e.client_id = c.id)
    or nullif(trim(c.authorization_number), '') is not null
    or c.prior_client_id is not null
  );
