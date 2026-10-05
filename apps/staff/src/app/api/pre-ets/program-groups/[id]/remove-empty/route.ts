import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { removeEmptyPreEtsProgramGroupShell } from "@wayfinder/supabase/pre-ets-program-group-admin";
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
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/program-groups/[id]/remove-empty";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canManageGroupVisibility(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const result = await removeEmptyPreEtsProgramGroupShell(admin, id, auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, mode: result.mode });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
