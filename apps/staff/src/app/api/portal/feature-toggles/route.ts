import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import {
  DEFAULT_ANNIVERSARY_TEMPLATE,
  DEFAULT_BIRTHDAY_TEMPLATE,
  loadFeatureToggles,
} from "@/lib/feature-toggles";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createServiceRoleClient();
  const toggles = await loadFeatureToggles(admin);
  return NextResponse.json({
    community_partners_enabled: toggles.communityPartnersEnabled,
    traditional_supported_employment_enabled: toggles.traditionalSupportedEmploymentEnabled,
    job_coaching_enabled: toggles.jobCoachingEnabled,
    customized_supported_employment_enabled: toggles.customizedSupportedEmploymentEnabled,
    groupme_celebrations_enabled: toggles.groupmeCelebrationsEnabled,
    celebration_birthday_template: toggles.celebrationBirthdayTemplate,
    celebration_anniversary_template: toggles.celebrationAnniversaryTemplate,
  });
}

export async function PATCH(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: session.effectiveUserId,
  };

  const boolKeys = [
    "community_partners_enabled",
    "traditional_supported_employment_enabled",
    "job_coaching_enabled",
    "customized_supported_employment_enabled",
    "groupme_celebrations_enabled",
  ] as const;

  for (const key of boolKeys) {
    if (typeof body[key] === "boolean") {
      patch[key] = body[key];
    }
  }

  if (typeof body.celebration_birthday_template === "string") {
    patch.celebration_birthday_template =
      body.celebration_birthday_template.trim() || DEFAULT_BIRTHDAY_TEMPLATE;
  }
  if (typeof body.celebration_anniversary_template === "string") {
    patch.celebration_anniversary_template =
      body.celebration_anniversary_template.trim() || DEFAULT_ANNIVERSARY_TEMPLATE;
  }

  if (Object.keys(patch).length <= 2) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("admin_config").select("id").limit(1).maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from("admin_config").update(patch).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("admin_config").insert(patch);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
