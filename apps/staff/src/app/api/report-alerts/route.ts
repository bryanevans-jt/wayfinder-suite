import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { loadReportAlertsForStaffUser } from "@/lib/report-alerts-data";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.effectiveRole;
  if (!isEsRole(role) && !isSupervisorRole(role) && !isAdminTierRole(role)) {
    return NextResponse.json({ alerts: [] });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const alerts = await loadReportAlertsForStaffUser(
      admin,
      session.effectiveUserId,
      role
    );
    return NextResponse.json({ alerts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
