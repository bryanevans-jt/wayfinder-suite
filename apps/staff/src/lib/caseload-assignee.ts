import { isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

export const CASELOAD_ASSIGNEE_ROLES = ["es", "supervisor"] as const;

export type CaseloadAssigneeRole = (typeof CASELOAD_ASSIGNEE_ROLES)[number];

export function isCaseloadAssigneeRole(role: string | null | undefined): role is CaseloadAssigneeRole {
  const normalized = role?.trim().toLowerCase();
  return normalized === "es" || normalized === "supervisor";
}

/** Direct caseload assignment via es_client_assignments (ES or supervisor acting as ES). */
export async function staffActsAsEsForClient(
  userId: string,
  role: string | null | undefined,
  clientId: string
): Promise<boolean> {
  if (!isEsRole(role) && !isSupervisorRole(role)) {
    return false;
  }
  return esIsAssignedToClient(userId, clientId);
}
