import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { upsertPreEtsDraftInvoicePacket } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "@/lib/pre-ets-service-month";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/invoice-packets";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  let serviceMonthFilter: string | null = null;
  if (!isPreEtsServiceMonthFilterOmitted(month)) {
    const parsed = parsePreEtsServiceMonthFilter(month);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    serviceMonthFilter = parsed.serviceMonth;
  }

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_invoice_packets")
      .select(
        "id, service_month, status, provider_invoice_number, total_hours, total_amount_cents, drive_file_name, submitted_at, paid_at, pre_ets_authorizations(auth_number, auth_type, service_code, pre_ets_schools(name))"
      )
      .order("service_month", { ascending: false })
      .limit(100);

    if (serviceMonthFilter) {
      query = query.eq("service_month", serviceMonthFilter);
    }

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ packets: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/pre-ets/invoice-packets";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as { authorizationId: string };
    if (!body.authorizationId) {
      return NextResponse.json({ error: "authorizationId required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: authorization } = await admin
      .from("pre_ets_authorizations")
      .select("id, service_month, auth_type")
      .eq("id", body.authorizationId)
      .maybeSingle();

    if (!authorization || !["group", "individual"].includes(authorization.auth_type as string)) {
      return NextResponse.json(
        { error: "Group or individual authorization required" },
        { status: 400 }
      );
    }

    const result = await upsertPreEtsDraftInvoicePacket(admin, {
      authorizationId: body.authorizationId,
      serviceMonth: authorization.service_month as string,
      authType: authorization.auth_type as string,
      defaultRateCents: auth.settings.default_rate_cents,
      actorUserId: auth.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      );
    }

    return NextResponse.json({
      packetId: result.packetId,
      billableUnits: result.billableUnits,
      totalAmountCents: result.totalAmountCents,
      created: result.created,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
