import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { repairOrphanedClientsToSupervisors } from "@/lib/portal-staff-users";
import { NextRequest } from "next/server";

type Body = {
  /** When set, only clients who logged time with this ES and have no current assignee. */
  es_user_id?: string;
};

/**
 * Reassign unassigned clients to their supervisor (clients.supervisor_user_id).
 * Use after inactive ES removals left clients without a caseload assignee.
 */
export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      body = {};
    }

    const esUserId = body.es_user_id?.trim() || null;
    const result = await repairOrphanedClientsToSupervisors(admin, { esUserId });

    return Response.json({
      ok: true,
      ...result,
      unassignedClients: result.leftUnassigned,
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
