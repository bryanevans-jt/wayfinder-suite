import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsServingMetrics } from "@wayfinder/supabase/pre-ets-serving-metrics";
import {
  canAccessPreEtsAccounts,
  canSupervisePreEts,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import { isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function canViewPreEtsServingMetrics(
  role: string,
  settings: Awaited<ReturnType<typeof loadPreEtsSettings>>
): boolean {
  return (
    isSuperAdminRole(role) ||
    isAdminRole(role) ||
    canAccessPreEtsAccounts(role, settings) ||
    canSupervisePreEts(role, settings)
  );
}

export async function GET(request: Request) {
  const route = "api/pre-ets/serving-metrics";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canViewPreEtsServingMetrics(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const schoolYearParam = url.searchParams.get("schoolYear")?.trim();
  const monthParam = url.searchParams.get("month")?.trim() ?? null;
  const allSchoolYears = url.searchParams.get("allSchoolYears") === "1";

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const schoolYear = allSchoolYears
      ? schoolYearParam || null
      : schoolYearParam || settings.school_year;

    const snapshot = await loadPreEtsServingMetrics(admin, {
      schoolYear: schoolYear || null,
      focusMonth: monthParam,
    });

    return NextResponse.json(snapshot);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
