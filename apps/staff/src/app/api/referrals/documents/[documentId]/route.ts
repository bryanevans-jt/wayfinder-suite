import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canManageReferrals } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ documentId: string }> };

function contentDisposition(filename: string, disposition: "inline" | "attachment"): string {
  const safe = filename.replace(/["\r\n]/g, "_").slice(0, 180) || "document";
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { documentId } = await params;
  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const dispositionParam = url.searchParams.get("disposition");
  const disposition: "inline" | "attachment" =
    dispositionParam === "inline" ? "inline" : "attachment";

  const admin = createServiceRoleClient();
  const { data: doc, error } = await admin
    .from("client_referral_documents")
    .select("id, file_name, mime_type, storage_path, client_id")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const storagePath = doc.storage_path as string;
  const { data: blob, error: downloadError } = await admin.storage
    .from("referral-docs")
    .download(storagePath);

  if (downloadError || !blob) {
    return NextResponse.json(
      { error: downloadError?.message || "Could not download file" },
      { status: 500 }
    );
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const mime = (doc.mime_type as string | null) || "application/octet-stream";
  const fileName = (doc.file_name as string) || "document";

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": contentDisposition(fileName, disposition),
      "Cache-Control": "private, no-store",
      "Content-Length": String(bytes.length),
    },
  });
}
