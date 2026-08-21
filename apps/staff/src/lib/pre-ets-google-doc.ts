import { Readable } from "stream";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type GoogleDocInlineImage = {
  /** Template token without braces, e.g. InstructorSignature */
  tag: string;
  /** data:image/png;base64,... */
  dataUrl: string;
  widthPt?: number;
  heightPt?: number;
};

function findPlaceholderIndex(elements: unknown[], text: string): number {
  if (!elements) return -1;
  for (const el of elements as {
    paragraph?: {
      elements?: { textRun?: { content?: string }; startIndex?: number }[];
    };
    table?: {
      tableRows?: { tableCells?: { content?: unknown[] }[] }[];
    };
  }[]) {
    if (el.paragraph) {
      for (const run of el.paragraph.elements || []) {
        const content = run.textRun?.content || "";
        if (content.includes(text)) {
          return (run.startIndex || 0) + content.indexOf(text);
        }
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          const index = findPlaceholderIndex((cell.content as unknown[]) || [], text);
          if (index !== -1) return index;
        }
      }
    }
  }
  return -1;
}

async function uploadTempPngToDrive(
  drive: ReturnType<typeof google.drive>,
  dataUrl: string,
  folderId: string
): Promise<{ fileId: string; url: string }> {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid signature image data.");
  }
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: `temp_pre_ets_sig_${Date.now()}.png`,
      parents: [folderId],
      mimeType: "image/png",
    },
    media: { mimeType: "image/png", body: Readable.from(buffer) },
    fields: "id",
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error("Could not upload signature image to Drive.");

  await drive.permissions.create({
    supportsAllDrives: true,
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
  // Drive sometimes needs a beat before webContentLink is usable for Docs insert.
  await new Promise((r) => setTimeout(r, 1500));
  const link = await drive.files.get({
    supportsAllDrives: true,
    fileId,
    fields: "webContentLink",
  });
  return {
    fileId,
    url: link.data.webContentLink || `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

/** Resolve admin_config.drive_folders.signature_temp (same folder used by vocational reports). */
export async function loadPreEtsSignatureTempFolderId(
  admin: SupabaseClient
): Promise<string | null> {
  const { data } = await admin.from("admin_config").select("drive_folders").limit(1).maybeSingle();
  const folders = (data?.drive_folders as Record<string, unknown> | null) ?? null;
  const id = typeof folders?.signature_temp === "string" ? folders.signature_temp.trim() : "";
  return id || null;
}

/** Copy a Google Doc template, merge {{Placeholder}} tokens (and optional images), export PDF. */
export async function fillGoogleDocTemplatePdf(
  templateId: string,
  placeholders: Record<string, string>,
  tempName: string,
  options?: {
    images?: GoogleDocInlineImage[];
    signatureFolderId?: string | null;
  }
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

  const tempImageIds: string[] = [];

  try {
    const imageTags = new Set((options?.images ?? []).map((img) => img.tag));
    const textPlaceholders = Object.fromEntries(
      Object.entries(placeholders).filter(([key]) => !imageTags.has(key))
    );

    // Clear image tags in text pass when no image is supplied.
    for (const tag of ["InstructorSignature", "Signature"] as const) {
      if (!imageTags.has(tag) && textPlaceholders[tag] === undefined) {
        textPlaceholders[tag] = "";
      }
    }

    const requests = Object.entries(textPlaceholders).map(([key, value]) => ({
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

    const images = options?.images ?? [];
    if (images.length > 0) {
      const folderId = options?.signatureFolderId?.trim();
      if (!folderId) {
        throw new Error(
          "Signature temp Drive folder is not configured (Admin → Drive folders → Signature Temp)."
        );
      }

      const uploadedByDataUrl = new Map<string, { fileId: string; url: string }>();

      for (const image of images) {
        let uploaded = uploadedByDataUrl.get(image.dataUrl);
        if (!uploaded) {
          uploaded = await uploadTempPngToDrive(drive, image.dataUrl, folderId);
          uploadedByDataUrl.set(image.dataUrl, uploaded);
          tempImageIds.push(uploaded.fileId);
        }

        const marker = `__IMG_${image.tag}_${Date.now()}__`;
        await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: {
            requests: [
              {
                replaceAllText: {
                  containsText: { text: `{{${image.tag}}}`, matchCase: false },
                  replaceText: marker,
                },
              },
            ],
          },
        });

        const doc = await docs.documents.get({ documentId: tempDocId });
        const idx = findPlaceholderIndex((doc.data.body?.content as unknown[]) || [], marker);
        if (idx === -1) continue;

        await docs.documents.batchUpdate({
          documentId: tempDocId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: { startIndex: idx, endIndex: idx + marker.length },
                },
              },
              {
                insertInlineImage: {
                  location: { index: idx },
                  uri: uploaded.url,
                  objectSize: {
                    height: { magnitude: image.heightPt ?? 60, unit: "PT" },
                    width: { magnitude: image.widthPt ?? 160, unit: "PT" },
                  },
                },
              },
            ],
          },
        });
      }
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
    await drive.files.delete({ supportsAllDrives: true, fileId: tempDocId }).catch(() => undefined);
    for (const fileId of tempImageIds) {
      await drive.files.delete({ supportsAllDrives: true, fileId }).catch(() => undefined);
    }
  }
}
