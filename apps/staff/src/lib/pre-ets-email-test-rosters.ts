import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { buildPreEtsTestRostersZip } from "@/lib/pre-ets-build-test-rosters-zip";
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

  const built = await buildPreEtsTestRostersZip(admin, {
    serviceMonth,
    combineAllParts: true,
  });

  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const monthLabel = serviceMonth.slice(0, 7);

  const gauth = await getGoogleAuth();
  await sendEmail(gauth, {
    to,
    subject: `Pre-ETS test rosters — ${monthLabel} (${built.rosterCount} PDFs)`,
    text: [
      "Pre-ETS worksheet testing override — roster PDF export",
      "",
      `Service month: ${monthLabel}`,
      `Rosters attached: ${built.rosterCount} (ZIP)`,
      built.skippedEmpty > 0
        ? `Skipped ${built.skippedEmpty} authorization(s) with no eligible students (missing PID or NOT APPROVED).`
        : "",
      "",
      "PDFs use the same Google Doc / fallback template as production roster print.",
      "Authorization numbers and other missing fields are left blank where not yet entered.",
      built.totalRosters > 8
        ? "Tip: for large months, prefer Download ZIP (part 1, 2, …) in the app instead of email."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: built.attachmentName,
        content: Buffer.from(built.zipBytes).toString("base64"),
        encoding: "base64",
        mimeType: "application/zip",
      },
    ],
  });

  return {
    ok: true,
    emailedTo: to,
    rosterCount: built.rosterCount,
    skippedEmpty: built.skippedEmpty,
    serviceMonth,
    attachmentName: built.attachmentName,
  };
}
