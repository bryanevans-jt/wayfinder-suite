import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { canAssignClientEs } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

/**
 * Hospitality (and admin/supervisor) can set or clear the Employment Specialist
 * on a client via es_client_assignments.
 */
export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session || !canAssignClientEs(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await assertNotPreviewMutation();
  } catch {
    return NextResponse.json({ error: "Exit preview to make changes." }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    esUserId?: string | null;
  };
  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const esUserId = body.esUserId === undefined ? undefined : (body.esUserId ?? "").trim() || null;

  const admin = createServiceRoleClient();

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (esUserId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", esUserId)
      .maybeSingle();
    if (!profile?.is_active) {
      return NextResponse.json(
        { error: "That Employment Specialist account was not found." },
        { status: 400 }
      );
    }
    const role = String(profile.role ?? "").toLowerCase();
    if (role !== "es" && role !== "supervisor") {
      return NextResponse.json(
        { error: "Caseload can only be assigned to an Employment Specialist or supervisor." },
        { status: 400 }
      );
    }
  }

  const { data: currentLinks } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", clientId);
  const currentEsId = (currentLinks?.[0]?.es_user_id as string | undefined) ?? null;

  if (esUserId === undefined || esUserId === currentEsId) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: clearErr } = await admin
    .from("es_client_assignments")
    .delete()
    .eq("client_id", clientId);
  if (clearErr) {
    return NextResponse.json({ error: clearErr.message }, { status: 500 });
  }

  if (esUserId) {
    const { error: assignErr } = await admin.from("es_client_assignments").insert({
      es_user_id: esUserId,
      client_id: clientId,
    });
    if (assignErr) {
      return NextResponse.json({ error: assignErr.message }, { status: 500 });
    }
  }

  // Keep message routing in sync when a thread already exists.
  await admin
    .from("client_message_threads")
    .update({ current_es_user_id: esUserId })
    .eq("client_id", clientId);

  return NextResponse.json({ ok: true });
}
