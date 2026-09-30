import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { hidePreEtsProgramGroup } from "@wayfinder/supabase/pre-ets-program-group-visibility";
import {
  canAccessPreEtsAccounts,
  canManagePreEtsSetup,
  canSupervisePreEts,
} from "@wayfinder/supabase/pre-ets-settings";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function canManageGroupVisibility(
  role: string,
  settings: Parameters<typeof canManagePreEtsSetup>[1]
): boolean {
  return (
    canManagePreEtsSetup(role, settings) ||
    canSupervisePreEts(role, settings) ||
    canAccessPreEtsAccounts(role, settings)
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/program-groups/[id]/hide";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canManageGroupVisibility(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const admin = createServiceRoleClient();
    const result = await hidePreEtsProgramGroup(admin, id, auth.userId, body.reason ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
