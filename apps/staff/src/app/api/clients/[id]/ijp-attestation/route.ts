import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { loadStaffNameById } from "@/lib/staff-names";
import { canAccessIjpClientSignature } from "@/lib/ijp-field-access";
import { loadIjpSignatureUiStatus } from "@/lib/ijp-attestation-status";
import { saveIjpAttestation, ensureIjpInvoiceRow } from "@/lib/ijp-billing-service";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

async function fieldSession() {
  const session = await getAppSession();
  if (!session) return null;
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, full_name, display_name")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!profile?.is_active) return null;
  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  return { session, role, userId: session.effectiveUserId, profile };
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id: clientId } = await ctx.params;
  const auth = await fieldSession();
  if (!auth) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const allowed = await canAccessIjpClientSignature(admin, {
    role: auth.role,
    userId: auth.userId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const status = await loadIjpSignatureUiStatus(admin, clientId);
  return NextResponse.json({ status });
}

export async function POST(request: Request, ctx: Ctx) {
  await assertNotPreviewMutation();
  const { id: clientId } = await ctx.params;
  const auth = await fieldSession();
  if (!auth) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const allowed = await canAccessIjpClientSignature(admin, {
    role: auth.role,
    userId: auth.userId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json()) as {
    serviceMonth?: string;
    signatureDataUrl?: string;
    uploadPdfBase64?: string;
    uploadImageBase64?: string;
    uploadMimeType?: string;
    isTest?: boolean;
  };

  const isTest = Boolean(body.isTest);
  if (isTest && auth.role !== "super_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const status = isTest ? null : await loadIjpSignatureUiStatus(admin, clientId);
  const serviceMonth = body.serviceMonth?.trim() || status?.serviceMonth;
  if (!serviceMonth) {
    return NextResponse.json({ error: "No active attestation month." }, { status: 400 });
  }

  if (!isTest && status && !status.captureOpen) {
    return NextResponse.json({ error: "Attestation window is closed for this month." }, { status: 400 });
  }

  const names = await loadStaffNameById(admin, [auth.userId], "Staff");
  const facilitatorName = names.get(auth.userId) ?? "Staff";

  const settings = await loadIjpBillingSettings(admin);

  try {
    if (!body.signatureDataUrl && !body.uploadPdfBase64 && !body.uploadImageBase64) {
      return NextResponse.json({ error: "Signature or upload is required." }, { status: 400 });
    }

    await ensureIjpInvoiceRow(admin, {
      clientId,
      serviceMonth,
      isTest,
      settings,
    });

    const result = await saveIjpAttestation(admin, {
      clientId,
      serviceMonth,
      isTest,
      settings,
      signatureDataUrl: body.signatureDataUrl,
      uploadPdfBase64: body.uploadPdfBase64,
      uploadImageBase64: body.uploadImageBase64,
      uploadMimeType: body.uploadMimeType,
      capturedBy: auth.userId,
      facilitatorName,
      captureMethod:
        body.uploadPdfBase64 || body.uploadImageBase64 ? "upload" : "digital",
    });

    return NextResponse.json({ ok: true, ...result, isTest });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save attestation." },
      { status: 400 }
    );
  }
}
