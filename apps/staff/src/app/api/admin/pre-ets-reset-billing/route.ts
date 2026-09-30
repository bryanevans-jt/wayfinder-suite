import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { resetPreEtsBillingMonthForDistrict } from "@wayfinder/supabase/pre-ets-data-reset";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/admin/pre-ets-reset-billing";
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const body = (await request.json()) as {
      districtNumber?: string;
      schoolYear?: string;
      serviceMonth?: string;
      confirmPhrase?: string;
      clearWorksheetImports?: boolean;
      clearGroupMappings?: boolean;
      clearClassSetup?: boolean;
    };

    if (body.confirmPhrase?.trim() !== "RESET BILLING") {
      return NextResponse.json(
        { error: "Type RESET BILLING in the confirmation field to proceed." },
        { status: 400 }
      );
    }

    const admin = createServiceRoleClient();
    const result = await resetPreEtsBillingMonthForDistrict(admin, {
      districtNumber: body.districtNumber ?? "",
      schoolYear: body.schoolYear ?? "",
      serviceMonth: body.serviceMonth ?? "",
      clearWorksheetImports: body.clearWorksheetImports !== false,
      clearGroupMappings: Boolean(body.clearGroupMappings),
      clearClassSetup: Boolean(body.clearClassSetup),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
