import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { loadReportAlertsForStaffUser } from "@/lib/report-alerts-data";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const route = "api/report-alerts";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.effectiveRole;
  if (!isEsRole(role) && !isSupervisorRole(role) && !isAdminTierRole(role)) {
    return NextResponse.json({ alerts: [] });
  }

  const actor = { userId: session.effectiveUserId, userRole: role };

  try {
    const admin = createServiceRoleClient();
    const alerts = await loadReportAlertsForStaffUser(
      admin,
      session.effectiveUserId,
      role
    );
    return NextResponse.json({ alerts });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
