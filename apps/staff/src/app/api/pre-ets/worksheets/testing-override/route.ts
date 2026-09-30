import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canManagePreEtsWorksheetTestingOverride,
  loadPreEtsSettings,
  normalizePreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/worksheets/testing-override";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    return NextResponse.json({
      enabled: settings.worksheet_testing_override_enabled,
      canManage: canManagePreEtsWorksheetTestingOverride(session.effectiveRole),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}

export async function PATCH(request: Request) {
  const route = "api/pre-ets/worksheets/testing-override";
  const session = await getAppSession();
  if (!session || !canManagePreEtsWorksheetTestingOverride(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const body = (await request.json()) as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: row, error: findErr } = await admin
      .from("pre_ets_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (findErr || !row?.id) {
      return respondWithLoggedError("staff", route, findErr ?? new Error("Settings not found"), actor);
    }

    const { data, error } = await admin
      .from("pre_ets_settings")
      .update({
        worksheet_testing_override_enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: session.effectiveUserId,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    const settings = normalizePreEtsSettingsRow(data as Record<string, unknown>);
    return NextResponse.json({
      ok: true,
      enabled: settings.worksheet_testing_override_enabled,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
