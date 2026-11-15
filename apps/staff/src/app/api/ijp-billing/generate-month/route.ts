import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { canGenerateIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import {
  runIjpBillingMonthChunk,
  runIjpBillingMonthUntilBudget,
  type IjpBillingMonthPhase,
} from "@/lib/ijp-billing-month-run";
import { NextRequest, NextResponse } from "next/server";

/** Vercel Pro ceiling — must be a numeric literal for Next.js segment config. */
export const maxDuration = 300;

/**
 * Generate / resume invoice rows + optional PDF compile for a service month.
 * Accounts Specialist, Admin, and Super Admin.
 *
 * Weekly runs append unbilled hours into the client's draft month invoice
 * (GVRA monthly format). Already-billed entries are excluded.
 *
 * Body:
 * - serviceMonth (required)
 * - compile?: boolean — when true and no phase, runs rows then compile under a budget
 * - phase?: "rows" | "compile" — single chunk mode for client-side resume loops
 * - offset?: number — compile phase paging only
 * - skipClientIds?: string[] — rows drain: clients already attempted this run
 * - limit?: number
 */
export async function POST(request: NextRequest) {
  await assertNotPreviewMutation();
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canGenerateIjpBilling(auth.role)) {
    return NextResponse.json({ error: "Generate access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    serviceMonth?: string;
    compile?: boolean;
    phase?: IjpBillingMonthPhase;
    offset?: number;
    limit?: number;
    skipClientIds?: string[];
  };
  const serviceMonth = body.serviceMonth?.trim();
  if (!serviceMonth) {
    return NextResponse.json({ error: "serviceMonth is required." }, { status: 400 });
  }

  if (!auth.settings.module_enabled) {
    return NextResponse.json({ error: "IJP billing module is disabled." }, { status: 400 });
  }

  const skipClientIds = Array.isArray(body.skipClientIds)
    ? body.skipClientIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  // Chunked resume mode (UI loops until done).
  if (body.phase === "rows" || body.phase === "compile") {
    const chunk = await runIjpBillingMonthChunk(auth.admin, auth.settings, {
      serviceMonth,
      phase: body.phase === "compile" ? "compile" : "rows",
      offset: body.offset,
      limit: body.limit,
      skipClientIds,
      isTest: false,
    });
    return NextResponse.json({ ok: true, ...chunk });
  }

  // One-shot: drain rows (+ compile when requested) under a wall-clock budget.
  const shouldCompile = body.compile !== false;
  if (!shouldCompile) {
    let created = 0;
    let refreshed = 0;
    let skippedLocked = 0;
    let processed = 0;
    let rowFailures = 0;
    let total = 0;
    let done = false;
    let skips = skipClientIds;
    const failedClients: Array<{ clientId: string; reason: string }> = [];
    let serviceMonthNormalized = serviceMonth;
    while (!done) {
      const chunk = await runIjpBillingMonthChunk(auth.admin, auth.settings, {
        serviceMonth,
        phase: "rows",
        skipClientIds: skips,
        isTest: false,
      });
      processed += chunk.processed;
      created += chunk.created;
      refreshed += chunk.refreshed;
      skippedLocked += chunk.skippedLocked;
      rowFailures += chunk.rowFailures;
      failedClients.push(...chunk.failedClients);
      total = chunk.total;
      skips = chunk.skipClientIds;
      done = chunk.done || chunk.processed === 0;
      serviceMonthNormalized = chunk.serviceMonth;
    }
    return NextResponse.json({
      ok: true,
      serviceMonth: serviceMonthNormalized,
      rows: processed,
      created,
      refreshed,
      skippedLocked,
      compiled: 0,
      compileErrors: 0,
      rowFailures,
      failedClients,
      skipClientIds: skips,
      total,
      incomplete: false,
    });
  }

  const run = await runIjpBillingMonthUntilBudget(auth.admin, auth.settings, {
    serviceMonth,
    isTest: false,
    skipClientIds,
  });

  return NextResponse.json({
    ok: true,
    serviceMonth: run.serviceMonth,
    rows: run.rows.reduce((n, c) => n + c.processed, 0),
    created: run.created,
    refreshed: run.refreshed,
    skippedLocked: run.skippedLocked,
    compiled: run.compiled,
    compileErrors: run.compileErrors,
    rowFailures: run.rowFailures,
    failedClients: run.failedClients,
    skipClientIds: run.resumeSkipClientIds,
    total: run.rows[0]?.total ?? run.compiles[0]?.total ?? 0,
    incomplete: run.incomplete,
    resumePhase: run.resumePhase,
    resumeOffset: run.resumeOffset,
    resumeSkipClientIds: run.resumeSkipClientIds,
  });
}
