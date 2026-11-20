import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsAuthorizationReleasedToField } from "@wayfinder/supabase/pre-ets-release";
import { notifyPreEtsRosterUpdated } from "@wayfinder/supabase/pre-ets-roster-released-notify";
import {
  loadPreEtsSettings,
  resolvePreEtsServiceLabel,
  sanitizePreEtsServiceCodeText,
} from "@wayfinder/supabase/pre-ets-settings";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

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
      .select(
        "id, service_code, auth_number, auth_type, field_released_at, service_month, school_id, pre_ets_schools(name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (findErr || !row) {
      return NextResponse.json({ error: "Authorization not found." }, { status: 404 });
    }

    const previousCode = sanitizePreEtsServiceCodeText(
      (row.service_code as string) || "UNKNOWN"
    );

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

    if (
      previousCode !== serviceCode &&
      isPreEtsAuthorizationReleasedToField({
        auth_number: row.auth_number as string | null,
        auth_type: row.auth_type as string,
        field_released_at: row.field_released_at as string | null,
      })
    ) {
      const school = relationOne(
        row.pre_ets_schools as { name: string } | { name: string }[] | null
      );
      await notifyPreEtsRosterUpdated(admin, {
        authorizationId: id,
        schoolId: row.school_id as string,
        schoolLabel: school?.name ?? "School",
        serviceMonth: String(row.service_month ?? ""),
        changeSummary: `Service code changed to ${serviceCode}. Open Pre-ETS to review.`,
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
