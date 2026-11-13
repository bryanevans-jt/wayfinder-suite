/**
 * Timeout-proof IJP Billing Generate Month / 1st-of-month cron runner.
 * Rows phase creates/refreshes invoice lines; compile phase builds PDFs in chunks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import {
  loadClientIdsWithBillableHoursInMonth,
  serviceMonthStartFromYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { compileIjpInvoicePdf, ensureIjpInvoiceRow } from "@/lib/ijp-billing-service";
import {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
} from "@/lib/ijp-billing-month-run-constants";

export {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
};

export type IjpBillingMonthPhase = "rows" | "compile";

export type IjpBillingMonthChunkResult = {
  serviceMonth: string;
  phase: IjpBillingMonthPhase;
  offset: number;
  limit: number;
  processed: number;
  created: number;
  refreshed: number;
  skippedLocked: number;
  compiled: number;
  compileErrors: number;
  nextOffset: number | null;
  done: boolean;
  total: number;
};

async function updateMissingAttestationFlag(
  admin: SupabaseClient,
  opts: { clientId: string; serviceMonth: string; invoiceId: string; isTest: boolean }
) {
  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("attestation_drive_file_id")
    .eq("client_id", opts.clientId)
    .eq("service_month", opts.serviceMonth)
    .eq("is_test", opts.isTest)
    .maybeSingle();

  await admin
    .from("ijp_billing_invoices")
    .update({
      missing_attestation: !att?.attestation_drive_file_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.invoiceId);
}

/**
 * Process one chunk of the billable-hours client list.
 * Idempotent: re-runs refresh unlocked drafts only; compile skips already-compiled rows.
 */
export async function runIjpBillingMonthChunk(
  admin: SupabaseClient,
  settings: IjpBillingSettingsRow,
  opts: {
    serviceMonth: string;
    phase?: IjpBillingMonthPhase;
    offset?: number;
    limit?: number;
    isTest?: boolean;
  }
): Promise<IjpBillingMonthChunkResult> {
  const serviceMonth = serviceMonthStartFromYmd(opts.serviceMonth);
  const phase: IjpBillingMonthPhase = opts.phase === "compile" ? "compile" : "rows";
  const isTest = opts.isTest === true;
  const offset = Math.max(0, Number(opts.offset) || 0);
  const defaultLimit =
    phase === "compile" ? IJP_BILLING_MONTH_COMPILE_BATCH : IJP_BILLING_MONTH_ROW_BATCH;
  const limit = Math.max(1, Math.min(100, Number(opts.limit) || defaultLimit));

  const clientIds = await loadClientIdsWithBillableHoursInMonth(admin, serviceMonth);
  const total = clientIds.length;
  const slice = clientIds.slice(offset, offset + limit);

  let processed = 0;
  let created = 0;
  let refreshed = 0;
  let skippedLocked = 0;
  let compiled = 0;
  let compileErrors = 0;

  if (phase === "rows") {
    for (const clientId of slice) {
      const row = await ensureIjpInvoiceRow(admin, {
        clientId,
        serviceMonth,
        isTest,
        settings,
        refreshIfUnlocked: true,
      });
      processed += 1;
      if (row.created) created += 1;
      if (row.refreshed) refreshed += 1;
      if (row.locked) skippedLocked += 1;
      await updateMissingAttestationFlag(admin, {
        clientId,
        serviceMonth,
        invoiceId: row.id,
        isTest,
      });
    }
  } else {
    for (const clientId of slice) {
      processed += 1;
      const { data: invoice } = await admin
        .from("ijp_billing_invoices")
        .select("id, compiled_at, invoice_only_drive_file_id, status, archived_at")
        .eq("client_id", clientId)
        .eq("service_month", serviceMonth)
        .eq("is_test", isTest)
        .maybeSingle();

      if (!invoice?.id) continue;
      if (invoice.archived_at) {
        skippedLocked += 1;
        continue;
      }
      // Idempotent compile: keep existing PDF unless missing.
      if (invoice.compiled_at && invoice.invoice_only_drive_file_id) {
        continue;
      }
      try {
        await compileIjpInvoicePdf(admin, invoice.id as string, settings);
        compiled += 1;
      } catch (e) {
        compileErrors += 1;
        console.error("ijp invoice compile failed:", clientId, e);
      }
    }
  }

  const nextOffset = offset + slice.length;
  const done = nextOffset >= total;
  return {
    serviceMonth,
    phase,
    offset,
    limit,
    processed,
    created,
    refreshed,
    skippedLocked,
    compiled,
    compileErrors,
    nextOffset: done ? null : nextOffset,
    done,
    total,
  };
}

/**
 * Drain rows then compile while under a wall-clock budget (cron / long generate).
 */
export async function runIjpBillingMonthUntilBudget(
  admin: SupabaseClient,
  settings: IjpBillingSettingsRow,
  opts: {
    serviceMonth: string;
    isTest?: boolean;
    budgetMs?: number;
    rowLimit?: number;
    compileLimit?: number;
    startedAtMs?: number;
  }
): Promise<{
  serviceMonth: string;
  rows: IjpBillingMonthChunkResult[];
  compiles: IjpBillingMonthChunkResult[];
  incomplete: boolean;
  resumePhase: IjpBillingMonthPhase | null;
  resumeOffset: number | null;
}> {
  const budgetMs = opts.budgetMs ?? 250_000;
  const startedAtMs = opts.startedAtMs ?? Date.now();
  const rows: IjpBillingMonthChunkResult[] = [];
  const compiles: IjpBillingMonthChunkResult[] = [];

  let offset = 0;
  let rowsDone = false;
  while (!rowsDone && Date.now() - startedAtMs < budgetMs) {
    const chunk = await runIjpBillingMonthChunk(admin, settings, {
      serviceMonth: opts.serviceMonth,
      phase: "rows",
      offset,
      limit: opts.rowLimit,
      isTest: opts.isTest,
    });
    rows.push(chunk);
    rowsDone = chunk.done;
    offset = chunk.nextOffset ?? chunk.total;
  }

  if (!rowsDone) {
    return {
      serviceMonth: serviceMonthStartFromYmd(opts.serviceMonth),
      rows,
      compiles,
      incomplete: true,
      resumePhase: "rows",
      resumeOffset: offset,
    };
  }

  offset = 0;
  let compileDone = false;
  while (!compileDone && Date.now() - startedAtMs < budgetMs) {
    const chunk = await runIjpBillingMonthChunk(admin, settings, {
      serviceMonth: opts.serviceMonth,
      phase: "compile",
      offset,
      limit: opts.compileLimit,
      isTest: opts.isTest,
    });
    compiles.push(chunk);
    compileDone = chunk.done;
    offset = chunk.nextOffset ?? chunk.total;
  }

  return {
    serviceMonth: serviceMonthStartFromYmd(opts.serviceMonth),
    rows,
    compiles,
    incomplete: !compileDone,
    resumePhase: compileDone ? null : "compile",
    resumeOffset: compileDone ? null : offset,
  };
}
