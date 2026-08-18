import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { driveFileViewUrl, uploadPreEtsFileToDrive } from "@/lib/pre-ets-drive";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/signed-roster";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const settings = await loadPreEtsSettings(createServiceRoleClient());
    const folderId = settings.drive_signed_roster_folder_id;
    if (!folderId) {
      return NextResponse.json(
        { error: "Signed roster Drive folder is not configured in Pre-ETS settings." },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPreEtsFileToDrive({
      folderId,
      fileName: file.name || `pre-ets-roster-${sessionId.slice(0, 8)}.pdf`,
      mimeType: file.type || "application/pdf",
      buffer,
    });

    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("pre_ets_sessions")
      .update({
        signed_roster_drive_file_id: uploaded.fileId,
        signed_roster_drive_file_name: uploaded.fileName,
        signed_roster_uploaded_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const { maybeCompleteSessionDocumentation } = await import(
      "@wayfinder/supabase/pre-ets-session-attendance"
    );
    await maybeCompleteSessionDocumentation(admin, sessionId, auth.settings.school_year);

    return NextResponse.json({
      ok: true,
      driveFileId: uploaded.fileId,
      driveUrl: uploaded.webViewLink ?? driveFileViewUrl(uploaded.fileId),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
