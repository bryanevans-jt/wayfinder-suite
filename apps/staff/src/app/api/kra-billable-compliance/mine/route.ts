import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadKraBillableComplianceRollup } from "@wayfinder/supabase/kra-billable-compliance";
import { DEFAULT_KRA_HOURS_PER_CLIENT } from "@wayfinder/supabase/kra-billable-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isFieldSpecialistRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";
import { currentMonthKey } from "@/lib/es-time-data";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";

export const dynamic = "force-dynamic";

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Field specialist (ES/TS) KRA expectation card — returns only the caller's own
 * staff row from the same rollup used by the admin Billable Hours KRA panel.
 */
export async function GET(request: Request) {
  const route = "api/kra-billable-compliance/mine";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !isFieldSpecialistRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month")?.trim() ?? "";
  const monthKey = MONTH_KEY_RE.test(monthParam) ? monthParam : currentMonthKey();
  const staffUserId = session.effectiveUserId;

  try {
    const admin = createServiceRoleClient();
    const nameByStaffId = await loadStaffNameById(admin, [staffUserId], "Team member");

    const { data: links } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", staffUserId);
    const clientIds = [...new Set((links ?? []).map((l) => l.client_id as string))];
    const nameByClientId = await loadClientDisplayNameById(admin, clientIds);

    const rollup = await loadKraBillableComplianceRollup(
      admin,
      monthKey,
      nameByStaffId,
      nameByClientId
    );

    const mine =
      rollup.rows.find((r) => r.staffUserId === staffUserId) ??
      ({
        staffUserId,
        staffName: nameByStaffId.get(staffUserId) ?? "Team member",
        inScopeClientCount: 0,
        metCount: 0,
        missedCount: 0,
        complianceLabel: "0 / 0",
        averageBillableHoursPerClient: "0.0",
        clients: [],
      } as const);

    const thresholdHours =
      mine.clients[0]?.thresholdHours ?? DEFAULT_KRA_HOURS_PER_CLIENT;

    return NextResponse.json({
      monthKey: rollup.monthKey,
      monthLabel: rollup.monthLabel,
      frozen: rollup.frozen,
      closedAt: rollup.closedAt,
      settings: rollup.settings,
      expectedHoursPerClient: thresholdHours,
      row: mine,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}
