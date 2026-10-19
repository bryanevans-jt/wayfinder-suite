import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  createPublicReferral,
  GA_WEBSITE_REFERRAL_SERVICES,
  loadGaWebsiteReferralServices,
  notifyHrOfNewReferral,
  type PublicReferralPayload,
  type ReferralState,
} from "@wayfinder/supabase/referral-intake";
import { deliverReferralEmails } from "@/lib/referral-notification-email";
import { provisionCounselorLoginAfterReferral } from "@/lib/portal-staff-users";
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

export function corsHeaders(origin: string | null): HeadersInit {
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-referral-secret",
  };
}

export async function handlePublicReferralServicesGet(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));
  try {
    const admin = createServiceRoleClient();
    const services = await loadGaWebsiteReferralServices(admin);
    return NextResponse.json({ services }, { headers });
  } catch (err) {
    console.error("public referral services failed:", err);
    return NextResponse.json(
      { services: [...GA_WEBSITE_REFERRAL_SERVICES] },
      { headers }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export function publicReferralClosedResponse(request: Request, message: string) {
  return NextResponse.json(
    { result: "error", message },
    { status: 410, headers: corsHeaders(request.headers.get("origin")) }
  );
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

    await provisionCounselorLoginAfterReferral(admin, payload.counselorEmail.trim().toLowerCase());

    const authFileName = payload.authorizations?.name || "None";
    const otherFileName = payload.otherDocs?.name || "None";

    await deliverReferralEmails({
      admin,
      state,
      payload,
      serviceName: created.serviceName,
      authFileName,
      otherFileName,
      clientId: created.clientId,
      route: `/api/public/referrals/${state.toLowerCase()}`,
    });

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
