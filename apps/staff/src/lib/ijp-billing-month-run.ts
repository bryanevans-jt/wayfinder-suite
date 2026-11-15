/**
 * Timeout-proof IJP Billing Generate Invoices / 1st-of-month cron runner.
 * Rows phase drains the shrinking unbilled-client queue (always from the front).
 * Compile phase pages a stable invoice-client list with offset.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import {
  loadClientIdsWithUnbilledBillableHoursInMonth,
  serviceMonthStartFromYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { compileIjpInvoicePdf, ensureIjpInvoiceRow } from "@/lib/ijp-billing-service";
import {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
} from "@/lib/ijp-billing-month-run-constants";
import {
  isRowsDrainDone,
  mergeAttemptedSkipClientIds,
  selectNextUnbilledDrainChunk,
  type IjpBillingClientFailure,
} from "@/lib/ijp-billing-month-run-drain";

export {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
};

export type {
  IjpBillingClientFailure,
  IjpGenerateInvoicesSummaryInput,
} from "@/lib/ijp-billing-month-run-drain";

export {
  formatIjpGenerateInvoicesSummary,
  isRowsDrainDone,
  mergeAttemptedSkipClientIds,
  remainingUnbilledForDrain,
  selectNextUnbilledDrainChunk,
  simulateUnbilledDrainRun,
} from "@/lib/ijp-billing-month-run-drain";

async function loadClientIdsWithInvoicesInMonth(
  admin: Parameters<typeof loadClientIdsWithUnbilledBillableHoursInMonth>[0],
  serviceMonth: string,
  isTest: boolean
): Promise<string[]> {
  const rows = await fetchAllPostgrestRows<{ client_id: string }>(
    admin,
    "ijp_billing_invoices",
    "client_id",
    {
      order: { column: "client_id", ascending: true },
      applyFilters: (query) =>
        query.eq("service_month", serviceMonth).eq("is_test", isTest),
    }
  );
  return Array.from(
    new Set(rows.map((r) => r.client_id as string).filter(Boolean))
  ).sort();
}

export type IjpBillingMonthPhase = "rows" | "compile";

export type IjpBillingMonthChunkResult = {
  serviceMonth: string;
  phase: IjpBillingMonthPhase;
  /** Compile phase only — rows drain always uses 0. */
  offset: number;
  limit: number;
  processed: number;
  created: number;
  refreshed: number;
  skippedLocked: number;
  compiled: number;
  compileErrors: number;
  rowFailures: number;
  failedClients: IjpBillingClientFailure[];
  /** Accumulated clients attempted this run (pass back on the next rows chunk). */
  skipClientIds: string[];
  /** Compile phase resume cursor; null when rows drain or compile done. */
  nextOffset: number | null;
  done: boolean;
  /** Unbilled remaining (rows) or invoice clients (compile). */
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
 * Process one chunk.
 * Rows: reload unbilled clients, skip already-attempted, process from the front.
 * Compile: stable invoice-client list with offset (idempotent PDF compile).
 */
export async function runIjpBillingMonthChunk(
  admin: SupabaseClient,
  settings: IjpBillingSettingsRow,
  opts: {
    serviceMonth: string;
    phase?: IjpBillingMonthPhase;
    /** Compile paging only. Ignored for rows (drain always starts at 0). */
    offset?: number;
    limit?: number;
    isTest?: boolean;
    /** Clients already attempted in this Generate / cron run (rows drain). */
    skipClientIds?: readonly string[];
  }
): Promise<IjpBillingMonthChunkResult> {
  const serviceMonth = serviceMonthStartFromYmd(opts.serviceMonth);
  const phase: IjpBillingMonthPhase = opts.phase === "compile" ? "compile" : "rows";
  const isTest = opts.isTest === true;
  const defaultLimit =
    phase === "compile" ? IJP_BILLING_MONTH_COMPILE_BATCH : IJP_BILLING_MONTH_ROW_BATCH;
  const limit = Math.max(1, Math.min(100, Number(opts.limit) || defaultLimit));
  const priorSkip = [...(opts.skipClientIds ?? [])].filter(Boolean);

  let processed = 0;
  let created = 0;
  let refreshed = 0;
  let skippedLocked = 0;
  let compiled = 0;
  let compileErrors = 0;
  let rowFailures = 0;
  const failedClients: IjpBillingClientFailure[] = [];
  let skipClientIds = priorSkip;
  let offset = 0;
  let nextOffset: number | null = null;
  let done = false;
  let total = 0;

  if (phase === "rows") {
    const unbilled = await loadClientIdsWithUnbilledBillableHoursInMonth(
      admin,
      serviceMonth
    );
    total = unbilled.length;
    const { slice, done: empty } = selectNextUnbilledDrainChunk(
      unbilled,
      priorSkip,
      limit
    );
    if (empty || slice.length === 0) {
      return {
        serviceMonth,
        phase,
        offset: 0,
        limit,
        processed: 0,
        created: 0,
        refreshed: 0,
        skippedLocked: 0,
        compiled: 0,
        compileErrors: 0,
        rowFailures: 0,
        failedClients: [],
        skipClientIds: priorSkip,
        nextOffset: null,
        done: true,
        total,
      };
    }

    for (const clientId of slice) {
      skipClientIds = mergeAttemptedSkipClientIds(skipClientIds, [clientId]);
      processed += 1;
      try {
        const row = await ensureIjpInvoiceRow(admin, {
          clientId,
          serviceMonth,
          isTest,
          settings,
          refreshIfUnlocked: true,
        });
        if (row.created) created += 1;
        if (row.refreshed) refreshed += 1;
        if (row.locked) {
          skippedLocked += 1;
        } else {
          await updateMissingAttestationFlag(admin, {
            clientId,
            serviceMonth,
            invoiceId: row.id,
            isTest,
          });
        }
      } catch (e) {
        rowFailures += 1;
        const reason = e instanceof Error ? e.message : "Row generate failed.";
        failedClients.push({ clientId, reason });
        console.error("ijp invoice row failed:", clientId, e);
      }
    }

    const unbilledAfter = await loadClientIdsWithUnbilledBillableHoursInMonth(
      admin,
      serviceMonth
    );
    total = unbilledAfter.length;
    const stillUnbilled = new Set(unbilledAfter);
    const alreadyFailed = new Set(failedClients.map((f) => f.clientId));
    for (const clientId of slice) {
      if (!stillUnbilled.has(clientId) || alreadyFailed.has(clientId)) continue;
      rowFailures += 1;
      failedClients.push({
        clientId,
        reason:
          "Still has unbilled IJP hours after generate attempt (locked invoice or stamp mismatch). Skipped for this run.",
      });
    }
    done = isRowsDrainDone(unbilledAfter, skipClientIds);
    nextOffset = null;
  } else {
    offset = Math.max(0, Number(opts.offset) || 0);
    const clientIds = await loadClientIdsWithInvoicesInMonth(
      admin,
      serviceMonth,
      isTest
    );
    total = clientIds.length;
    const slice = clientIds.slice(offset, offset + limit);

    for (const clientId of slice) {
      processed += 1;
      const { data: invoices } = await admin
        .from("ijp_billing_invoices")
        .select("id, compiled_at, invoice_only_drive_file_id, status, archived_at")
        .eq("client_id", clientId)
        .eq("service_month", serviceMonth)
        .eq("is_test", isTest)
        .order("created_at", { ascending: true });

      for (const invoice of invoices ?? []) {
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
          const reason = e instanceof Error ? e.message : "Compile failed.";
          failedClients.push({ clientId, reason: `compile: ${reason}` });
          console.error("ijp invoice compile failed:", clientId, invoice.id, e);
        }
      }
    }

    const advanced = offset + slice.length;
    done = advanced >= total;
    nextOffset = done ? null : advanced;
  }

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
    rowFailures,
    failedClients,
    skipClientIds,
    nextOffset,
    done,
    total,
  };
}

/**
 * Drain rows then compile while under a wall-clock budget (cron / long generate).
 * Rows always resume with skipClientIds (never a rising unbilled offset).
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
    /** Resume rows drain with these already-attempted client ids. */
    skipClientIds?: readonly string[];
    /** Resume at compile when prior rows finished. */
    startPhase?: IjpBillingMonthPhase;
    /** Compile resume cursor. */
    compileOffset?: number;
  }
): Promise<{
  serviceMonth: string;
  rows: IjpBillingMonthChunkResult[];
  compiles: IjpBillingMonthChunkResult[];
  incomplete: boolean;
  resumePhase: IjpBillingMonthPhase | null;
  resumeOffset: number | null;
  resumeSkipClientIds: string[];
  created: number;
  refreshed: number;
  compiled: number;
  compileErrors: number;
  skippedLocked: number;
  rowFailures: number;
  failedClients: IjpBillingClientFailure[];
}> {
  const budgetMs = opts.budgetMs ?? 250_000;
  const startedAtMs = opts.startedAtMs ?? Date.now();
  const rows: IjpBillingMonthChunkResult[] = [];
  const compiles: IjpBillingMonthChunkResult[] = [];
  let skipClientIds = [...(opts.skipClientIds ?? [])].filter(Boolean);
  const failedClients: IjpBillingClientFailure[] = [];

  const startPhase: IjpBillingMonthPhase =
    opts.startPhase === "compile" ? "compile" : "rows";

  let rowsDone = startPhase === "compile";
  if (!rowsDone) {
    while (!rowsDone && Date.now() - startedAtMs < budgetMs) {
      const chunk = await runIjpBillingMonthChunk(admin, settings, {
        serviceMonth: opts.serviceMonth,
        phase: "rows",
        limit: opts.rowLimit,
        isTest: opts.isTest,
        skipClientIds,
      });
      rows.push(chunk);
      skipClientIds = chunk.skipClientIds;
      failedClients.push(...chunk.failedClients);
      rowsDone = chunk.done;
      // Empty successful drain or no progress with skips should exit.
      if (chunk.processed === 0) {
        rowsDone = true;
      }
    }
  }

  if (!rowsDone) {
    return summarizeUntilBudget({
      serviceMonth: opts.serviceMonth,
      rows,
      compiles,
      incomplete: true,
      resumePhase: "rows",
      resumeOffset: null,
      resumeSkipClientIds: skipClientIds,
      failedClients,
    });
  }

  let compileOffset = Math.max(0, Number(opts.compileOffset) || 0);
  let compileDone = false;
  while (!compileDone && Date.now() - startedAtMs < budgetMs) {
    const chunk = await runIjpBillingMonthChunk(admin, settings, {
      serviceMonth: opts.serviceMonth,
      phase: "compile",
      offset: compileOffset,
      limit: opts.compileLimit,
      isTest: opts.isTest,
    });
    compiles.push(chunk);
    failedClients.push(...chunk.failedClients);
    compileDone = chunk.done;
    compileOffset = chunk.nextOffset ?? chunk.total;
    if (chunk.processed === 0 && chunk.done) {
      compileDone = true;
    }
  }

  return summarizeUntilBudget({
    serviceMonth: opts.serviceMonth,
    rows,
    compiles,
    incomplete: !compileDone,
    resumePhase: compileDone ? null : "compile",
    resumeOffset: compileDone ? null : compileOffset,
    resumeSkipClientIds: skipClientIds,
    failedClients,
  });
}

function summarizeUntilBudget(opts: {
  serviceMonth: string;
  rows: IjpBillingMonthChunkResult[];
  compiles: IjpBillingMonthChunkResult[];
  incomplete: boolean;
  resumePhase: IjpBillingMonthPhase | null;
  resumeOffset: number | null;
  resumeSkipClientIds: string[];
  failedClients: IjpBillingClientFailure[];
}) {
  return {
    serviceMonth: serviceMonthStartFromYmd(opts.serviceMonth),
    rows: opts.rows,
    compiles: opts.compiles,
    incomplete: opts.incomplete,
    resumePhase: opts.resumePhase,
    resumeOffset: opts.resumeOffset,
    resumeSkipClientIds: opts.resumeSkipClientIds,
    created: opts.rows.reduce((n, c) => n + c.created, 0),
    refreshed: opts.rows.reduce((n, c) => n + c.refreshed, 0),
    compiled: opts.compiles.reduce((n, c) => n + c.compiled, 0),
    compileErrors: opts.compiles.reduce((n, c) => n + c.compileErrors, 0),
    skippedLocked:
      opts.rows.reduce((n, c) => n + c.skippedLocked, 0) +
      opts.compiles.reduce((n, c) => n + c.skippedLocked, 0),
    rowFailures: opts.rows.reduce((n, c) => n + c.rowFailures, 0),
    failedClients: opts.failedClients,
  };
}
