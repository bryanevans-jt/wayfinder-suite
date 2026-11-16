/**
 * Ledger bill / unbill actions with audit trail and compiled-invoice rebuild flags.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recalcLineAmount,
  sumIjpLineItems,
  type IjpInvoiceLineItem,
} from "@wayfinder/supabase/ijp-billing-lines";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import {
  serviceMonthEndYmd,
  serviceMonthStartFromYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { ensureIjpInvoiceRow, markEsTimeEntriesBilledOnIjpInvoice } from "@/lib/ijp-billing-service";
import { logIjpBillingAudit } from "@/lib/ijp-billing-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function insertHourAudit(
  admin: SupabaseClient,
  row: {
    action: "unbill" | "bill" | "rebuild_flag";
    actorUserId: string;
    actorName?: string | null;
    clientId?: string | null;
    serviceMonth?: string | null;
    entryId?: string | null;
    invoiceId?: string | null;
    beforeInvoiceId?: string | null;
    afterInvoiceId?: string | null;
    detail?: Record<string, unknown>;
  }
) {
  await admin.from("ijp_billing_hour_audit").insert({
    action: row.action,
    actor_user_id: row.actorUserId,
    actor_name: row.actorName ?? null,
    client_id: row.clientId ?? null,
    service_month: row.serviceMonth ?? null,
    entry_id: row.entryId ?? null,
    invoice_id: row.invoiceId ?? null,
    before_invoice_id: row.beforeInvoiceId ?? null,
    after_invoice_id: row.afterInvoiceId ?? null,
    detail: row.detail ?? {},
  });
}

export type UnbillLedgerResult = {
  cleared: number;
  needsRebuildConfirm: Array<{
    invoiceId: string;
    clientId: string;
    entryIds: string[];
    compiled: boolean;
  }>;
  failed: Array<{ entryId: string; reason: string }>;
};

/**
 * Clear ijp_billed_invoice_id and remove matching lines.
 * If any target invoice is compiled, returns needsRebuildConfirm unless confirmRebuild=true
 * (then sets needs_rebuild and proceeds).
 */
export async function unbillIjpLedgerEntries(
  admin: SupabaseClient,
  opts: {
    entryIds: string[];
    actorUserId: string;
    actorName?: string | null;
    confirmRebuild?: boolean;
    hourlyRateCents: number;
  }
): Promise<UnbillLedgerResult> {
  const ids = [...new Set(opts.entryIds.filter((id) => UUID_RE.test(id)))];
  const failed: UnbillLedgerResult["failed"] = [];
  if (ids.length === 0) {
    return { cleared: 0, needsRebuildConfirm: [], failed: [] };
  }

  const { data: entries, error } = await admin
    .from("es_time_entries")
    .select("id, client_id, service_date, ijp_billed_invoice_id")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byInvoice = new Map<
    string,
    { clientId: string; entryIds: string[]; serviceMonth: string }
  >();
  for (const row of entries ?? []) {
    const invoiceId = row.ijp_billed_invoice_id as string | null;
    if (!invoiceId) {
      failed.push({ entryId: row.id as string, reason: "Already not billed." });
      continue;
    }
    const month = serviceMonthStartFromYmd(
      ((row.service_date as string) ?? "").slice(0, 10) || "1970-01-01"
    );
    const bucket = byInvoice.get(invoiceId) ?? {
      clientId: row.client_id as string,
      entryIds: [],
      serviceMonth: month,
    };
    bucket.entryIds.push(row.id as string);
    byInvoice.set(invoiceId, bucket);
  }

  const needsRebuildConfirm: UnbillLedgerResult["needsRebuildConfirm"] = [];
  for (const [invoiceId, bucket] of byInvoice) {
    const { data: inv } = await admin
      .from("ijp_billing_invoices")
      .select("id, client_id, compiled_at, archived_at, status, line_items")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) {
      for (const entryId of bucket.entryIds) {
        failed.push({ entryId, reason: "Invoice not found for stamp." });
      }
      continue;
    }
    const compiled = Boolean(inv.compiled_at);
    if (compiled && !opts.confirmRebuild) {
      needsRebuildConfirm.push({
        invoiceId,
        clientId: inv.client_id as string,
        entryIds: bucket.entryIds,
        compiled: true,
      });
    }
  }

  if (needsRebuildConfirm.length > 0 && !opts.confirmRebuild) {
    return { cleared: 0, needsRebuildConfirm, failed };
  }

  let cleared = 0;
  for (const [invoiceId, bucket] of byInvoice) {
    if (
      !opts.confirmRebuild &&
      needsRebuildConfirm.some((n) => n.invoiceId === invoiceId)
    ) {
      continue;
    }

    const { data: inv } = await admin
      .from("ijp_billing_invoices")
      .select("id, client_id, service_month, compiled_at, line_items")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) continue;

    const entrySet = new Set(bucket.entryIds);
    const existing = (inv.line_items as IjpInvoiceLineItem[] | null) ?? [];
    const nextLines = existing
      .filter((line) => !entrySet.has(line.entryId))
      .map((line) => recalcLineAmount(line, opts.hourlyRateCents));
    const totals = sumIjpLineItems(nextLines, opts.hourlyRateCents);
    const compiled = Boolean(inv.compiled_at);

    const { error: updErr } = await admin
      .from("ijp_billing_invoices")
      .update({
        line_items: nextLines,
        total_hours: totals.totalHours,
        total_amount_cents: totals.totalAmountCents,
        needs_rebuild: compiled ? true : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
    if (updErr) throw new Error(updErr.message);

    if (compiled) {
      await insertHourAudit(admin, {
        action: "rebuild_flag",
        actorUserId: opts.actorUserId,
        actorName: opts.actorName,
        clientId: inv.client_id as string,
        serviceMonth: inv.service_month as string,
        invoiceId,
        detail: { reason: "Hours unchecked from compiled invoice" },
      });
    }

    const stampedAt = new Date().toISOString();
    const { error: clearErr } = await admin
      .from("es_time_entries")
      .update({
        ijp_billed_invoice_id: null,
        ijp_billed_at: null,
        updated_at: stampedAt,
      })
      .in("id", bucket.entryIds)
      .eq("ijp_billed_invoice_id", invoiceId);
    if (clearErr) throw new Error(clearErr.message);

    for (const entryId of bucket.entryIds) {
      await insertHourAudit(admin, {
        action: "unbill",
        actorUserId: opts.actorUserId,
        actorName: opts.actorName,
        clientId: inv.client_id as string,
        serviceMonth: inv.service_month as string,
        entryId,
        invoiceId,
        beforeInvoiceId: invoiceId,
        afterInvoiceId: null,
        detail: { compiled, needsRebuild: compiled },
      });
      cleared += 1;
    }

    await logIjpBillingAudit(admin, {
      action: "ledger_unbill",
      clientId: inv.client_id as string,
      serviceMonth: inv.service_month as string,
      dismissedBy: opts.actorUserId,
      dismissedByName: opts.actorName,
      metadata: {
        entryIds: bucket.entryIds,
        invoiceId,
        compiled,
      },
    });
  }

  return { cleared, needsRebuildConfirm: [], failed };
}

export type BillLedgerResult = {
  billed: number;
  skipped: Array<{ entryId?: string; clientId?: string; reason: string }>;
  failed: Array<{ entryId?: string; clientId?: string; reason: string }>;
  invoiceIds: string[];
};

/** Bill specific unbilled entries (or all unbilled for clients) via ensure/refresh draft. */
export async function billIjpLedgerEntries(
  admin: SupabaseClient,
  opts: {
    entryIds?: string[];
    clientIds?: string[];
    serviceMonth: string;
    settings: IjpBillingSettingsRow;
    actorUserId: string;
    actorName?: string | null;
    isTest?: boolean;
  }
): Promise<BillLedgerResult> {
  const month = serviceMonthStartFromYmd(opts.serviceMonth);
  const isTest = opts.isTest === true;
  const skipped: BillLedgerResult["skipped"] = [];
  const failed: BillLedgerResult["failed"] = [];
  const invoiceIds: string[] = [];
  let billed = 0;

  let clientIds = [...new Set((opts.clientIds ?? []).filter(Boolean))];
  const entryIds = [...new Set((opts.entryIds ?? []).filter((id) => UUID_RE.test(id)))];

  if (entryIds.length > 0) {
    const { data: rows } = await admin
      .from("es_time_entries")
      .select("id, client_id, ijp_billed_invoice_id")
      .in("id", entryIds);
    for (const row of rows ?? []) {
      if (row.ijp_billed_invoice_id) {
        skipped.push({
          entryId: row.id as string,
          reason: "Already stamped on an invoice.",
        });
      }
    }
    clientIds = [
      ...new Set([
        ...clientIds,
        ...(rows ?? [])
          .filter((r) => !r.ijp_billed_invoice_id)
          .map((r) => r.client_id as string),
      ]),
    ];
  }

  if (clientIds.length === 0) {
    return {
      billed: 0,
      skipped: [{ reason: "No clients or unbilled entries to bill." }],
      failed: [],
      invoiceIds: [],
    };
  }

  for (const clientId of clientIds) {
    try {
      const monthEnd = serviceMonthEndYmd(month);
      const { count: unbilledBefore } = await admin
        .from("es_time_entries")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gte("service_date", month)
        .lte("service_date", monthEnd)
        .is("ijp_billed_invoice_id", null)
        .neq("status", "rejected");

      const row = await ensureIjpInvoiceRow(admin, {
        clientId,
        serviceMonth: month,
        isTest,
        settings: opts.settings,
        refreshIfUnlocked: true,
      });
      if (row.empty || !row.id) {
        skipped.push({
          clientId,
          reason: "No billable IJP hours to put on an invoice.",
        });
        continue;
      }
      invoiceIds.push(row.id);

      const items = row.line_items ?? [];
      const stampedIds = items
        .map((l) => l.entryId)
        .filter((id): id is string => Boolean(id) && UUID_RE.test(id));
      // ensure/sync already stamps; affirm for safety and accurate selected counts
      const newlyStamped = await markEsTimeEntriesBilledOnIjpInvoice(admin, {
        invoiceId: row.id,
        entryIds: stampedIds,
      });
      const billedThisClient =
        newlyStamped > 0 ? newlyStamped : Math.max(0, unbilledBefore ?? 0);
      billed += billedThisClient;

      for (const entryId of stampedIds) {
        if (entryIds.length > 0 && !entryIds.includes(entryId)) continue;
        await insertHourAudit(admin, {
          action: "bill",
          actorUserId: opts.actorUserId,
          actorName: opts.actorName,
          clientId,
          serviceMonth: month,
          entryId,
          invoiceId: row.id,
          beforeInvoiceId: null,
          afterInvoiceId: row.id,
        });
      }

      await logIjpBillingAudit(admin, {
        action: "ledger_bill",
        clientId,
        serviceMonth: month,
        dismissedBy: opts.actorUserId,
        dismissedByName: opts.actorName,
        metadata: {
          invoiceId: row.id,
          created: row.created,
          refreshed: row.refreshed,
          billedThisClient,
        },
      });
    } catch (e) {
      failed.push({
        clientId,
        reason: e instanceof Error ? e.message : "Bill failed.",
      });
    }
  }

  return { billed, skipped, failed, invoiceIds: [...new Set(invoiceIds)] };
}

/** Recompute missing_attestation on all invoices for a client-month from live attestation. */
export async function syncIjpInvoiceMissingAttestationFlags(
  admin: SupabaseClient,
  opts: { clientId: string; serviceMonth: string; isTest?: boolean }
): Promise<void> {
  const month = serviceMonthStartFromYmd(opts.serviceMonth);
  const isTest = opts.isTest === true;
  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("attestation_drive_file_id")
    .eq("client_id", opts.clientId)
    .eq("service_month", month)
    .eq("is_test", isTest)
    .maybeSingle();
  const missing = !att?.attestation_drive_file_id;
  await admin
    .from("ijp_billing_invoices")
    .update({ missing_attestation: missing, updated_at: new Date().toISOString() })
    .eq("client_id", opts.clientId)
    .eq("service_month", month)
    .eq("is_test", isTest);
}
