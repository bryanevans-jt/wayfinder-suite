import {
  jsonStaffPtoError,
  requireStaffPtoSession,
  staffPtoOk,
} from "@/lib/staff-pto-auth";
import { loadOrgPtoSettings, loadPtoBalanceForUser } from "@/lib/staff-pto-data";
import { NextRequest } from "next/server";

export async function GET() {
  const route = "api/staff-pto/settings";
  try {
    const { admin, userId, caps } = await requireStaffPtoSession(false);
    const [settings, balance] = await Promise.all([
      loadOrgPtoSettings(admin),
      loadPtoBalanceForUser(admin, userId),
    ]);
    return staffPtoOk({
      settings,
      balance,
      capabilities: {
        canApprove: caps.canApprove,
        canManageSettings: caps.canManageSettings,
        canViewAll: caps.canViewAll,
        canViewDesignatedEs: caps.canViewDesignatedEs,
      },
    });
  } catch (error) {
    return jsonStaffPtoError(error, route);
  }
}

export async function PATCH(request: NextRequest) {
  const route = "api/staff-pto/settings";
  try {
    const { admin, userId, actor, caps } = await requireStaffPtoSession(true);
    if (!caps.canManageSettings) {
      return staffPtoOk({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as {
      period_start_date?: string;
      annual_pto_days?: number | null;
    };

    const existing = await loadOrgPtoSettings(admin);
    const periodStart =
      typeof body.period_start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.period_start_date)
        ? body.period_start_date
        : existing.period_start_date;

    let annualDays: number | null = existing.annual_pto_days;
    if (body.annual_pto_days === null) {
      annualDays = null;
    } else if (typeof body.annual_pto_days === "number") {
      if (!Number.isFinite(body.annual_pto_days) || body.annual_pto_days < 0) {
        return staffPtoOk({ error: "Annual PTO days must be a non-negative number or blank." }, { status: 400 });
      }
      annualDays = body.annual_pto_days;
    } else if (body.annual_pto_days === undefined) {
      // keep existing
    } else {
      return staffPtoOk({ error: "Invalid annual_pto_days." }, { status: 400 });
    }

    const patch = {
      period_start_date: periodStart,
      annual_pto_days: annualDays,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    const { error } = await admin.from("org_pto_settings").update(patch).eq("id", existing.id);
    if (error) {
      return jsonStaffPtoError(error, route);
    }

    const [settings, balance] = await Promise.all([
      loadOrgPtoSettings(admin),
      loadPtoBalanceForUser(admin, userId),
    ]);
    return staffPtoOk({ ok: true, settings, balance, actor });
  } catch (error) {
    return jsonStaffPtoError(error, route);
  }
}
