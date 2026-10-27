import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { buildIjpAttestationPlaceholders } from "@wayfinder/supabase/ijp-billing-lines";
import { loadClientAuthNumber } from "@/lib/ijp-billing-service";
import { canAccessIjpClientSignature } from "@/lib/ijp-field-access";
import { exportIjpAttestationPdf } from "@/lib/ijp-billing-doc-pdf";
import { createServerClient } from "@wayfinder/supabase";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";
import { loadStaffNameById } from "@/lib/staff-names";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id: clientId } = await ctx.params;
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!profile?.is_active) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  const admin = createServiceRoleClient();
  const allowed = await canAccessIjpClientSignature(admin, {
    role,
    userId: session.effectiveUserId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ error: "month is required (YYYY-MM-01)." }, { status: 400 });
  }

  const settings = await loadIjpBillingSettings(admin);
  const authNumber = await loadClientAuthNumber(admin, clientId);
  const names = await loadStaffNameById(admin, [session.effectiveUserId], "Staff");
  const invoiceDate = localDateStringInTz(new Date(), STAFF_CLOCK_TIMEZONE);
  const d = new Date(`${invoiceDate}T12:00:00`);
  const dateLabel = d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  const templateId =
    settings.template_attestation_doc_id?.trim() ||
    "1r8ekYATmXRbfAxNOQJd_sWJwbprUU9A17Gou7fKvVHE";

  const pdf = await exportIjpAttestationPdf({
    templateDocId: templateId,
    tempName: "IJP Attestation Blank",
    placeholders: buildIjpAttestationPlaceholders({
      attestationProviderName: names.get(session.effectiveUserId) ?? "Staff",
      providerInvoiceNumber: "",
      authorizationNumber: authNumber,
      attestationDate: dateLabel,
    }),
    signatureFolderId: settings.drive_signature_temp_folder_id,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="ijp-attestation-blank.pdf"',
    },
  });
}
