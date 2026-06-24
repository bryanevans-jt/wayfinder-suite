import {
  assertAnalyticsSession,
  esUserIdAllowed,
  officeIdAllowed,
} from "@/lib/analytics/access";
import { loadAnalyticsSummary } from "@/lib/analytics/load-metrics";
import {
  isAdminTierRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await assertAnalyticsSession();
  if ("error" in auth) {
    return auth.error;
  }

  if (!isSupervisorRole(auth.role) && !isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const officeId = url.searchParams.get("officeId");
  const esUserId = url.searchParams.get("esUserId");

  if (!officeIdAllowed(auth.scope, officeId) || !esUserIdAllowed(auth.scope, esUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const current = await loadAnalyticsSummary(auth.admin, auth.scope, {
      from,
      to,
      officeId,
      esUserId,
    });

    const fromDate = new Date(`${current.range.from}T00:00:00.000Z`);
    const toDate = new Date(`${current.range.to}T23:59:59.999Z`);
    const spanMs = toDate.getTime() - fromDate.getTime();
    const priorTo = new Date(fromDate.getTime() - 1);
    const priorFrom = new Date(priorTo.getTime() - spanMs);

    const prior = await loadAnalyticsSummary(auth.admin, auth.scope, {
      from: priorFrom.toISOString().slice(0, 10),
      to: priorTo.toISOString().slice(0, 10),
      officeId,
      esUserId,
    });

    function pctDelta(currentVal: number | null, priorVal: number | null): number | null {
      if (currentVal == null || priorVal == null || priorVal === 0) return null;
      return ((currentVal - priorVal) / priorVal) * 100;
    }

    return NextResponse.json({
      benchmark: {
        hireRateDeltaPct: pctDelta(current.hireRate, prior.hireRate),
        medianDaysToHireDelta:
          current.medianDaysToHire != null && prior.medianDaysToHire != null
            ? current.medianDaysToHire - prior.medianDaysToHire
            : null,
        current: {
          hireRate: current.hireRate,
          medianDaysToHire: current.medianDaysToHire,
        },
        prior: {
          hireRate: prior.hireRate,
          medianDaysToHire: prior.medianDaysToHire,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Benchmark failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
