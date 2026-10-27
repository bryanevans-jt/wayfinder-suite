import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canManageIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-mail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!canManageIjpBillingSettings(profile?.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { folderId } = (await request.json()) as { folderId?: string };
  const id = folderId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Folder ID is required." }, { status: 400 });
  }

  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({
      supportsAllDrives: true,
      fileId: id,
      fields: "id, name, mimeType",
    });
    if (meta.data.mimeType !== "application/vnd.google-apps.folder") {
      return NextResponse.json({ error: "The provided ID is not a Google Drive folder." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, name: meta.data.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Google Drive folder.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
