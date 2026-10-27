import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canAccessIjpBilling, loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { NextResponse } from "next/server";
import { USER_FACING_AUTH_REQUIRED, USER_FACING_FORBIDDEN } from "@wayfinder/supabase/error-log";

export async function requireIjpBillingApi() {
  const session = await getAppSession();
  if (!session) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  if (!profile?.is_active) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  if (!canAccessIjpBilling(role)) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const admin = createServiceRoleClient();
  const settings = await loadIjpBillingSettings(admin);

  return {
    session,
    role,
    admin,
    settings,
    userId: session.effectiveUserId,
  };
}
