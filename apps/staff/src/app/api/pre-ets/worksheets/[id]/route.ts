import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { commitWorksheetImport } from "@wayfinder/supabase/pre-ets-worksheet-import";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/worksheets/[id]/commit";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const body = (await request.json()) as { action?: string };

  if (body.action !== "commit") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
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
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
