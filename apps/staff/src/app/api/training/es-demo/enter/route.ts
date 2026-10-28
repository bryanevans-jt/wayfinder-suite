import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  TRAINING_ACTOR_COOKIE,
  TRAINING_NAME_COOKIE,
  TRAINING_ROLE_COOKIE,
  TRAINING_TARGET_COOKIE,
  trainingDemoCookieOptions,
} from "@wayfinder/supabase/training-demo-cookies";
import { getAppSession, staffAppOrigin } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { ensureEsTrainingDemoCaseload } from "@/lib/es-training-demo";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.actorRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { trainingEsUserId } = await ensureEsTrainingDemoCaseload(admin, session.actorUserId);

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", trainingEsUserId)
    .maybeSingle();
  const targetName =
    (profile?.display_name as string)?.trim() ||
    (profile?.full_name as string)?.trim() ||
    "ES Training Demo";

  const response = NextResponse.json({
    ok: true,
    redirectUrl: `${staffAppOrigin()}/dashboard/clients`,
  });
  const opts = trainingDemoCookieOptions();
  response.cookies.set(TRAINING_TARGET_COOKIE, trainingEsUserId, opts);
  response.cookies.set(TRAINING_ACTOR_COOKIE, session.actorUserId, opts);
  response.cookies.set(TRAINING_ROLE_COOKIE, "es", opts);
  response.cookies.set(TRAINING_NAME_COOKIE, targetName, opts);
  return response;
}
