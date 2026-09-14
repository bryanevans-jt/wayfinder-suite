import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  loadPreEtsSchoolPipeline,
  paginatePreEtsPipelineRows,
  type PreEtsPipelineStatus,
} from "@wayfinder/supabase/pre-ets-school-pipeline";
import {
  canAccessPreEtsAccounts,
  canSupervisePreEts,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import { isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function canViewPreEtsPipeline(role: string, settings: Awaited<ReturnType<typeof loadPreEtsSettings>>): boolean {
  return (
    isSuperAdminRole(role) ||
    isAdminRole(role) ||
    canAccessPreEtsAccounts(role, settings) ||
    canSupervisePreEts(role, settings)
  );
}

export async function GET(request: Request) {
  const route = "api/pre-ets/pipeline";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canViewPreEtsPipeline(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  const statusParam = url.searchParams.get("status")?.trim() ?? "all";
  const validStatuses = new Set([
    "all",
    "awaiting_spreadsheet",
    "pending_authorization",
    "roster_submitted",
  ]);
  const status = validStatuses.has(statusParam)
    ? (statusParam as PreEtsPipelineStatus | "all")
    : "all";

  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10);

  try {
    const admin = createServiceRoleClient();
    const allRows = await loadPreEtsSchoolPipeline(admin, {
      userId: auth.userId,
      role: auth.role,
      serviceMonth: month,
    });

    const result = paginatePreEtsPipelineRows(allRows, {
      search,
      status,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    });

    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
