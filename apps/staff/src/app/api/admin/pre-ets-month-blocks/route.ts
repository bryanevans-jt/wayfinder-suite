import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  blockPreEtsServiceMonth,
  unblockPreEtsServiceMonth,
} from "@wayfinder/supabase/pre-ets-field-release";
import { nextPreEtsServiceMonthFromDate } from "@wayfinder/supabase/pre-ets-release";
import { parsePreEtsServiceMonthFilter } from "@wayfinder/supabase/pre-ets-service-month";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/admin/pre-ets-month-blocks";
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_service_month_blocks")
      .select("service_month, blocked_at, reason, unblocked_at")
      .order("service_month", { ascending: false })
      .limit(24);
    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }
    const active = (data ?? []).filter((row) => row.unblocked_at == null);
    return NextResponse.json({
      blocks: data ?? [],
      activeServiceMonths: active.map((row) => String(row.service_month).slice(0, 10)),
      suggestedServiceMonth: nextPreEtsServiceMonthFromDate(),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}

export async function POST(request: Request) {
  const route = "api/admin/pre-ets-month-blocks";
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const body = (await request.json()) as {
      serviceMonth?: string;
      action?: "block" | "unblock";
      reason?: string | null;
    };
    const parsed = parsePreEtsServiceMonthFilter(body.serviceMonth);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const action = body.action === "unblock" ? "unblock" : "block";
    const admin = createServiceRoleClient();
    if (action === "block") {
      await blockPreEtsServiceMonth(admin, {
        serviceMonth: parsed.serviceMonth,
        actorUserId: session.effectiveUserId,
        reason: body.reason,
      });
    } else {
      await unblockPreEtsServiceMonth(admin, {
        serviceMonth: parsed.serviceMonth,
        actorUserId: session.effectiveUserId,
      });
    }
    return NextResponse.json({ ok: true, serviceMonth: parsed.serviceMonth, action });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
