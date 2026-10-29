import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canManageKraBillableSettings,
  loadKraBillableSettings,
  type KraBillableRule,
} from "@wayfinder/supabase/kra-billable-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  if (!session || !canManageKraBillableSettings(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const admin = createServiceRoleClient();
    const settings = await loadKraBillableSettings(admin);
    const { data: services } = await admin
      .from("services")
      .select("id, name, state")
      .order("name");
    return NextResponse.json({ settings, services: services ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", "api/admin/kra-billable-settings", err, {
      userId: session.effectiveUserId,
    });
  }
}

export async function PATCH(request: Request) {
  const route = "api/admin/kra-billable-settings";
  const session = await getAppSession();
  if (!session || !canManageKraBillableSettings(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      count_system_allowance_toward_kra?: boolean;
      successor_inherits_client_month_hours?: boolean;
      rules?: KraBillableRule[];
    };
    const admin = createServiceRoleClient();
    const current = await loadKraBillableSettings(admin);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: session.effectiveUserId,
    };
    if (body.count_system_allowance_toward_kra !== undefined) {
      patch.count_system_allowance_toward_kra = body.count_system_allowance_toward_kra === true;
    }
    if (body.successor_inherits_client_month_hours !== undefined) {
      patch.successor_inherits_client_month_hours =
        body.successor_inherits_client_month_hours === true;
    }
    if (body.rules !== undefined) {
      patch.rules = body.rules.map((r) => ({
        service_ids: (r.service_ids ?? []).map(String),
        hours_per_client_per_month: Number(r.hours_per_client_per_month) || 10,
      }));
    }

    const { data, error } = await admin
      .from("org_kra_billable_settings")
      .update(patch)
      .eq("id", current.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ settings: data });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, { userId: session.effectiveUserId });
  }
}
