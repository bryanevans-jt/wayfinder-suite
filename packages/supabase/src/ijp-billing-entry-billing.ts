/**
 * Per-entry IJP billing lock helpers.
 *
 * Design (weekly Generate → monthly GVRA invoice):
 * - One draft invoice per client per service month while unlocked.
 * - Weekly/periodic generate runs append only *unbilled* billable hours into that draft.
 * - Entries are stamped with ijp_billed_invoice_id when included on an invoice so re-runs
 *   never double-bill.
 * - Late-entered hours (ijp_billed_invoice_id null) are picked up on the next run — including
 *   for archived/closed clients.
 * - If the month invoice is already locked (ready/compiled/archived) and unbilled hours remain,
 *   a supplemental draft invoice is created for the same service month (same GVRA format).
 */

export type IjpBilledEntryRef = {
  id: string;
  ijp_billed_invoice_id?: string | null;
};

/** Entry may appear on this invoice build: never billed, or already billed on this invoice. */
export function entryEligibleForIjpInvoiceBuild(
  entry: IjpBilledEntryRef,
  invoiceId: string | null | undefined
): boolean {
  const billed = entry.ijp_billed_invoice_id ?? null;
  if (!billed) return true;
  if (invoiceId && billed === invoiceId) return true;
  return false;
}

export function filterEntriesForIjpInvoiceBuild<T extends IjpBilledEntryRef>(
  entries: readonly T[],
  invoiceId: string | null | undefined
): T[] {
  return entries.filter((row) => entryEligibleForIjpInvoiceBuild(row, invoiceId));
}

/** Pure: after run A bills ids, run B must not select those ids again for a different invoice. */
export function assertNoDoubleBillingAcrossRuns(opts: {
  firstRunBilledEntryIds: readonly string[];
  secondRunCandidateEntryIds: readonly string[];
}): { ok: true } | { ok: false; overlapping: string[] } {
  const billed = new Set(opts.firstRunBilledEntryIds.filter(Boolean));
  const overlapping = opts.secondRunCandidateEntryIds.filter((id) => billed.has(id));
  if (overlapping.length > 0) return { ok: false, overlapping };
  return { ok: true };
}

/** Late entries (never billed) stay eligible for the next generate. */
export function lateUnbilledEntryIds(
  entries: readonly IjpBilledEntryRef[]
): string[] {
  return entries.filter((e) => !e.ijp_billed_invoice_id).map((e) => e.id);
}

export function isEsTimeEntryIjpBilled(entry: {
  ijp_billed_invoice_id?: string | null;
} | null | undefined): boolean {
  return Boolean(entry?.ijp_billed_invoice_id);
}

export const IJP_BILLED_ENTRY_EDIT_BLOCKED_MESSAGE =
  "This time entry is already on an IJP invoice and cannot be edited. Ask an admin to review before changing billed hours.";

export const IJP_BILLED_ENTRY_DELETE_BLOCKED_MESSAGE =
  "This time entry is already on an IJP invoice and cannot be deleted. Ask an admin to review before removing billed hours.";
