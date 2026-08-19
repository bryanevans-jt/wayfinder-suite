import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { resolvePreEtsDrivePath } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { driveFileViewUrl, uploadPreEtsFileToDrive } from "@/lib/pre-ets-drive";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

type SessionRow = {
  session_date: string | null;
  pre_ets_schools: { name: string } | { name: string }[] | null;
  pre_ets_authorizations:
    | { auth_number: string | null; service_month: string }
    | { auth_number: string | null; service_month: string }[]
    | null;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/signed-roster";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const folderId = settings.drive_signed_roster_folder_id;
    if (!folderId) {
      return NextResponse.json(
        { error: "Signed roster Drive folder is not configured in Pre-ETS settings." },
        { status: 400 }
      );
    }

    const { data: session } = await admin
      .from("pre_ets_sessions")
      .select("session_date, pre_ets_schools(name), pre_ets_authorizations(auth_number, service_month)")
      .eq("id", sessionId)
      .maybeSingle();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const sessionRow = session as SessionRow | null;
    const school = relationOne(sessionRow?.pre_ets_schools ?? null);
    const authorization = relationOne(sessionRow?.pre_ets_authorizations ?? null);
    const serviceMonth = authorization?.service_month
      ? String(authorization.service_month).slice(0, 7)
      : sessionRow?.session_date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

    const subpath = resolvePreEtsDrivePath(settings.drive_folder_path_template, {
      schoolYear: settings.school_year,
      month: serviceMonth,
      school: school?.name ?? "school",
      authNumber: authorization?.auth_number ?? sessionId.slice(0, 8),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = file.name || `signed-roster-${sessionId.slice(0, 8)}.pdf`;
    const uploaded = await uploadPreEtsFileToDrive({
      folderId,
      fileName: `${subpath.replace(/\//g, "_")}_${baseName}`,
      mimeType: file.type || "application/pdf",
      buffer,
    });

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
