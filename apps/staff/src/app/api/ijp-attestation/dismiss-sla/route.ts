import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { logIjpBillingAudit } from "@/lib/ijp-billing-audit";
import { canDismissIjpAttestationSla } from "@/lib/ijp-sla-dismiss-access";
import { loadStaffNameById } from "@/lib/staff-names";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, full_name, display_name")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!profile?.is_active) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  const body = (await request.json()) as {
    clientId?: string;
    serviceMonth?: string;
    reason?: string;
  };
  const clientId = body.clientId?.trim();
  const serviceMonth = body.serviceMonth?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json({ error: "clientId and serviceMonth are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const allowed = await canDismissIjpAttestationSla(admin, {
    role,
    userId: session.effectiveUserId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const { error: dismissError } = await admin.from("ijp_attestation_sla_dismissals").upsert(
    {
      client_id: clientId,
      service_month: serviceMonth,
      dismissed_by: session.effectiveUserId,
      reason: body.reason?.trim() || null,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "client_id,service_month" }
  );
  if (dismissError) {
    return NextResponse.json({ error: dismissError.message }, { status: 400 });
  }

  await admin
    .from("report_dashboard_alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("wayfinder_client_id", clientId)
    .eq("reporting_month", serviceMonth)
    .eq("report_type_slug", "ijp_attestation")
    .is("resolved_at", null);

  const names = await loadStaffNameById(admin, [session.effectiveUserId], "Staff");
  await logIjpBillingAudit(admin, {
    action: "dismiss_ijp_attestation_sla",
    clientId,
    serviceMonth,
    dismissedBy: session.effectiveUserId,
    dismissedByName: names.get(session.effectiveUserId) ?? null,
    reason: body.reason?.trim() || null,
  });

  return NextResponse.json({ ok: true });
}
