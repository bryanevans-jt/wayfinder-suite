import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isFieldSpecialistRole } from "@wayfinder/supabase/roles";
import { loadStaffBadgesMine } from "@wayfinder/supabase/staff-badges";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Private ES/TS achievement badges for the signed-in specialist.
 * Lazily freezes awards for prior closed America/New_York months, then returns
 * current-month progress + earned badges. No Pre-ETS data.
 */
export async function GET() {
  const route = "api/staff-badges/mine";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !isFieldSpecialistRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createServiceRoleClient();
    const payload = await loadStaffBadgesMine(admin, session.effectiveUserId);
    return NextResponse.json(payload);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}
