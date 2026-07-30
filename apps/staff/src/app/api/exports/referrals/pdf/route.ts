import { loadReferralExportRows } from "@/lib/referral-export-data";
import {
  buildReferralDetailPdf,
  buildReferralListPdf,
  referralListPdfFilename,
  referralPdfFilename,
} from "@/lib/referral-pdf";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canManageReferrals } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId")?.trim() || null;
  const idsParam = url.searchParams.get("ids")?.trim() || "";
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!clientId && ids.length === 0) {
    return NextResponse.json({ error: "clientId or ids required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const publicDir = path.join(process.cwd(), "public");

  if (clientId) {
    const rows = await loadReferralExportRows(admin, [clientId]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }
    const bytes = await buildReferralDetailPdf(rows[0], publicDir);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${referralPdfFilename(rows[0])}"`,
      },
    });
  }

  const rows = await loadReferralExportRows(admin, ids);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No referrals found for export" }, { status: 404 });
  }
  const bytes = await buildReferralListPdf(rows, publicDir);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${referralListPdfFilename()}"`,
    },
  });
}
