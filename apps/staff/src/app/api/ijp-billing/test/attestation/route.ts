import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { ensureIjpInvoiceRow, saveIjpAttestation } from "@/lib/ijp-billing-service";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

/** Minimal PNG for sandbox attestation tests only. */
const TEST_SIG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    serviceMonth?: string;
  };
  const clientId = body.clientId?.trim();
  const serviceMonth = body.serviceMonth?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json({ error: "clientId and serviceMonth are required." }, { status: 400 });
  }

  try {
    await ensureIjpInvoiceRow(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
    });

    const result = await saveIjpAttestation(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
      signatureDataUrl: TEST_SIG,
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
