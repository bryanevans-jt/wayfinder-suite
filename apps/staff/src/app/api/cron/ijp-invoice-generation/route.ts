import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import {
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  runIjpBillingMonthChunk,
  runIjpBillingMonthUntilBudget,
} from "@/lib/ijp-billing-month-run";
import { NextResponse } from "next/server";

export const maxDuration = IJP_BILLING_MONTH_MAX_DURATION_SEC;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * 1st-of-month invoice generation for the prior service month.
 * Supports resume via ?phase=&offset= so a timed-out run can continue.
 */
export async function GET(request: Request) {
  const route = "api/cron/ijp-invoice-generation";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const settings = await loadIjpBillingSettings(admin);
    if (!settings.module_enabled) {
      return NextResponse.json({ ok: true, skipped: "module_disabled" });
    }

    const url = new URL(request.url);
    const serviceMonth =
      url.searchParams.get("serviceMonth")?.trim() || priorServiceMonthStart();
    const phaseParam = url.searchParams.get("phase");
    const offsetParam = url.searchParams.get("offset");

    if (phaseParam === "rows" || phaseParam === "compile" || offsetParam != null) {
      const chunk = await runIjpBillingMonthChunk(admin, settings, {
        serviceMonth,
        phase: phaseParam === "compile" ? "compile" : "rows",
        offset: offsetParam != null ? Number(offsetParam) : 0,
        isTest: false,
      });
      return NextResponse.json({ ok: true, ...chunk });
    }

    const run = await runIjpBillingMonthUntilBudget(admin, settings, {
      serviceMonth,
      isTest: false,
      budgetMs: 250_000,
    });
    const rows = run.rows.reduce((n, c) => n + c.processed, 0);
    const created = run.rows.reduce((n, c) => n + c.created, 0);
    const refreshed = run.rows.reduce((n, c) => n + c.refreshed, 0);
    const compiled = run.compiles.reduce((n, c) => n + c.compiled, 0);
    const total = run.rows[0]?.total ?? run.compiles[0]?.total ?? 0;

    return NextResponse.json({
      ok: true,
      serviceMonth: run.serviceMonth,
      rows,
      created,
      refreshed,
      compiled,
      total,
      incomplete: run.incomplete,
      resumePhase: run.resumePhase,
      resumeOffset: run.resumeOffset,
    });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
