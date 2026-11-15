import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import {
  runIjpBillingMonthUntilBudget,
  type IjpBillingMonthPhase,
} from "@/lib/ijp-billing-month-run";
import { NextResponse } from "next/server";

/** Vercel Pro ceiling — must be a numeric literal for Next.js segment config. */
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function parseSkipClientIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function buildResumeQuery(opts: {
  serviceMonth: string;
  phase: IjpBillingMonthPhase;
  offset: number | null;
  skipClientIds: string[];
}): string {
  const params = new URLSearchParams();
  params.set("serviceMonth", opts.serviceMonth);
  params.set("phase", opts.phase);
  if (opts.phase === "compile" && opts.offset != null) {
    params.set("offset", String(opts.offset));
  }
  if (opts.phase === "rows" && opts.skipClientIds.length > 0) {
    params.set("skipClientIds", opts.skipClientIds.join(","));
  }
  return params.toString();
}

/**
 * 1st-of-month invoice generation for the prior service month.
 * Drains unbilled clients under a time budget. Does not rely on Vercel auto-reinvoke:
 * when incomplete, re-call with the returned resumeQuery (phase / offset / skipClientIds).
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
    const skipClientIds = parseSkipClientIds(url.searchParams.get("skipClientIds"));

    const startPhase: IjpBillingMonthPhase | undefined =
      phaseParam === "compile" ? "compile" : phaseParam === "rows" ? "rows" : undefined;

    const run = await runIjpBillingMonthUntilBudget(admin, settings, {
      serviceMonth,
      isTest: false,
      budgetMs: 250_000,
      skipClientIds,
      startPhase,
      compileOffset: offsetParam != null ? Number(offsetParam) : undefined,
    });

    const rows = run.rows.reduce((n, c) => n + c.processed, 0);
    const total = run.rows[0]?.total ?? run.compiles[0]?.total ?? 0;
    const resumeQuery =
      run.incomplete && run.resumePhase
        ? buildResumeQuery({
            serviceMonth: run.serviceMonth,
            phase: run.resumePhase,
            offset: run.resumeOffset,
            skipClientIds: run.resumeSkipClientIds,
          })
        : null;

    return NextResponse.json({
      ok: true,
      serviceMonth: run.serviceMonth,
      rows,
      created: run.created,
      refreshed: run.refreshed,
      compiled: run.compiled,
      compileErrors: run.compileErrors,
      skippedLocked: run.skippedLocked,
      rowFailures: run.rowFailures,
      failedClients: run.failedClients,
      total,
      incomplete: run.incomplete,
      resumePhase: run.resumePhase,
      resumeOffset: run.resumeOffset,
      resumeSkipClientIds: run.resumeSkipClientIds,
      resumeQuery,
    });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
