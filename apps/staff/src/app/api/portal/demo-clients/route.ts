import { assertPortalMutation, assertPortalSession, jsonPortalError, PortalAuthError } from "@/lib/portal-auth";
import {
  clearDemoTrainingMetrics,
  createDemoClient,
  listDemoClients,
} from "@/lib/demo-clients";
import { buildClientPreviewHandoffUrl } from "@wayfinder/supabase/preview-handoff";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireDemoSuperAdmin() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.actorRole) || session.isPreviewing) {
    throw new PortalAuthError("Super admin access required.", 403);
  }
  return session;
}

export async function GET() {
  try {
    await requireDemoSuperAdmin();
    const { admin } = await assertPortalSession("super_admin");

    const rows = await listDemoClients(admin);
    return NextResponse.json({ demoClients: rows });
  } catch (e) {
    return jsonPortalError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const appSession = await requireDemoSuperAdmin();
    await assertPortalMutation("super_admin");
    const { admin } = await assertPortalSession("super_admin");

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      serviceId?: string;
      officeId?: string;
      counselorId?: string;
      esUserId?: string;
    };

    const name = body.name?.trim();
    const esUserId = body.esUserId?.trim();
    const serviceId = body.serviceId?.trim();
    const officeId = body.officeId?.trim();
    const counselorId = body.counselorId?.trim();

    if (!name || !esUserId || !serviceId || !officeId || !counselorId) {
      throw new PortalAuthError(
        "Name, Employment Specialist, service, office, and counselor are required.",
        400
      );
    }

    const stamp = Date.now().toString(36);
    const email =
      body.email?.trim().toLowerCase() ||
      `demo.${stamp}.${esUserId.slice(0, 8)}@demo.wayfinder.local`;

    const result = await createDemoClient(admin, {
      name,
      email,
      serviceId,
      officeId,
      counselorId,
      esUserId,
      createdBy: appSession.actorUserId,
    });

    if ("error" in result) {
      throw new PortalAuthError(result.error, 400);
    }

    const demoClients = await listDemoClients(admin);
    return NextResponse.json({ ok: true, clientId: result.clientId, demoClients });
  } catch (e) {
    return jsonPortalError(e);
  }
}

/** POST with { clientId } — open client app as the demo client's login. */
export async function PATCH(request: NextRequest) {
  try {
    const appSession = await requireDemoSuperAdmin();
    const { admin } = await assertPortalSession("super_admin");

    const body = (await request.json()) as { clientId?: string };
    const clientId = body.clientId?.trim();
    if (!clientId) {
      throw new PortalAuthError("clientId is required.", 400);
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, user_id, profile_id, is_demo")
      .eq("id", clientId)
      .maybeSingle();

    if (!client?.is_demo) {
      throw new PortalAuthError("Demo client not found.", 404);
    }

    const targetUserId = (client.user_id ?? client.profile_id) as string | null;
    if (!targetUserId) {
      throw new PortalAuthError("Demo client has no login linked yet.", 400);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", targetUserId)
      .maybeSingle();

    const redirectUrl = buildClientPreviewHandoffUrl({
      targetUserId,
      actorUserId: appSession.actorUserId,
      targetRole: (profile?.role as string) ?? "client",
      targetName: (profile?.full_name as string | null) ?? null,
    });

    return NextResponse.json({ redirectUrl });
  } catch (e) {
    return jsonPortalError(e);
  }
}
