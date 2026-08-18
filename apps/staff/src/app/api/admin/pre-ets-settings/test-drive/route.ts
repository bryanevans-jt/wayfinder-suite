import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { canManagePreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-mail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/admin/pre-ets-settings/test-drive";
  const session = await getAppSession();
  if (!session || !canManagePreEtsSettings(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const body = (await request.json()) as { folderId?: string };
    const folderId = body.folderId?.trim();
    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({
      supportsAllDrives: true,
      fileId: folderId,
      fields: "id, name, mimeType, driveId",
    });

    const mime = meta.data.mimeType ?? "";
    if (mime !== "application/vnd.google-apps.folder") {
      return NextResponse.json(
        { error: "The provided ID is not a Google Drive folder." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      folderId: meta.data.id,
      folderName: meta.data.name,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reach Google Drive folder.";
    return respondWithLoggedError("staff", route, new Error(message), actor);
  }
}
