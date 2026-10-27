import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import {
  previewIjpAttestationPdf,
  syncIjpInvoiceLineItemsFromBillable,
} from "@/lib/ijp-billing-service";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId")?.trim();
  const serviceMonth = request.nextUrl.searchParams.get("serviceMonth")?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json(
      { error: "clientId and serviceMonth are required." },
      { status: 400 }
    );
  }

  try {
    await syncIjpInvoiceLineItemsFromBillable(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
    });
    const pdf = await previewIjpAttestationPdf(auth.admin, {
      clientId,
      serviceMonth,
      settings: auth.settings,
      isTest: true,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ijp-attestation-preview-blank.pdf"',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Attestation preview failed." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    serviceMonth?: string;
    signatureDataUrl?: string | null;
    facilitatorName?: string;
  };
  const clientId = body.clientId?.trim();
  const serviceMonth = body.serviceMonth?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json(
      { error: "clientId and serviceMonth are required." },
      { status: 400 }
    );
  }

  const signatureDataUrl = body.signatureDataUrl?.trim();
  if (signatureDataUrl && !signatureDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "signatureDataUrl must be a data:image URL." }, { status: 400 });
  }

  try {
    await syncIjpInvoiceLineItemsFromBillable(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
    });
    const pdf = await previewIjpAttestationPdf(auth.admin, {
      clientId,
      serviceMonth,
      settings: auth.settings,
      isTest: true,
      signatureDataUrl: signatureDataUrl || null,
      facilitatorName: body.facilitatorName,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ijp-attestation-preview-signed.pdf"',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Attestation preview failed." },
      { status: 400 }
    );
  }
}
