import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  buildReferralEmailBodies,
  createPublicReferral,
  notifyHrOfNewReferral,
  type PublicReferralPayload,
  type ReferralState,
} from "@wayfinder/supabase/referral-intake";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorizePublicReferral(request: Request): boolean {
  const secret = process.env.REFERRAL_FORM_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-referral-secret");
  const auth = request.headers.get("authorization");
  return header === secret || auth === `Bearer ${secret}`;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = (process.env.REFERRAL_CORS_ORIGINS ?? "https://thejoshuatree.org,https://www.thejoshuatree.org")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allow =
    origin && allowed.some((a) => origin === a || origin.endsWith(a.replace(/^https?:\/\//, "")))
      ? origin
      : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-referral-secret",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function handlePublicReferralPost(request: Request, state: ReferralState) {
  const headers = corsHeaders(request.headers.get("origin"));
  if (!authorizePublicReferral(request)) {
    return NextResponse.json({ result: "error", message: "Unauthorized" }, { status: 401, headers });
  }

  let payload: PublicReferralPayload;
  try {
    payload = (await request.json()) as PublicReferralPayload;
  } catch {
    return NextResponse.json({ result: "error", message: "Invalid JSON" }, { status: 400, headers });
  }

  try {
    const admin = createServiceRoleClient();
    const created = await createPublicReferral(admin, state, payload);
    if ("error" in created) {
      return NextResponse.json(
        { result: "error", message: created.error },
        { status: created.status ?? 400, headers }
      );
    }

    const authFileName = payload.authorizations?.name || "None";
    const otherFileName = payload.otherDocs?.name || "None";
    const bodies = await buildReferralEmailBodies(admin, {
      state,
      payload,
      serviceName: created.serviceName,
      authFileName,
      otherFileName,
    });

    try {
      const { data: cfg } = await admin
        .from("admin_config")
        .select("referral_notify_email, referral_training_phase")
        .limit(1)
        .maybeSingle();
      const notifyEmail =
        (process.env.REFERRAL_NOTIFY_EMAIL ?? "").trim() ||
        (cfg?.referral_notify_email as string | null)?.trim() ||
        "ryan.herrington@thejoshuatree.org";

      const auth = await getGoogleAuth();
      const attachments: { filename: string; content: string; encoding: "base64"; mimeType?: string }[] =
        [];
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

      await sendEmail(auth, {
        to: notifyEmail,
        subject: bodies.adminSubject,
        text: bodies.adminBody,
        attachments: attachments.length ? attachments : undefined,
      });

      // Training phase: also email admins if configured via comma list
      if (cfg?.referral_training_phase !== false) {
        const extra = (process.env.REFERRAL_TRAINING_CC ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        for (const to of extra) {
          await sendEmail(auth, {
            to,
            subject: `[Training] ${bodies.adminSubject}`,
            text: bodies.adminBody,
          });
        }
      }

      if (payload.counselorEmail) {
        await sendEmail(auth, {
          to: payload.counselorEmail.trim(),
          subject: bodies.counselorSubject,
          text: bodies.counselorBody,
        });
      }
    } catch (mailErr) {
      console.error("referral email failed:", mailErr);
      // Referral is saved; still return success so counselor isn't stuck. HR sees in-app.
    }

    await notifyHrOfNewReferral(admin, {
      clientId: created.clientId,
      clientName: payload.clientName,
      state,
    });

    return NextResponse.json(
      {
        result: "success",
        clientId: created.clientId,
        possibleDuplicates: created.duplicates.length,
      },
      { headers }
    );
  } catch (err) {
    console.error("public referral failed:", err);
    return NextResponse.json(
      { result: "error", message: err instanceof Error ? err.message : "Server error" },
      { status: 500, headers }
    );
  }
}
