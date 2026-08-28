import { loadSupervisorTeamHours } from "@/lib/supervisor-team-hours";
import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const { admin, user, role } = await assertPortalSession("supervisor");
    if (!isSupervisorRole(role) && !isAdminTierRole(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await loadSupervisorTeamHours(admin, user.id);
    return Response.json({ rows });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
