import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { buildSessionRosterPdfBytes } from "@/lib/pre-ets-session-roster-pdf";
import { uploadSessionSignedRosterPdf } from "@/lib/pre-ets-upload-session-signed-roster";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

/** Build a PDF from in-app student signatures and upload to the signed-roster Drive folder. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/roster-signatures/finalize";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { count } = await admin
      .from("pre_ets_session_attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .not("roster_signature_data", "is", null);

    if ((count ?? 0) < 1) {
      return NextResponse.json(
        { error: "Collect at least one student signature before saving the roster to Drive." },
        { status: 400 }
      );
    }

    const pdfBytes = await buildSessionRosterPdfBytes(admin, sessionId, auth.settings, {
      includeCapturedSignatures: true,
    });
    if (!pdfBytes) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const uploaded = await uploadSessionSignedRosterPdf(
      admin,
      sessionId,
      auth.settings,
      Buffer.from(pdfBytes),
      `signed-roster-in-app-${sessionId.slice(0, 8)}.pdf`
    );

    const { finalizePreEtsSessionDocumentation } = await import("@/lib/pre-ets-finalize-session");
    await finalizePreEtsSessionDocumentation(admin, sessionId, auth.settings.school_year);

    return NextResponse.json({
      ok: true,
      driveFileId: uploaded.fileId,
      driveUrl: uploaded.webViewLink,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
