import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import {
  clientInSupervisorScope,
  esUserAllowedForSupervisor,
  loadSupervisorScope,
} from "@/lib/supervisor-client-scope";

export type IjpAttestationSlaRow = {
  alertId: string;
  clientId: string;
  clientName: string;
  esName: string;
  esUserId: string | null;
  reportingMonth: string;
  dueAt: string | null;
};

const IJP_SLUG = "ijp_attestation";

export async function loadIjpAttestationSlaRows(
  admin: SupabaseClient,
  role: string,
  userId: string
): Promise<IjpAttestationSlaRow[]> {
  const { data: alerts, error } = await admin
    .from("report_dashboard_alerts")
    .select("id, reporting_month, wayfinder_client_id, client_name, es_user_id, due_at")
    .eq("state", "GA")
    .eq("report_type_slug", IJP_SLUG)
    .is("resolved_at", null)
    .order("due_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  const { data: demoClients } = await admin.from("clients").select("id").eq("is_demo", true);
  const demoIds = new Set((demoClients ?? []).map((c) => c.id as string));

  const esIds = [...new Set((alerts ?? []).map((a) => a.es_user_id as string).filter(Boolean))];
  const { data: profiles } = esIds.length
    ? await admin.from("profiles").select("id, full_name, display_name").in("id", esIds)
    : { data: [] };
  const esName = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.display_name as string)?.trim() || (p.full_name as string)?.trim() || "ES",
    ])
  );

  let rows: IjpAttestationSlaRow[] = (alerts ?? [])
    .filter((a) => a.wayfinder_client_id && !demoIds.has(a.wayfinder_client_id as string))
    .map((a) => ({
      alertId: a.id as string,
      clientId: a.wayfinder_client_id as string,
      clientName: (a.client_name as string) || "Client",
      esUserId: (a.es_user_id as string) ?? null,
      esName: esName.get(a.es_user_id as string) ?? "—",
      reportingMonth: a.reporting_month as string,
      dueAt: (a.due_at as string) ?? null,
    }));

  if (isAdminTierRole(role)) {
    return rows;
  }

  if (isSupervisorRole(role)) {
    const scope = await loadSupervisorScope(admin, userId);
    const filtered: IjpAttestationSlaRow[] = [];
    for (const row of rows) {
      if (row.esUserId && esUserAllowedForSupervisor(scope, row.esUserId)) {
        filtered.push(row);
        continue;
      }
      if (await clientInSupervisorScope(admin, scope, row.clientId)) {
        filtered.push(row);
      }
    }
    return filtered;
  }

  return [];
}

export async function loadIjpSignatureListFlags(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<Record<string, string>> {
  if (clientIds.length === 0) return {};

  const { loadIjpSignatureUiStatus } = await import("@/lib/ijp-attestation-status");
  const out: Record<string, string> = {};
  await Promise.all(
    clientIds.map(async (id) => {
      const status = await loadIjpSignatureUiStatus(admin, id);
      if (status?.showListFlag) {
        out[id] = status.serviceMonthLabel;
      }
    })
  );
  return out;
}
