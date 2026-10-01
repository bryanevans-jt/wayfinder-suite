import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { buildPreEtsRosterAttachmentFilename } from "@wayfinder/supabase/pre-ets-roster-filename";
import { buildAuthorizationRosterPdf } from "@/lib/pre-ets-authorization-roster-pdf";
import { isPreEtsAuthorizationVisibleToRole } from "@/lib/pre-ets-field-gate";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

type AuthRow = {
  auth_number: string | null;
  auth_type: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/authorizations/[id]/roster-pdf";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const url = new URL(request.url);
  const sessionDate = url.searchParams.get("sessionDate");

  try {
    const admin = createServiceRoleClient();
    const { data: authorization, error } = await admin
      .from("pre_ets_authorizations")
      .select(
        "id, auth_number, auth_type, service_code, service_label, pre_ets_schools(name), pre_ets_program_groups(instructor_name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !authorization) {
      return NextResponse.json({ error: "Authorization not found" }, { status: 404 });
    }

    const authRow = authorization as AuthRow;
    if (!isPreEtsAuthorizationVisibleToRole(authRow, auth.role, auth.settings)) {
      return NextResponse.json(
        {
          error: auth.settings.worksheet_testing_override_enabled
            ? "This test roster is visible to Admin and Super Admin only until authorization numbers are finalized."
            : "This roster is not available until an authorization number is entered.",
        },
        { status: 403 }
      );
    }
    const settings = await loadPreEtsSettings(admin);
    const built = await buildAuthorizationRosterPdf(admin, id, settings, { sessionDate });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const pdfBytes = built.pdfBytes;
    const safeName = buildPreEtsRosterAttachmentFilename(
      built.fileLabel || `roster-${id.slice(0, 8)}`
    );
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
