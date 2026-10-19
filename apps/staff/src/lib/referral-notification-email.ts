import type { SupabaseClient } from "@supabase/supabase-js";
import { logSystemError } from "@wayfinder/supabase/error-log";
import {
  buildReferralEmailBodies,
  type PublicReferralPayload,
  type ReferralState,
} from "@wayfinder/supabase/referral-intake";
import { shouldSendReferralCounselorConfirmationEmail } from "@/lib/referral-email-policy";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import {
  loadReferralExportRows,
  referralAddressLine,
  type ReferralExportRow,
} from "@/lib/referral-export-data";

type ReferralMailAttachment = {
  filename: string;
  content: string;
  encoding: "base64";
  mimeType?: string;
};

function attachmentsFromPayload(payload: PublicReferralPayload): ReferralMailAttachment[] {
  const attachments: ReferralMailAttachment[] = [];
  if (payload.authorizations?.data) {
    attachments.push({
      filename: payload.authorizations.name || "authorizations.bin",
      content: payload.authorizations.data,
      encoding: "base64",
      mimeType: payload.authorizations.mimeType,
    });
  }
  if (payload.otherDocs?.data) {
    attachments.push({
      filename: payload.otherDocs.name || "other-docs.bin",
      content: payload.otherDocs.data,
      encoding: "base64",
      mimeType: payload.otherDocs.mimeType,
    });
  }
  return attachments;
}

async function logReferralMailFailure(
  admin: SupabaseClient,
  route: string,
  recipientKind: string,
  to: string,
  err: unknown,
  clientId?: string
): Promise<void> {
  console.error(`referral email failed (${recipientKind} → ${to}):`, err);
  await logSystemError(
    admin,
    {
      app: "staff",
      route,
      statusCode: 502,
      metadata: {
        kind: "referral_email",
        recipientKind,
        to,
        clientId: clientId ?? null,
      },
    },
    err
  ).catch(() => undefined);
}

async function resolveReferralNotifyEmail(admin: SupabaseClient): Promise<string> {
  const { data: cfg } = await admin
    .from("admin_config")
    .select("referral_notify_email, referral_training_phase")
    .limit(1)
    .maybeSingle();
  return (
    (process.env.REFERRAL_NOTIFY_EMAIL ?? "").trim() ||
    (cfg?.referral_notify_email as string | null)?.trim() ||
    "devon.poole@thejoshuatree.org"
  );
}

async function isReferralTrainingPhase(admin: SupabaseClient): Promise<boolean> {
  const { data: cfg } = await admin
    .from("admin_config")
    .select("referral_training_phase")
    .limit(1)
    .maybeSingle();
  return cfg?.referral_training_phase !== false;
}

export type DeliverReferralEmailsOpts = {
  admin: SupabaseClient;
  state: ReferralState;
  payload: PublicReferralPayload;
  serviceName: string;
  authFileName: string;
  otherFileName: string;
  clientId?: string;
  /** Which sends to run (default: all). */
  recipients?: ("admin" | "counselor" | "training")[];
  /** Staff-initiated resend bypasses REFERRAL_SEND_COUNSELOR_CONFIRMATION. */
  forceCounselorConfirmation?: boolean;
  route?: string;
};

/** Sends referral notification mail; each recipient is isolated so one failure does not block others. */
export async function deliverReferralEmails(opts: DeliverReferralEmailsOpts): Promise<{
  admin: boolean;
  counselor: boolean;
  training: boolean;
}> {
  const route = opts.route ?? "/api/public/referrals";
  const want = new Set(opts.recipients ?? ["admin", "counselor", "training"]);
  const result = { admin: false, counselor: false, training: false };

  const bodies = await buildReferralEmailBodies(opts.admin, {
    state: opts.state,
    payload: opts.payload,
    serviceName: opts.serviceName,
    authFileName: opts.authFileName,
    otherFileName: opts.otherFileName,
  });

  let auth: Awaited<ReturnType<typeof getGoogleAuth>>;
  try {
    auth = await getGoogleAuth();
  } catch (err) {
    if (want.has("admin")) {
      const notifyEmail = await resolveReferralNotifyEmail(opts.admin);
      await logReferralMailFailure(opts.admin, route, "admin", notifyEmail, err, opts.clientId);
    }
    if (want.has("counselor") && opts.payload.counselorEmail?.trim()) {
      await logReferralMailFailure(
        opts.admin,
        route,
        "counselor",
        opts.payload.counselorEmail.trim(),
        err,
        opts.clientId
      );
    }
    return result;
  }

  const attachments = attachmentsFromPayload(opts.payload);

  if (want.has("admin")) {
    const notifyEmail = await resolveReferralNotifyEmail(opts.admin);
    try {
      await sendEmail(auth, {
        to: notifyEmail,
        subject: bodies.adminSubject,
        text: bodies.adminBody,
        attachments: attachments.length ? attachments : undefined,
      });
      result.admin = true;
    } catch (err) {
      await logReferralMailFailure(opts.admin, route, "admin", notifyEmail, err, opts.clientId);
    }
  }

  const counselorTo = (opts.payload.counselorEmail ?? "").trim();
  const sendCounselor =
    want.has("counselor") &&
    counselorTo &&
    (opts.forceCounselorConfirmation || shouldSendReferralCounselorConfirmationEmail());
  if (sendCounselor) {
    try {
      await sendEmail(auth, {
        to: counselorTo,
        subject: bodies.counselorSubject,
        text: bodies.counselorBody,
      });
      result.counselor = true;
    } catch (err) {
      await logReferralMailFailure(opts.admin, route, "counselor", counselorTo, err, opts.clientId);
    }
  }

  if (want.has("training") && (await isReferralTrainingPhase(opts.admin))) {
    const extra = (process.env.REFERRAL_TRAINING_CC ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const to of extra) {
      try {
        await sendEmail(auth, {
          to,
          subject: `[Training] ${bodies.adminSubject}`,
          text: bodies.adminBody,
        });
        result.training = true;
      } catch (err) {
        await logReferralMailFailure(opts.admin, route, "training", to, err, opts.clientId);
      }
    }
  }

  return result;
}

function authFileNameFromRow(row: ReferralExportRow): string {
  const doc = row.documents.find((d) => d.kind === "authorizations");
  return doc?.file_name || "None";
}

function otherFileNameFromRow(row: ReferralExportRow): string {
  const doc = row.documents.find((d) => d.kind === "other");
  return doc?.file_name || "None";
}

export function publicReferralPayloadFromExportRow(row: ReferralExportRow): PublicReferralPayload | null {
  const counselorEmail = (row.counselorEmail ?? "").trim();
  const counselorName = (row.counselorName ?? "").trim();
  if (!counselorEmail || !counselorName) return null;

  return {
    counselorName,
    counselorEmail,
    counselorPhone: "N/A",
    service: row.serviceName ?? "",
    clientName: row.full_name ?? "Client",
    dob: row.date_of_birth ?? undefined,
    clientPhone: row.primary_phone ?? undefined,
    clientPhone2: row.secondary_phone ?? undefined,
    clientAddress: referralAddressLine(row) || undefined,
    clientEmail: row.contact_email ?? undefined,
    gender: row.gender ?? undefined,
    ethnicity: row.ethnicity ?? undefined,
    disability: row.disability_history ?? undefined,
    workGoal: row.employment_goal_primary ?? undefined,
    meetingOption: row.meeting_preference ?? undefined,
    counselorAvailability: row.counselor_availability ?? undefined,
  };
}

export async function resendCounselorReferralConfirmation(
  admin: SupabaseClient,
  clientId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const rows = await loadReferralExportRows(admin, [clientId]);
  const row = rows[0];
  if (!row) {
    return { error: "Referral not found", status: 404 };
  }
  const state = row.referral_state === "TN" ? "TN" : "GA";
  const payload = publicReferralPayloadFromExportRow(row);
  if (!payload) {
    return { error: "Counselor name and email are required on this referral.", status: 400 };
  }
  if (!row.serviceName) {
    return { error: "Service is missing on this referral.", status: 400 };
  }
  const serviceName = row.serviceName;

  const sent = await deliverReferralEmails({
    admin,
    state,
    payload,
    serviceName,
    authFileName: authFileNameFromRow(row),
    otherFileName: otherFileNameFromRow(row),
    clientId,
    recipients: ["counselor"],
    forceCounselorConfirmation: true,
    route: "/api/referrals/counselor-confirmation/resend",
  });

  if (!sent.counselor) {
    return {
      error: "Could not send counselor confirmation. Check System Error Logs for details.",
      status: 502,
    };
  }
  return { ok: true };
}
