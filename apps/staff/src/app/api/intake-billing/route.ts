import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canAccessIntakeBilling,
  canManageIntakeBilling,
  loadReadyContactLogsForIntakeBillings,
  markDueScheduledIntakeBillings,
  updateIntakeBillingStatus,
} from "@wayfinder/supabase/intake-billing";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canAccessIntakeBilling(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  await markDueScheduledIntakeBillings(admin);

  const status = new URL(request.url).searchParams.get("status") || "ready_to_bill";
  const selectWithLog =
    "id, client_id, status, scheduled_at, ready_at, ready_reason, ready_contact_log_id, billed_at, paid_at, created_at";
  const selectLegacy =
    "id, client_id, status, scheduled_at, ready_at, ready_reason, billed_at, paid_at, created_at";

  let query = admin.from("intake_billings").select(selectWithLog).order("created_at", {
    ascending: true,
  });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  let { data: rows, error } = await query.limit(300);
  if (error && /ready_contact_log_id|schema cache/i.test(error.message)) {
    let legacyQuery = admin
      .from("intake_billings")
      .select(selectLegacy)
      .order("created_at", { ascending: true });
    if (status !== "all") {
      legacyQuery = legacyQuery.eq("status", status);
    }
    const fallback = await legacyQuery.limit(300);
    rows = fallback.data?.map((r) => ({ ...r, ready_contact_log_id: null })) ?? null;
    error = fallback.error;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((rows ?? []).map((r) => r.client_id as string))];
  const [{ data: clients }, names] = await Promise.all([
    clientIds.length
      ? admin
          .from("clients")
          .select("id, full_name, contact_email, authorization_number, referral_state")
          .in("id", clientIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            contact_email: string | null;
            authorization_number: string | null;
            referral_state: string | null;
          }>,
        }),
    loadClientDisplayNameById(admin, clientIds),
  ]);

  const byId = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));

  const billingRows = (rows ?? []).map((row) => ({
    client_id: row.client_id as string,
    ready_at: (row.ready_at as string | null) ?? null,
    ready_reason: (row.ready_reason as string | null) ?? null,
    ready_contact_log_id: (row.ready_contact_log_id as string | null) ?? null,
  }));
  const readyLogs = await loadReadyContactLogsForIntakeBillings(admin, billingRows);
  const authorIds = [
    ...new Set(
      [...readyLogs.values()]
        .map((l) => l.loggedByUserId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const authorNames = await loadStaffNameById(admin, authorIds);

  const billings = (rows ?? []).map((row) => {
    const client = byId[row.client_id as string] ?? null;
    const readyLog = readyLogs.get(row.client_id as string);
    return {
      ...row,
      client: client
        ? { ...client, full_name: names.get(client.id) ?? client.full_name }
        : null,
      ready_contact_log: readyLog
        ? {
            id: readyLog.id,
            created_at: readyLog.createdAt,
            body: readyLog.body,
            logged_by_name: readyLog.loggedByUserId
              ? (authorNames.get(readyLog.loggedByUserId) ?? "Staff")
              : null,
          }
        : null,
    };
  });

  return NextResponse.json({ billings });
}

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageIntakeBilling(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    billingId?: string;
    action?: "billed" | "paid" | "ready";
  };
  if (!body.billingId || !body.action) {
    return NextResponse.json({ error: "billingId and action required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const result = await updateIntakeBillingStatus(admin, {
    billingId: body.billingId,
    action: body.action,
    actorUserId: session.effectiveUserId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
