import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadCooIntakeSnapshot } from "@wayfinder/supabase/coo-intake-snapshot";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const snapshot = await loadCooIntakeSnapshot(admin);
  return NextResponse.json({ snapshot });
}
