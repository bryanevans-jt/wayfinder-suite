import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canManagePreEtsWorksheetTestingOverride,
  preEtsWorksheetTestingOverrideActive,
} from "@wayfinder/supabase/pre-ets-settings";
import { listPreEtsTestRostersForMonth } from "@/lib/pre-ets-list-test-rosters";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/worksheets/test-rosters";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canManagePreEtsWorksheetTestingOverride(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preEtsWorksheetTestingOverrideActive(auth.settings)) {
    return NextResponse.json(
      { error: "Worksheet testing override must be enabled to list test rosters." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const serviceMonth =
    url.searchParams.get("serviceMonth")?.trim() ||
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

  try {
    const admin = createServiceRoleClient();
    const { serviceMonth: normalized, rosters } = await listPreEtsTestRostersForMonth(
      admin,
      serviceMonth
    );

    return NextResponse.json({
      serviceMonth: normalized.slice(0, 7),
      rosters,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
