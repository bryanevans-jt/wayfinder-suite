import { assertPortalMutation, assertPortalSession, jsonPortalError, PortalAuthError } from "@/lib/portal-auth";
import { clearDemoTrainingMetrics } from "@/lib/demo-clients";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getAppSession();
    if (!session || !isSuperAdminRole(session.actorRole) || session.isPreviewing) {
      throw new PortalAuthError("Super admin access required.", 403);
    }
    await assertPortalMutation("super_admin");
    const { admin } = await assertPortalSession("super_admin");

    const result = await clearDemoTrainingMetrics(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return jsonPortalError(e);
  }
}
