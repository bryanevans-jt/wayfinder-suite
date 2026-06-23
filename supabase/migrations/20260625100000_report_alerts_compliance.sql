-- Open alert dedupe + service-role insert for cron sync

create unique index if not exists idx_report_dashboard_alerts_open_unique
  on public.report_dashboard_alerts (alert_type, reporting_month, wayfinder_client_id, report_type_slug)
  where resolved_at is null and wayfinder_client_id is not null;

drop policy if exists "Report service role manage alerts" on public.report_dashboard_alerts;
create policy "Report service role manage alerts"
  on public.report_dashboard_alerts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
