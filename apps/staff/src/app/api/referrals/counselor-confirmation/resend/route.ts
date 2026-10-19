import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canManageReferrals } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { resendCounselorReferralConfirmation } from "@/lib/referral-notification-email";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { clientId?: string };
  try {
    body = (await request.json()) as { clientId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = (body.clientId ?? "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const result = await resendCounselorReferralConfirmation(admin, clientId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
