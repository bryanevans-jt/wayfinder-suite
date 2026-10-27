import type { SupabaseClient } from "@supabase/supabase-js";
import { generateErrorCode } from "@wayfinder/supabase/error-log";

type AuditPayload = {
  action: string;
  clientId: string;
  serviceMonth: string;
  dismissedBy: string;
  dismissedByName?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

/** Append IJP billing audit entries to Super Admin error log (informational, status 200). */
export async function logIjpBillingAudit(
  admin: SupabaseClient,
  payload: AuditPayload
): Promise<void> {
  const errorCode = generateErrorCode();
  const technicalMessage = `[IJP audit] ${payload.action} · client ${payload.clientId} · month ${payload.serviceMonth}${payload.reason ? ` · ${payload.reason}` : ""}`;

  await admin.from("system_error_logs").insert({
    error_code: errorCode,
    app: "staff",
    route: "ijp-billing/audit",
    user_id: payload.dismissedBy,
    user_name: payload.dismissedByName ?? null,
    status_code: 200,
    technical_message: technicalMessage,
    stack_trace: null,
    metadata: {
      ijp_audit: true,
      ...payload.metadata,
      action: payload.action,
      client_id: payload.clientId,
      service_month: payload.serviceMonth,
      reason: payload.reason ?? null,
    },
  });
}
