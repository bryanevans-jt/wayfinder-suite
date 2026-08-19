import { google } from "googleapis";
import { formatPreEtsRateDollars } from "@wayfinder/supabase/pre-ets-settings";
import type { InvoicePacketPdfData } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { getGoogleAuth } from "@/lib/google-mail";

export function invoicePacketPlaceholders(data: InvoicePacketPdfData): Record<string, string> {
  return {
    ProviderName: data.providerName,
    RemitAddress: data.remitAddress,
    SchoolName: data.schoolName,
    AuthNumber: data.authNumber,
    AuthType: data.authType === "individual" ? "Individual" : "Group",
    InvoiceNumber: data.invoiceNumber ?? "",
    ServiceMonth: data.serviceMonth,
    ServiceCode: data.serviceCode,
    ServiceLabel: data.serviceLabel ?? "",
    RateDollars: formatPreEtsRateDollars(data.rateCents),
    TotalUnits: String(data.totalUnits),
    TotalAmount: (data.totalAmountCents / 100).toFixed(2),
  };
}

/** Copy a Google Doc template, merge {{Placeholder}} tokens, and export as PDF. */
export async function fillGoogleDocTemplatePdf(
  templateId: string,
  placeholders: Record<string, string>,
  tempName: string
): Promise<Uint8Array> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const copy = await drive.files.copy({
    supportsAllDrives: true,
    fileId: templateId,
    requestBody: { name: `[TEMP] ${tempName}` },
  });

  const tempDocId = copy.data.id;
  if (!tempDocId) {
    throw new Error("Could not copy the Google Doc template.");
  }

  try {
    const requests = Object.entries(placeholders).map(([key, value]) => ({
      replaceAllText: {
        containsText: { text: `{{${key}}}`, matchCase: false },
        replaceText: String(value ?? ""),
      },
    }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      });
    }

    const pdfRes = await drive.files.export(
      { supportsAllDrives: true, fileId: tempDocId, mimeType: "application/pdf" } as {
        fileId: string;
        mimeType: string;
      },
      { responseType: "arraybuffer" }
    );

    return new Uint8Array(pdfRes.data as ArrayBuffer);
  } finally {
    await drive.files.delete({ supportsAllDrives: true, fileId: tempDocId });
  }
}
