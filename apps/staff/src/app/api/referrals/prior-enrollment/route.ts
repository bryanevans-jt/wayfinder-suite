import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  canManageReferrals,
  loadPriorEnrollmentReferralDraft,
} from "@wayfinder/supabase/referral-intake";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const priorClientId = new URL(request.url).searchParams.get("priorClientId")?.trim();
  if (!priorClientId) {
    return NextResponse.json({ error: "priorClientId required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const loaded = await loadPriorEnrollmentReferralDraft(admin, priorClientId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  return NextResponse.json({
    priorClientId: loaded.priorClientId,
    priorOutcomeLabel: loaded.priorOutcomeLabel,
    priorReferredAt: loaded.priorReferredAt,
    state: loaded.state,
    draft: loaded.draft,
    referralDate: new Date().toISOString(),
  });
}
