import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canAccessPreEtsAccounts,
  canSupervisePreEts,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  approveWorksheetImport,
  commitWorksheetImport,
  rejectWorksheetImport,
} from "@wayfinder/supabase/pre-ets-worksheet-import";
import { archiveWorksheetImportToDrive } from "@/lib/pre-ets-worksheet-archive";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/worksheets/[id]";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_worksheet_imports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ import: data });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

function canReviewWorksheets(auth: { role: string; settings: { module_enabled: boolean; enabled_roles: string[] } }): boolean {
  return (
    canAccessPreEtsAccounts(auth.role, auth.settings) ||
    canSupervisePreEts(auth.role, auth.settings)
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/worksheets/[id]";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const body = (await request.json()) as { action?: string; reason?: string };

  try {
    const admin = createServiceRoleClient();

    if (body.action === "approve" || body.action === "reject") {
      if (!canReviewWorksheets(auth)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (body.action === "approve") {
        const result = await approveWorksheetImport(admin, id, auth.userId);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ ok: true, status: "approved" });
      }

      const result = await rejectWorksheetImport(admin, id, auth.userId, body.reason ?? "");
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (body.action === "commit") {
      if (!canAccessPreEtsAccounts(auth.role, auth.settings)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await commitWorksheetImport(admin, id, auth.userId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const archive = await archiveWorksheetImportToDrive(admin, id);

      return NextResponse.json({
        ok: true,
        districtId: result.districtId,
        ytdWarnings: result.ytdWarnings,
        authMatchStats: result.authMatchStats ?? null,
        archivedToDrive: archive.ok,
        archiveError: archive.ok ? null : archive.error,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
