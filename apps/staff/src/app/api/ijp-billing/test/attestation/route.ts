import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { ensureIjpInvoiceRow, saveIjpAttestation } from "@/lib/ijp-billing-service";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    serviceMonth?: string;
    signatureDataUrl?: string;
  };
  const clientId = body.clientId?.trim();
  const serviceMonth = body.serviceMonth?.trim();
  const signatureDataUrl = body.signatureDataUrl?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json({ error: "clientId and serviceMonth are required." }, { status: 400 });
  }
  if (!signatureDataUrl?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Draw the client signature in the preview section before running test attestation." },
      { status: 400 }
    );
  }

  try {
    await ensureIjpInvoiceRow(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
      forceRefresh: true,
    });

    const result = await saveIjpAttestation(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
      signatureDataUrl,
      capturedBy: auth.userId,
      facilitatorName: "IJP Test Run",
      captureMethod: "digital",
    });

    return NextResponse.json({
      ok: true,
      ...result,
      note: "Test attestation only — production flags unchanged.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Test attestation failed." },
      { status: 400 }
    );
  }
}
