import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("admin_config")
    .select("referral_training_phase, referral_notify_email")
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    referral_training_phase: data?.referral_training_phase !== false,
    referral_notify_email: data?.referral_notify_email ?? null,
  });
}

export async function PATCH(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    referral_training_phase?: boolean;
    referral_notify_email?: string | null;
  };

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("admin_config").select("id").limit(1).maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: session.effectiveUserId,
  };
  if (typeof body.referral_training_phase === "boolean") {
    patch.referral_training_phase = body.referral_training_phase;
  }
  if (body.referral_notify_email !== undefined) {
    patch.referral_notify_email = body.referral_notify_email?.trim() || null;
  }

  if (existing?.id) {
    const { error } = await admin.from("admin_config").update(patch).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("admin_config").insert({
      ...patch,
      referral_training_phase: body.referral_training_phase !== false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
