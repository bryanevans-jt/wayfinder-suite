import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  canAssignReferralFieldSpecialist,
  canManageReferrals,
  loadDirectReferralAssignEnabled,
} from "@wayfinder/supabase/referral-intake";
import { loadReferralFieldSpecialistOptions } from "@wayfinder/supabase/referral-field-specialists";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const directAssign = await loadDirectReferralAssignEnabled(admin);
  if (!directAssign) {
    return NextResponse.json({ options: [], directReferralAssignEnabled: false });
  }

  if (!canAssignReferralFieldSpecialist(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const officeId = searchParams.get("officeId");

  const options = await loadReferralFieldSpecialistOptions(admin, officeId);

  return NextResponse.json({
    directReferralAssignEnabled: true,
    options,
  });
}
