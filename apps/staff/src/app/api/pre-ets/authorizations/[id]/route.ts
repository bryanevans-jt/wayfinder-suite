import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  loadPreEtsSettings,
  resolvePreEtsServiceLabel,
  sanitizePreEtsServiceCodeText,
} from "@wayfinder/supabase/pre-ets-settings";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

/** Accounts / Admin / Super Admin — update GVRA service code on a roster authorization. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/authorizations/[id]";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { serviceCode?: string; serviceLabel?: string | null };
    const rawCode = body.serviceCode?.trim();
    if (!rawCode) {
      return NextResponse.json({ error: "serviceCode is required." }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const serviceCode = sanitizePreEtsServiceCodeText(rawCode);
    const serviceLabel =
      body.serviceLabel !== undefined
        ? body.serviceLabel?.trim() || null
        : resolvePreEtsServiceLabel(serviceCode, null, settings);

    const { data: row, error: findErr } = await admin
      .from("pre_ets_authorizations")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !row) {
      return NextResponse.json({ error: "Authorization not found." }, { status: 404 });
    }

    const { error } = await admin
      .from("pre_ets_authorizations")
      .update({ service_code: serviceCode, service_label: serviceLabel })
      .eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ ok: true, serviceCode, serviceLabel });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
