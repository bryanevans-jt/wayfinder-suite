import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveSeMonthlyAlerts(
  admin: SupabaseClient,
  wayfinderClientId: string,
  reportingMonth: string | null
): Promise<void> {
  if (!wayfinderClientId || !reportingMonth) return;

  const now = new Date().toISOString();
  await admin
    .from("report_dashboard_alerts")
    .update({ resolved_at: now })
    .eq("wayfinder_client_id", wayfinderClientId)
    .eq("report_type_slug", "seMonthly")
    .eq("reporting_month", reportingMonth)
    .is("resolved_at", null);
}
