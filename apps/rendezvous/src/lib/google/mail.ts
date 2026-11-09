import { google } from "googleapis";
import { googleServiceAccountCredentials } from "./credentials";

export function emailsEnabled(): boolean {
  return process.env.RENDEZVOUS_EMAILS_ENABLED === "true";
}

export function schedulingFromAddress(): string {
  return (
    process.env.RENDEZVOUS_FROM_EMAIL?.trim() ||
    process.env.SCHEDULING_FROM_EMAIL?.trim() ||
    "scheduling@thejoshuatree.org"
  );
}

/** Gmail send via the same Workspace service account (domain-wide delegation). */
function getGmailAuth() {
  const { clientEmail, privateKey } = googleServiceAccountCredentials();
  const subject = schedulingFromAddress();
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject,
  });
}

function foldBase64(value: string): string {
  return value.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
}

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  /** When true, send even if RENDEZVOUS_EMAILS_ENABLED is false (explicit test path). */
  forceTestSend?: boolean;
};

/**
 * Send mail from scheduling@. No-ops (returns skipped) unless emails are enabled
 * or forceTestSend is set — keeps development quiet by default.
 */
export async function sendSchedulingEmail(
  options: SendMailOptions
): Promise<{ sent: boolean; skipped?: string }> {
  if (!emailsEnabled() && !options.forceTestSend) {
    return { sent: false, skipped: "RENDEZVOUS_EMAILS_ENABLED is not true" };
  }

  const auth = getGmailAuth();
  const gmail = google.gmail({ version: "v1", auth });
  const from = schedulingFromAddress();
  const mail = [
    `To: ${options.to}`,
    `From: Joshua Tree Scheduling <${from}>`,
    `Subject: =?utf-8?B?${Buffer.from(options.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    options.text,
  ].join("\r\n");

  const rawMessage = Buffer.from(mail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawMessage },
  });

  return { sent: true };
}

export function buildBookingEmailBodies(opts: {
  staffName: string;
  counselorName: string;
  whenLabel: string;
  formatLabel: string;
  locationOrMeet: string;
  cancelUrl: string;
  rescheduleUrl: string;
  reason?: string | null;
}) {
  const reasonLine = opts.reason?.trim()
    ? `\nReason (optional note): ${opts.reason.trim()}\n`
    : "";

  const counselorText = [
    `Hi ${opts.counselorName},`,
    "",
    `Your meeting with ${opts.staffName} is confirmed.`,
    "",
    `When: ${opts.whenLabel}`,
    `Format: ${opts.formatLabel}`,
    `${opts.formatLabel === "In person" ? "Location" : "Join"}: ${opts.locationOrMeet}`,
    reasonLine,
    "Need to change it?",
    `Cancel: ${opts.cancelUrl}`,
    `Reschedule: ${opts.rescheduleUrl}`,
    "",
    "Please do not include sensitive client information in scheduling notes.",
    "",
    "— Joshua Tree Service Group Scheduling",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const staffText = [
    `Hi ${opts.staffName},`,
    "",
    `${opts.counselorName} booked a meeting with you.`,
    "",
    `When: ${opts.whenLabel}`,
    `Format: ${opts.formatLabel}`,
    `${opts.formatLabel === "In person" ? "Location" : "Join"}: ${opts.locationOrMeet}`,
    reasonLine,
    "Open Rendezvous to see your team calendar.",
    "",
    "— Joshua Tree Service Group Scheduling",
  ].join("\n");

  return { counselorText, staffText };
}

/** Exported for tests / diagnostics — not used for content folding currently. */
export { foldBase64 };
