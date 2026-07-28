import { assertPortalSession } from "@/lib/portal-auth";
import { loadSupervisorWeekPack } from "@/lib/operations-data";
import { isSupervisorRole, isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, role } = await assertPortalSession("supervisor");
    if (!isSupervisorRole(role) && !isAdminTierRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pack = await loadSupervisorWeekPack(user.id, role);
    return NextResponse.json(pack);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load week pack.";
    const status = /unauth/i.test(message) ? 401 : /forbid/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
