import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { insertInvoicePacketEvent } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/invoice-packets";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_invoice_packets")
      .select(
        "id, service_month, status, provider_invoice_number, total_hours, total_amount_cents, drive_file_name, submitted_at, paid_at, pre_ets_authorizations(auth_number, auth_type, service_code, pre_ets_schools(name))"
      )
      .order("service_month", { ascending: false })
      .limit(100);

    if (month) {
      const serviceMonth = month.length === 7 ? `${month}-01` : month;
      query = query.eq("service_month", serviceMonth);
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

    if (!authorization || authorization.auth_type !== "group") {
      return NextResponse.json({ error: "Group authorization required" }, { status: 400 });
    }

    const { data: sessions } = await admin
      .from("pre_ets_sessions")
      .select("id")
      .eq("authorization_id", body.authorizationId)
      .eq("status", "completed");

    const { data: attendance } = await admin
      .from("pre_ets_session_attendance")
      .select("id, present, signed_on_roster, session_id")
      .in(
        "session_id",
        (sessions ?? []).map((s) => s.id as string)
      );

    const billableUnits = (attendance ?? []).filter(
      (a) => a.present && a.signed_on_roster
    ).length;

    const settings = auth.settings;
    const totalAmountCents = billableUnits * settings.default_rate_cents;

    const { data: packet, error } = await admin
      .from("pre_ets_invoice_packets")
      .upsert(
        {
          authorization_id: body.authorizationId,
          service_month: authorization.service_month,
          total_hours: billableUnits,
          total_amount_cents: totalAmountCents,
          status: "draft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "authorization_id,service_month" }
      )
      .select("id")
      .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    await insertInvoicePacketEvent(admin, {
      packetId: packet.id as string,
      actorUserId: auth.userId,
      eventKind: "created",
      toStatus: "draft",
      metadata: { billableUnits, totalAmountCents },
    });

    return NextResponse.json({ packetId: packet.id, billableUnits, totalAmountCents });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
