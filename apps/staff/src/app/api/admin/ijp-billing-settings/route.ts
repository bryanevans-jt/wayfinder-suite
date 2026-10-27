import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canManageIjpBillingSettings,
  loadIjpBillingSettings,
  type IjpBillingSettingsRow,
} from "@wayfinder/supabase/ijp-billing-settings";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { USER_FACING_AUTH_REQUIRED, USER_FACING_FORBIDDEN } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await getAppSession();
  if (!session) return null;
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.actorUserId)
    .maybeSingle();
  const role = profile?.role as string;
  if (!canManageIjpBillingSettings(role)) return null;
  return session;
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }
  const admin = createServiceRoleClient();
  const settings = await loadIjpBillingSettings(admin);
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json()) as Partial<IjpBillingSettingsRow>;
  const admin = createServiceRoleClient();
  const current = await loadIjpBillingSettings(admin);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys: (keyof IjpBillingSettingsRow)[] = [
    "module_enabled",
    "provider_name",
    "remit_address",
    "hourly_rate_cents",
    "ga_ijp_service_id",
    "template_invoice_doc_id",
    "template_attestation_doc_id",
    "drive_attestation_folder_id",
    "drive_invoice_folder_id",
    "drive_test_attestation_folder_id",
    "drive_test_invoice_folder_id",
    "drive_signature_temp_folder_id",
  ];
  for (const key of keys) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const { data, error } = await admin
    .from("ijp_billing_settings")
    .update(patch)
    .eq("id", current.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ settings: data });
}
