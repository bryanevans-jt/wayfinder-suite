import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canManagePreEtsWorksheetTestingOverride,
  preEtsWorksheetTestingOverrideActive,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  DEFAULT_PRE_ETS_TEST_ROSTER_EMAIL,
  emailPreEtsTestRosters,
} from "@/lib/pre-ets-email-test-rosters";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/worksheets/email-test-rosters";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canManagePreEtsWorksheetTestingOverride(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!preEtsWorksheetTestingOverrideActive(auth.settings)) {
    return NextResponse.json(
      { error: "Worksheet testing override must be enabled to email test rosters." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as { serviceMonth?: string; email?: string };
    const admin = createServiceRoleClient();

    const serviceMonth =
      body.serviceMonth?.trim() ||
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();

    const recipientEmail =
      body.email?.trim() ||
      process.env.PRE_ETS_TEST_ROSTER_EMAIL?.trim() ||
      DEFAULT_PRE_ETS_TEST_ROSTER_EMAIL;

    const result = await emailPreEtsTestRosters(admin, {
      serviceMonth,
      recipientEmail,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
