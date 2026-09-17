import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  canManageReferrals,
  searchPriorEnrollmentsForNewService,
} from "@wayfinder/supabase/referral-intake";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const admin = createServiceRoleClient();
  const clients = await searchPriorEnrollmentsForNewService(admin, q);

  return NextResponse.json({ clients });
}
