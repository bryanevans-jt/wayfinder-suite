import {
  canAccessIjpBilling,
  canEditIjpBilling,
} from "@wayfinder/supabase/ijp-billing-settings";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { USER_FACING_AUTH_REQUIRED } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  const role = session.isPreviewing ? session.effectiveRole : (profile?.role as string);
  const active = Boolean(profile?.is_active);
  return NextResponse.json({
    canAccess: active && canAccessIjpBilling(role),
    canEdit: active && canEditIjpBilling(role),
    role,
  });
}
