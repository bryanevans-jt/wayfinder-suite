import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { canGenerateIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import {
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  runIjpBillingMonthChunk,
  runIjpBillingMonthUntilBudget,
  type IjpBillingMonthPhase,
} from "@/lib/ijp-billing-month-run";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = IJP_BILLING_MONTH_MAX_DURATION_SEC;

/**
 * Generate / resume invoice rows + optional PDF compile for a service month.
 * Accounts Specialist, Admin, and Super Admin.
 *
 * Weekly runs append unbilled hours into the client's draft month invoice
 * (GVRA monthly format). Already-billed entries are excluded.
 *
 * Body:
 * - serviceMonth (required)
 * - compile?: boolean — when true and no phase/offset, runs rows then compile under a budget
 * - phase?: "rows" | "compile" — single chunk mode for client-side resume loops
 * - offset?: number
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
  };
  const serviceMonth = body.serviceMonth?.trim();
  if (!serviceMonth) {
    return NextResponse.json({ error: "serviceMonth is required." }, { status: 400 });
  }

  if (!auth.settings.module_enabled) {
    return NextResponse.json({ error: "IJP billing module is disabled." }, { status: 400 });
  }

  // Chunked resume mode (UI loops until done).
  if (body.phase === "rows" || body.phase === "compile" || body.offset != null) {
    const chunk = await runIjpBillingMonthChunk(auth.admin, auth.settings, {
      serviceMonth,
      phase: body.phase === "compile" ? "compile" : "rows",
      offset: body.offset,
      limit: body.limit,
      isTest: false,
    });
    return NextResponse.json({ ok: true, ...chunk });
  }

  // One-shot: drain rows (+ compile when requested) under a wall-clock budget.
  const shouldCompile = body.compile !== false;
  if (!shouldCompile) {
    let offset = 0;
    let created = 0;
    let refreshed = 0;
    let skippedLocked = 0;
    let processed = 0;
    let total = 0;
    let done = false;
    let serviceMonthNormalized = serviceMonth;
    while (!done) {
      const chunk = await runIjpBillingMonthChunk(auth.admin, auth.settings, {
        serviceMonth,
        phase: "rows",
        offset,
        isTest: false,
      });
      processed += chunk.processed;
      created += chunk.created;
      refreshed += chunk.refreshed;
      skippedLocked += chunk.skippedLocked;
      total = chunk.total;
      done = chunk.done;
      offset = chunk.nextOffset ?? chunk.total;
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
      total,
      incomplete: false,
    });
  }

  const run = await runIjpBillingMonthUntilBudget(auth.admin, auth.settings, {
    serviceMonth,
    isTest: false,
  });
  const rowsProcessed = run.rows.reduce((n, c) => n + c.processed, 0);
  const created = run.rows.reduce((n, c) => n + c.created, 0);
  const refreshed = run.rows.reduce((n, c) => n + c.refreshed, 0);
  const skippedLocked = run.rows.reduce((n, c) => n + c.skippedLocked, 0);
  const compiled = run.compiles.reduce((n, c) => n + c.compiled, 0);
  const total = run.rows[0]?.total ?? run.compiles[0]?.total ?? 0;

  return NextResponse.json({
    ok: true,
    serviceMonth: run.serviceMonth,
    rows: rowsProcessed,
    created,
    refreshed,
    skippedLocked,
    compiled,
    total,
    incomplete: run.incomplete,
    resumePhase: run.resumePhase,
    resumeOffset: run.resumeOffset,
  });
}
