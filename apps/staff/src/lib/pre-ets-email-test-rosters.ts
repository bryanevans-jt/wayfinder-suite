import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import JSZip from "jszip";
import { buildAuthorizationRosterPdf } from "@/lib/pre-ets-authorization-roster-pdf";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export const DEFAULT_PRE_ETS_TEST_ROSTER_EMAIL = "bryan.evans@thejoshuatree.org";

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

export type EmailTestRostersResult =
  | {
      ok: true;
      emailedTo: string;
      rosterCount: number;
      skippedEmpty: number;
      serviceMonth: string;
      attachmentName: string;
    }
  | { ok: false; error: string };

export async function emailPreEtsTestRosters(
  admin: AdminClient,
  input: {
    serviceMonth: string;
    recipientEmail: string;
  }
): Promise<EmailTestRostersResult> {
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);
  const to = input.recipientEmail.trim().toLowerCase();
  if (!to) {
    return { ok: false, error: "Recipient email is required" };
  }

  const settings = await loadPreEtsSettings(admin);

  const { data: authorizations, error: authErr } = await admin
    .from("pre_ets_authorizations")
    .select("id")
    .eq("service_month", serviceMonth)
    .order("created_at", { ascending: true });

  if (authErr) {
    return { ok: false, error: authErr.message };
  }

  const zip = new JSZip();
  let rosterCount = 0;
  let skippedEmpty = 0;
  const usedNames = new Map<string, number>();

  for (const row of authorizations ?? []) {
    const authId = row.id as string;
    const built = await buildAuthorizationRosterPdf(admin, authId, settings);
    if (!built.ok) {
      if (built.skip) skippedEmpty++;
      continue;
    }

    let baseName = built.fileLabel || `roster-${authId.slice(0, 8)}`;
    const seen = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, seen + 1);
    if (seen > 0) {
      baseName = `${baseName} (${seen + 1})`;
    }

    zip.file(`${baseName}.pdf`, built.pdfBytes);
    rosterCount++;
  }

  if (rosterCount === 0) {
    return {
      ok: false,
      error: `No rosters with approved students (PID required) found for ${serviceMonth.slice(0, 7)}.`,
    };
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const monthLabel = serviceMonth.slice(0, 7);
  const attachmentName = `pre-ets-test-rosters-${monthLabel}.zip`;

  const gauth = await getGoogleAuth();
  await sendEmail(gauth, {
    to,
    subject: `Pre-ETS test rosters — ${monthLabel} (${rosterCount} PDFs)`,
    text: [
      "Pre-ETS worksheet testing override — roster PDF export",
      "",
      `Service month: ${monthLabel}`,
      `Rosters attached: ${rosterCount} (ZIP)`,
      skippedEmpty > 0
        ? `Skipped ${skippedEmpty} authorization(s) with no eligible students (missing PID or NOT APPROVED).`
        : "",
      "",
      "PDFs use the same Google Doc / fallback template as production roster print.",
      "Authorization numbers and other missing fields are left blank where not yet entered.",
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: attachmentName,
        content: Buffer.from(zipBytes).toString("base64"),
        encoding: "base64",
        mimeType: "application/zip",
      },
    ],
  });

  return {
    ok: true,
    emailedTo: to,
    rosterCount,
    skippedEmpty,
    serviceMonth,
    attachmentName,
  };
}
