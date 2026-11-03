import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { loadIjpSignatureListFlags } from "@/lib/ijp-operations-alerts";
import {
  IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS,
  ijpSignatureFlagsDisabledByEnv,
  ijpSignatureFlagsRateLimited,
} from "@/lib/ijp-signature-flags-rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  if (ijpSignatureFlagsDisabledByEnv()) {
    return NextResponse.json({ flags: {} });
  }

  if (ijpSignatureFlagsRateLimited(session.actorUserId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!profile?.is_active) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  if (!isAdminTierRole(role) && !isSupervisorRole(role) && !isFieldSpecialistRole(role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json()) as { clientIds?: string[] };
  const clientIds = [...new Set((body.clientIds ?? []).filter(Boolean))].slice(
    0,
    IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS
  );
  if (clientIds.length === 0) {
    return NextResponse.json({ flags: {} });
  }

  const admin = createServiceRoleClient();
  const flags = await loadIjpSignatureListFlags(admin, clientIds);
  return NextResponse.json({ flags });
}
