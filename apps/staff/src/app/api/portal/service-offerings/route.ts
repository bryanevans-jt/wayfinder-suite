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
    .select("customized_supported_employment_enabled")
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    customized_supported_employment_enabled:
      data?.customized_supported_employment_enabled === true,
  });
}

export async function PATCH(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    customized_supported_employment_enabled?: boolean;
  };

  if (typeof body.customized_supported_employment_enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("admin_config").select("id").limit(1).maybeSingle();

  const patch: Record<string, unknown> = {
    customized_supported_employment_enabled:
      body.customized_supported_employment_enabled,
    updated_at: new Date().toISOString(),
    updated_by: session.effectiveUserId,
  };

  if (existing?.id) {
    const { error } = await admin.from("admin_config").update(patch).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("admin_config").insert(patch);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
