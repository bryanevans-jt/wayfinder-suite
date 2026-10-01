import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canManagePreEtsWorksheetTestingOverride,
  preEtsWorksheetTestingOverrideActive,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  buildPreEtsTestRostersZip,
  PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE,
} from "@/lib/pre-ets-build-test-rosters-zip";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET(request: Request) {
  const route = "api/pre-ets/worksheets/test-rosters-zip";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canManagePreEtsWorksheetTestingOverride(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preEtsWorksheetTestingOverrideActive(auth.settings)) {
    return NextResponse.json(
      { error: "Worksheet testing override must be enabled to download test rosters." },
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

  const partParam = url.searchParams.get("part");
  const part = partParam ? Number.parseInt(partParam, 10) : 1;

  try {
    const admin = createServiceRoleClient();
    const result = await buildPreEtsTestRostersZip(admin, {
      serviceMonth,
      part: Number.isFinite(part) ? part : 1,
      chunkSize: PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return new NextResponse(Buffer.from(result.zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.attachmentName}"`,
        "X-Pre-Ets-Zip-Part": String(result.part),
        "X-Pre-Ets-Zip-Part-Count": String(result.partCount),
        "X-Pre-Ets-Zip-Roster-Count": String(result.rosterCount),
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
