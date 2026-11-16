"use client";

import { formatIjpListHours } from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useMemo, useState } from "react";

type LedgerEntry = {
  entryId: string;
  clientId: string;
  serviceDate: string;
  hours: number;
  activityCode: string | null;
  billed: boolean;
  invoiceId: string | null;
  providerInvoiceNumber: string | null;
  attribution: "ijp" | "unattributed";
};

type LedgerClient = {
  clientId: string;
  clientName: string;
  archived: boolean;
  ijpHours: number;
  unbilledHours: number;
  unattributedHours: number;
  attestation: {
    hasAttestation: boolean;
    capturedAt: string | null;
    driveUrl: string | null;
    driveFileName: string | null;
  };
  invoices: Array<{
    id: string;
    providerInvoiceNumber: string | null;
    totalHours: number;
    compiledAt: string | null;
    needsRebuild: boolean;
    missingAttestation: boolean;
    isEmpty: boolean;
  }>;
  entries: LedgerEntry[];
  unattributedEntries: LedgerEntry[];
};

type Props = {
  month: string;
  canEdit: boolean;
  onMessage: (msg: string | null) => void;
  onError: (msg: string | null) => void;
  onChanged?: () => void;
};

function formatCapture(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function IjpBillingHoursLedger({
  month,
  canEdit,
  onMessage,
  onError,
  onChanged,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [clients, setClients] = useState<LedgerClient[]>([]);
  const [totals, setTotals] = useState({
    ijpEntries: 0,
    unbilledEntries: 0,
    unattributedEntries: 0,
    clientsWithUnbilled: 0,
    complete: true,
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    const res = await fetch(
      `/api/ijp-billing/ledger?month=${encodeURIComponent(month)}&page=${page}&pageSize=${pageSize}`
    );
    const data = (await res.json()) as {
      clients?: LedgerClient[];
      totals?: typeof totals;
      totalPages?: number;
      totalClients?: number;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      onError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setClients(data.clients ?? []);
    setTotals(
      data.totals ?? {
        ijpEntries: 0,
        unbilledEntries: 0,
        unattributedEntries: 0,
        clientsWithUnbilled: 0,
        complete: true,
      }
    );
    setTotalPages(data.totalPages ?? 1);
    setTotalClients(data.totalClients ?? 0);
    setSelected({});
  }, [month, page, pageSize, onError]);

  useEffect(() => {
    setPage(1);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEntryIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );

  async function unbill(entryIds: string[], confirmRebuild = false) {
    if (!canEdit || entryIds.length === 0) return;
    setBusy(true);
    onError(null);
    onMessage(null);
    const res = await fetch("/api/ijp-billing/ledger/unbill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds, confirmRebuild }),
    });
    const data = (await res.json()) as {
      cleared?: number;
      needsRebuildConfirm?: Array<{ invoiceId: string; entryIds: string[] }>;
      failed?: Array<{ entryId: string; reason: string }>;
      message?: string;
      error?: string;
    };
    setBusy(false);
    if (res.status === 409 && data.needsRebuildConfirm?.length) {
      const ok = window.confirm(
        "Some selected hours are on a compiled invoice PDF. Unchecking will flag that invoice Needs rebuild so you can recompile. Continue?"
      );
      if (ok) {
        await unbill(entryIds, true);
      } else {
        onMessage("Uncheck cancelled — compiled invoice left unchanged.");
      }
      return;
    }
    if (!res.ok) {
      onError(data.error ?? data.message ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    onMessage(
      `Unchecked ${data.cleared ?? 0} hour entr${(data.cleared ?? 0) === 1 ? "y" : "ies"} (Not billed yet).${
        confirmRebuild ? " Compiled invoice(s) flagged Needs rebuild." : ""
      }`
    );
    void load();
    onChanged?.();
  }

  async function bill(opts: {
    entryIds?: string[];
    clientIds?: string[];
    billAllUnbilled?: boolean;
  }) {
    if (!canEdit) return;
    setBusy(true);
    onError(null);
    onMessage(null);
    const res = await fetch("/api/ijp-billing/ledger/bill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceMonth: month,
        entryIds: opts.entryIds,
        clientIds: opts.clientIds,
        billAllUnbilled: opts.billAllUnbilled,
      }),
    });
    const data = (await res.json()) as {
      billed?: number;
      skipped?: Array<{ reason: string }>;
      failed?: Array<{ reason: string }>;
      invoiceIds?: string[];
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      onError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    const skipped = data.skipped?.length ?? 0;
    const failed = data.failed?.length ?? 0;
    onMessage(
      `Billed ${data.billed ?? 0} entr${(data.billed ?? 0) === 1 ? "y" : "ies"} across ${
        data.invoiceIds?.length ?? 0
      } invoice(s). Skipped ${skipped}; failed ${failed}.`
    );
    if (failed > 0 && data.failed?.[0]) {
      onError(data.failed.map((f) => f.reason).slice(0, 3).join(" · "));
    }
    void load();
    onChanged?.();
  }

  return (
    <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Month hours ledger</h2>
          <p className="mt-1 text-sm text-brand-black/70">
            Every Individual Job Placement–attributed hour for this month (service-on-date rule),
            sorted by client last name. Unattributed hours are listed separately and are not billed.
            Completeness = unbilled IJP entry count is 0.
          </p>
        </div>
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            totals.complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {totals.complete
            ? "Complete — no unbilled IJP entries"
            : `${totals.unbilledEntries} unbilled IJP · ${totals.clientsWithUnbilled} clients`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          disabled={busy || !canEdit || selectedEntryIds.length === 0}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
          onClick={() =>
            void bill({
              entryIds: selectedEntryIds,
              clientIds: [
                ...new Set(
                  clients
                    .flatMap((c) => c.entries)
                    .filter((e) => selected[e.entryId] && !e.billed)
                    .map((e) => e.clientId)
                ),
              ],
            })
          }
        >
          Bill selected
        </button>
        <button
          type="button"
          disabled={busy || !canEdit || totals.unbilledEntries === 0}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
          onClick={() => void bill({ billAllUnbilled: true })}
        >
          Bill all unbilled (month)
        </button>
        <button
          type="button"
          disabled={busy || !canEdit || selectedEntryIds.length === 0}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
          onClick={() => void unbill(selectedEntryIds)}
        >
          Uncheck selected → Not billed
        </button>
        <button
          type="button"
          disabled={busy || loading}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
          onClick={() => void load()}
        >
          Refresh ledger
        </button>
      </div>

      <p className="text-xs text-brand-black/60">
        {totals.ijpEntries} IJP entries · {totals.unattributedEntries} unattributed ·{" "}
        {totalClients} clients (page {page} of {totalPages})
        {loading ? " · Loading…" : ""}
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-brand-black/55">
            <tr>
              <th className="py-2 pr-2" />
              <th className="py-2 pr-3">Client</th>
              <th className="py-2 pr-3">IJP hrs</th>
              <th className="py-2 pr-3">Unbilled</th>
              <th className="py-2 pr-3">Attestation</th>
              <th className="py-2 pr-3">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const open = Boolean(expanded[client.clientId]);
              const emptyInvoices = client.invoices.filter((i) => i.isEmpty);
              const activeInvoices = client.invoices.filter((i) => !i.isEmpty);
              return (
                <tr key={client.clientId} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      className="text-xs text-brand-green underline"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [client.clientId]: !prev[client.clientId],
                        }))
                      }
                    >
                      {open ? "Hide" : "Hours"}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-brand-black">
                      {client.clientName}
                      {client.archived ? (
                        <span className="ml-2 text-xs font-normal text-brand-black/50">
                          archived
                        </span>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="mt-2 space-y-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-brand-black/50">
                              <th className="py-1 pr-2" />
                              <th className="py-1 pr-2">Date</th>
                              <th className="py-1 pr-2">Hours</th>
                              <th className="py-1 pr-2">Activity</th>
                              <th className="py-1 pr-2">Status</th>
                              <th className="py-1">Invoice</th>
                            </tr>
                          </thead>
                          <tbody>
                            {client.entries.map((entry) => (
                              <tr key={entry.entryId}>
                                <td className="py-1 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selected[entry.entryId])}
                                    onChange={(e) =>
                                      setSelected((prev) => ({
                                        ...prev,
                                        [entry.entryId]: e.target.checked,
                                      }))
                                    }
                                    aria-label={`Select entry ${entry.serviceDate}`}
                                  />
                                </td>
                                <td className="py-1 pr-2">{entry.serviceDate}</td>
                                <td className="py-1 pr-2">
                                  {formatIjpListHours(entry.hours)}
                                </td>
                                <td className="py-1 pr-2">{entry.activityCode ?? "—"}</td>
                                <td className="py-1 pr-2">
                                  {entry.billed ? "Billed" : "Not billed yet"}
                                </td>
                                <td className="py-1 font-mono text-[11px]">
                                  {entry.providerInvoiceNumber ||
                                    (entry.invoiceId ? entry.invoiceId.slice(0, 8) : "—")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {client.unattributedEntries.length > 0 ? (
                          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2">
                            <p className="mb-1 font-medium text-brand-black/70">
                              Unattributed (not billed on IJP)
                            </p>
                            <ul className="space-y-1 text-xs text-brand-black/65">
                              {client.unattributedEntries.map((entry) => (
                                <li key={entry.entryId}>
                                  {entry.serviceDate} · {formatIjpListHours(entry.hours)} hrs ·{" "}
                                  {entry.activityCode ?? "—"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {canEdit && client.unbilledHours > 0 ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => void bill({ clientIds: [client.clientId] })}
                          >
                            Bill all unbilled for client
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">{formatIjpListHours(client.ijpHours)}</td>
                  <td className="py-2 pr-3">{formatIjpListHours(client.unbilledHours)}</td>
                  <td className="py-2 pr-3">
                    {client.attestation.hasAttestation ? (
                      <div>
                        <span className="text-emerald-800">On file</span>
                        <div className="text-xs text-brand-black/55">
                          Captured {formatCapture(client.attestation.capturedAt)}
                        </div>
                        {client.attestation.driveUrl ? (
                          <a
                            href={client.attestation.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-green underline"
                          >
                            Open Drive PDF
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-amber-800">Missing</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {activeInvoices.length === 0 && emptyInvoices.length === 0 ? (
                      <span className="text-brand-black/50">None</span>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {activeInvoices.map((inv) => (
                          <li key={inv.id}>
                            <span className="font-mono">
                              {inv.providerInvoiceNumber || inv.id.slice(0, 8)}
                            </span>
                            {` · ${formatIjpListHours(inv.totalHours)} hrs`}
                            {inv.compiledAt ? " · compiled" : " · draft"}
                            {inv.needsRebuild ? (
                              <span className="ml-1 rounded bg-amber-100 px-1 font-semibold text-amber-950">
                                Needs rebuild
                              </span>
                            ) : null}
                            {inv.missingAttestation ? (
                              <span className="ml-1 text-amber-800">· missing attestation</span>
                            ) : null}
                          </li>
                        ))}
                        {emptyInvoices.length > 0 ? (
                          <li className="text-brand-black/40">
                            {emptyInvoices.length} empty draft
                            {emptyInvoices.length === 1 ? "" : "s"} (ignored for completeness)
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-brand-black/55">
                  No IJP activity for this month.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          disabled={page <= 1 || loading}
          className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </section>
  );
}
