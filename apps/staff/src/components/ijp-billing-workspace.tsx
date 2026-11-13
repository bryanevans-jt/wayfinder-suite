"use client";

import type { IjpInvoiceLineItem } from "@wayfinder/supabase/ijp-billing-lines";
import { IJP_INVOICE_SERVICE_CODE } from "@wayfinder/supabase/ijp-billing-lines";
import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import {
  formatIjpInvoiceAmount,
  formatIjpListHours,
  ijpHoursExpandMode,
  isIjpInvoiceLockedForLineEdits,
} from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { Fragment, useCallback, useEffect, useState } from "react";
import { IjpBillingClientPicker } from "@/components/ijp-billing-client-picker";
import { IjpBillingTestPreview } from "@/components/ijp-billing-test-preview";

type InvoiceRow = {
  id: string;
  client_id: string;
  clientName: string;
  status: string;
  provider_invoice_number: string | null;
  authorization_number: string | null;
  invoice_date: string | null;
  total_hours: number;
  total_amount_cents: number;
  missing_attestation: boolean;
  hasAttestation: boolean;
  compiled_at?: string | null;
  archived_at?: string | null;
};

export function IjpBillingWorkspace() {
  const [month, setMonth] = useState(priorServiceMonthStart());
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<IjpInvoiceLineItem[]>([]);
  const [expandedLines, setExpandedLines] = useState<IjpInvoiceLineItem[]>([]);
  const [linesLoadingId, setLinesLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canTest, setCanTest] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [testClientId, setTestClientId] = useState("");
  const [testMonth, setTestMonth] = useState(priorServiceMonthStart());
  const [testSignature, setTestSignature] = useState("");
  const [addClientId, setAddClientId] = useState("");
  const [detailProviderInvoice, setDetailProviderInvoice] = useState("");
  const [detailAuth, setDetailAuth] = useState("");
  const [detailInvoiceDate, setDetailInvoiceDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/ijp-billing/invoices?month=${encodeURIComponent(month)}`);
    const data = (await res.json()) as { invoices?: InvoiceRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setInvoices(data.invoices ?? []);
    setError(null);
  }, [month]);

  useEffect(() => {
    setExpandedId(null);
    setExpandedLines([]);
    setSelectedId(null);
  }, [month]);

  useEffect(() => {
    void load();
    void (async () => {
      const access = await fetch("/api/ijp-billing/access");
      const json = (await access.json()) as {
        role?: string;
        canEdit?: boolean;
      };
      setCanTest(json.role === "super_admin" || json.role === "admin");
      setCanEdit(Boolean(json.canEdit));
    })();
  }, [load]);

  async function fetchInvoiceLines(id: string): Promise<IjpInvoiceLineItem[] | null> {
    const res = await fetch(`/api/ijp-billing/invoices/${id}`);
    const data = (await res.json()) as {
      invoice?: {
        line_items: IjpInvoiceLineItem[];
        provider_invoice_number: string | null;
        authorization_number: string | null;
        invoice_date: string | null;
      };
      error?: string;
    };
    if (!res.ok || !data.invoice) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return null;
    }
    return data.invoice.line_items ?? [];
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    const res = await fetch(`/api/ijp-billing/invoices/${id}`);
    const data = (await res.json()) as {
      invoice?: {
        line_items: IjpInvoiceLineItem[];
        provider_invoice_number: string | null;
        authorization_number: string | null;
        invoice_date: string | null;
      };
    };
    if (res.ok && data.invoice) {
      setLineItems(data.invoice.line_items ?? []);
      setDetailProviderInvoice(data.invoice.provider_invoice_number ?? "");
      setDetailAuth(data.invoice.authorization_number ?? "");
      setDetailInvoiceDate(data.invoice.invoice_date?.slice(0, 10) ?? "");
    }
  }

  async function toggleHoursExpand(inv: InvoiceRow) {
    if (expandedId === inv.id) {
      setExpandedId(null);
      setExpandedLines([]);
      return;
    }
    setExpandedId(inv.id);
    setLinesLoadingId(inv.id);
    setError(null);
    const lines = await fetchInvoiceLines(inv.id);
    setLinesLoadingId(null);
    if (lines) setExpandedLines(lines);
    else {
      setExpandedId(null);
      setExpandedLines([]);
    }
  }

  async function saveExpandedLines(invoiceId: string) {
    const inv = invoices.find((row) => row.id === invoiceId);
    const mode = ijpHoursExpandMode({
      canEdit,
      locked: isIjpInvoiceLockedForLineEdits(inv),
    });
    if (mode !== "edit") return;

    setBusy(true);
    const res = await fetch(`/api/ijp-billing/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_items: expandedLines }),
    });
    const data = (await res.json()) as {
      error?: string;
      invoice?: {
        total_hours?: number;
        total_amount_cents?: number;
        line_items?: IjpInvoiceLineItem[];
      };
    };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    if (data.invoice?.line_items) setExpandedLines(data.invoice.line_items);
    setMessage(
      "Line hours saved. Totals updated; recompile the PDF if you need the packet refreshed."
    );
    void load();
  }

  async function saveDetail() {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/ijp-billing/invoices/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        line_items: lineItems,
        provider_invoice_number: detailProviderInvoice,
        authorization_number: detailAuth,
        invoice_date: detailInvoiceDate || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage("Invoice updated.");
    void load();
  }

  async function compile(id: string) {
    setBusy(true);
    const res = await fetch(`/api/ijp-billing/invoices/${id}/compile`, { method: "POST" });
    setBusy(false);
    const data = (await res.json()) as { error?: string; fileName?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage(`Compiled ${data.fileName ?? "invoice PDF"}.`);
    void load();
  }

  async function archive(id: string) {
    setBusy(true);
    const res = await fetch(`/api/ijp-billing/invoices/${id}/archive`, { method: "POST" });
    setBusy(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setMessage("Combined packet archived to Drive.");
    void load();
  }

  async function runTest() {
    if (!testClientId.trim()) {
      setError("Select a client for the test run.");
      return;
    }
    setBusy(true);
    setError(null);
    const create = await fetch("/api/ijp-billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: testClientId.trim(),
        serviceMonth: testMonth,
        isTest: true,
        refreshLines: true,
      }),
    });
    const created = (await create.json()) as { invoiceId?: string; error?: string };
    if (!create.ok || !created.invoiceId) {
      setBusy(false);
      setError(created.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    await fetch(`/api/ijp-billing/invoices/${created.invoiceId}/compile`, { method: "POST" });
    setBusy(false);
    setMessage(
      "Test invoice row created and compile attempted (test folders only — no production flags)."
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-black">IJP Billing</h1>
        <p className="mt-1 text-sm text-brand-black/70">
          GA Individual Job Placement monthly invoices and attestation packets. Downloads may warn
          when attestation is missing.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Service month
          <input
            type="month"
            className="ml-2 rounded-lg border border-neutral-300 px-3 py-2"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(`${e.target.value}-01`)}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
          onClick={() => void load()}
        >
          Refresh
        </button>
        <a
          href={`/api/ijp-billing/invoices/zip?month=${encodeURIComponent(month)}`}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Download month ZIP
        </a>
        {canTest ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            onClick={async () => {
              setBusy(true);
              const res = await fetch("/api/ijp-billing/generate-month", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceMonth: month, compile: true }),
              });
              setBusy(false);
              const data = (await res.json()) as { error?: string; rows?: number; compiled?: number };
              if (!res.ok) {
                setError(data.error ?? USER_FACING_SYSTEM_ERROR);
                return;
              }
              setMessage(
                `Generated ${data.rows ?? 0} invoice row(s); compiled ${data.compiled ?? 0} PDF(s).`
              );
              void load();
            }}
          >
            Generate month
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
          <IjpBillingClientPicker
            label="Add invoice row"
            value={addClientId}
            onChange={setAddClientId}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={async () => {
              if (!addClientId.trim()) {
                setError("Select a client.");
                return;
              }
              setBusy(true);
              const res = await fetch("/api/ijp-billing/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: addClientId.trim(), serviceMonth: month, isTest: false }),
              });
              setBusy(false);
              const data = (await res.json()) as { error?: string };
              if (!res.ok) {
                setError(data.error ?? USER_FACING_SYSTEM_ERROR);
                return;
              }
              setMessage("Invoice row added.");
              setAddClientId("");
              void load();
            }}
          >
            Add invoice
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 font-semibold">Client</th>
              <th className="px-3 py-2 font-semibold">Invoice #</th>
              <th className="px-3 py-2 font-semibold">Hours</th>
              <th className="px-3 py-2 font-semibold">Attestation</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/60">
                  No production invoices for this month yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const locked = isIjpInvoiceLockedForLineEdits(inv);
                const expandMode = ijpHoursExpandMode({ canEdit, locked });
                const isExpanded = expandedId === inv.id;
                return (
                  <Fragment key={inv.id}>
                    <tr className="border-t border-neutral-100">
                      <td className="px-3 py-2">{inv.clientName}</td>
                      <td className="px-3 py-2">
                        {canEdit && !locked ? (
                          <input
                            className="w-full min-w-[7rem] rounded border border-neutral-200 px-2 py-1 text-xs"
                            value={inv.provider_invoice_number ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setInvoices((prev) =>
                                prev.map((row) =>
                                  row.id === inv.id
                                    ? { ...row, provider_invoice_number: v || null }
                                    : row
                                )
                              );
                            }}
                            onBlur={async (e) => {
                              await fetch(`/api/ijp-billing/invoices/${inv.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  provider_invoice_number: e.target.value,
                                }),
                              });
                              void load();
                            }}
                          />
                        ) : (
                          <span>{inv.provider_invoice_number ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left font-medium text-brand-green underline"
                          aria-expanded={isExpanded}
                          onClick={() => void toggleHoursExpand(inv)}
                        >
                          {formatIjpListHours(inv.total_hours)}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {inv.hasAttestation ? (
                          "On file"
                        ) : (
                          <span className="text-amber-800">Missing — download shows notice</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{inv.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {canEdit ? (
                            <button
                              type="button"
                              className="text-brand-green underline"
                              onClick={() => void loadDetail(inv.id)}
                            >
                              Edit
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button
                              type="button"
                              className="text-brand-green underline"
                              disabled={busy}
                              onClick={() => void compile(inv.id)}
                            >
                              Compile PDF
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button
                              type="button"
                              className="text-brand-green underline"
                              disabled={busy}
                              onClick={() => void archive(inv.id)}
                            >
                              Archive combined
                            </button>
                          ) : null}
                          <a
                            href={`/api/ijp-billing/invoices/${inv.id}/download`}
                            className="text-brand-green underline"
                          >
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-neutral-100 bg-neutral-50/70">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="space-y-2">
                            <p className="text-xs text-brand-black/65">
                              Invoice lines
                              {expandMode === "edit"
                                ? " — edit hours and save (totals ceil to whole hours)."
                                : " — read-only."}
                            </p>
                            {linesLoadingId === inv.id ? (
                              <p className="text-xs text-brand-black/60">Loading lines…</p>
                            ) : expandedLines.length === 0 ? (
                              <p className="text-xs text-brand-black/60">No line items on this invoice.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                                <table className="min-w-full text-left text-xs">
                                  <thead className="bg-neutral-50">
                                    <tr>
                                      <th className="px-2 py-1.5 font-semibold">Date</th>
                                      <th className="px-2 py-1.5 font-semibold">Code</th>
                                      <th className="px-2 py-1.5 font-semibold">Description</th>
                                      <th className="px-2 py-1.5 font-semibold">Start</th>
                                      <th className="px-2 py-1.5 font-semibold">End</th>
                                      <th className="px-2 py-1.5 font-semibold text-right">Hours</th>
                                      <th className="px-2 py-1.5 font-semibold text-right">Amount</th>
                                      <th className="px-2 py-1.5 font-semibold">Instructor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedLines.map((line, idx) => (
                                      <tr key={line.entryId} className="border-t border-neutral-100">
                                        <td className="whitespace-nowrap px-2 py-1.5">
                                          {line.serviceDate || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5">
                                          {line.serviceCode || IJP_INVOICE_SERVICE_CODE}
                                        </td>
                                        <td className="max-w-xs px-2 py-1.5">
                                          {line.description || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5">
                                          {line.startTime || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5">
                                          {line.endTime || "—"}
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                          {expandMode === "edit" ? (
                                            <input
                                              type="number"
                                              step="0.1"
                                              min={0}
                                              className="w-20 rounded border border-neutral-200 px-1.5 py-1 text-right"
                                              value={line.hours}
                                              onChange={(e) => {
                                                const next = [...expandedLines];
                                                next[idx] = {
                                                  ...line,
                                                  hours: Number(e.target.value) || 0,
                                                };
                                                setExpandedLines(next);
                                              }}
                                            />
                                          ) : (
                                            <span>{Number(line.hours).toFixed(1)}</span>
                                          )}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                          {formatIjpInvoiceAmount(line.amountCents)}
                                        </td>
                                        <td className="px-2 py-1.5">{line.instructorName || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {expandMode === "edit" && expandedLines.length > 0 ? (
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                onClick={() => void saveExpandedLines(inv.id)}
                              >
                                Save line hours
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedId && canEdit ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Edit invoice</h2>
          <p className="mt-1 text-xs text-brand-black/60">
            Adjust billing fields and line hours (including zero). Invoice hour totals round up to
            whole hours on save; per-line hours stay as entered.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs">
              Provider invoice #
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={detailProviderInvoice}
                onChange={(e) => setDetailProviderInvoice(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Authorization #
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={detailAuth}
                onChange={(e) => setDetailAuth(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Invoice date
              <input
                type="date"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={detailInvoiceDate}
                onChange={(e) => setDetailInvoiceDate(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {lineItems.map((line, idx) => (
              <div key={line.entryId} className="grid gap-2 border-b border-neutral-100 pb-2 sm:grid-cols-6">
                <span className="text-xs sm:col-span-2">{line.description}</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className="rounded border px-2 py-1 text-sm"
                  value={line.hours}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[idx] = { ...line, hours: Number(e.target.value) || 0 };
                    setLineItems(next);
                  }}
                />
                <span className="text-xs text-brand-black/60">{line.instructorName}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void saveDetail()}
          >
            Save invoice
          </button>
        </section>
      ) : null}

      {canTest ? (
        <section className="rounded-xl border border-dashed border-amber-400 bg-amber-50/40 p-4">
          <h2 className="text-lg font-semibold text-amber-950">Test with a real client</h2>
          <p className="mt-1 text-sm text-amber-900/85">
            Uses <strong>test Drive folders</strong> and <strong>is_test</strong> rows only. Does not
            change Signature needed, SLA alerts, or production attestations.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <IjpBillingClientPicker
              label="Test client"
              value={testClientId}
              onChange={setTestClientId}
              disabled={busy}
            />
            <label className="text-sm">
              Service month
              <input
                type="month"
                className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
                value={testMonth.slice(0, 7)}
                onChange={(e) => setTestMonth(`${e.target.value}-01`)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void runTest()}
            >
              Run test compile
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-950"
              onClick={async () => {
                if (!testClientId.trim()) {
                  setError("Select a client for the test run.");
                  return;
                }
                if (!testSignature.startsWith("data:image/")) {
                  setError("Draw the client signature in the preview section first.");
                  return;
                }
                setBusy(true);
                const res = await fetch("/api/ijp-billing/test/attestation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    clientId: testClientId.trim(),
                    serviceMonth: testMonth,
                    signatureDataUrl: testSignature,
                  }),
                });
                setBusy(false);
                const data = (await res.json()) as { error?: string };
                if (!res.ok) {
                  setError(data.error ?? USER_FACING_SYSTEM_ERROR);
                  return;
                }
                setMessage("Test attestation saved to test Drive folder (production flags unchanged).");
              }}
            >
              Run test attestation
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-900/70">
            Production Client Signature in the profile modal always writes real attestations. Test
            buttons here use <code className="rounded bg-white px-1">is_test</code> rows and test
            folders only. Run test compile refreshes lines from approved billable ES time before
            generating the test invoice PDF.
          </p>
          {testClientId.trim() ? (
            <IjpBillingTestPreview
              clientId={testClientId.trim()}
              serviceMonth={testMonth}
              disabled={busy}
              signature={testSignature}
              onSignatureChange={setTestSignature}
            />
          ) : (
            <p className="mt-4 text-sm text-amber-900/75">
              Select a test client to preview billable invoice lines and the attestation signing
              experience.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
