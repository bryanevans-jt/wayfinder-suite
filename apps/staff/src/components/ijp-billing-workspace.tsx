"use client";

import type { IjpInvoiceLineItem } from "@wayfinder/supabase/ijp-billing-lines";
import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

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
};

export function IjpBillingWorkspace() {
  const [month, setMonth] = useState(priorServiceMonthStart());
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<IjpInvoiceLineItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canTest, setCanTest] = useState(false);
  const [testClientId, setTestClientId] = useState("");
  const [testMonth, setTestMonth] = useState(priorServiceMonthStart());

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
    void load();
    void (async () => {
      const access = await fetch("/api/ijp-billing/access");
      const json = (await access.json()) as { role?: string };
      setCanTest(json.role === "super_admin" || json.role === "admin");
    })();
  }, [load]);

  async function loadDetail(id: string) {
    setSelectedId(id);
    const res = await fetch(`/api/ijp-billing/invoices/${id}`);
    const data = (await res.json()) as {
      invoice?: { line_items: IjpInvoiceLineItem[]; provider_invoice_number: string | null; authorization_number: string | null };
    };
    if (res.ok && data.invoice) {
      setLineItems(data.invoice.line_items ?? []);
    }
  }

  async function saveDetail() {
    if (!selectedId) return;
    setBusy(true);
    const inv = invoices.find((i) => i.id === selectedId);
    const res = await fetch(`/api/ijp-billing/invoices/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        line_items: lineItems,
        provider_invoice_number: inv?.provider_invoice_number,
        authorization_number: inv?.authorization_number,
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
      setError("Enter a client ID for the test run.");
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
      </div>

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
              invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{inv.clientName}</td>
                  <td className="px-3 py-2">{inv.provider_invoice_number ?? "—"}</td>
                  <td className="px-3 py-2">{Number(inv.total_hours).toFixed(1)}</td>
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
                      <button
                        type="button"
                        className="text-brand-green underline"
                        onClick={() => void loadDetail(inv.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-brand-green underline"
                        disabled={busy}
                        onClick={() => void compile(inv.id)}
                      >
                        Compile PDF
                      </button>
                      <button
                        type="button"
                        className="text-brand-green underline"
                        disabled={busy}
                        onClick={() => void archive(inv.id)}
                      >
                        Archive combined
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Edit line items</h2>
          <p className="mt-1 text-xs text-brand-black/60">
            Adjust hours per row (including zero). Totals recalculate on save.
          </p>
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
            Save lines
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
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              placeholder="Client UUID"
              className="min-w-[280px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
              value={testClientId}
              onChange={(e) => setTestClientId(e.target.value)}
            />
            <input
              type="month"
              className="rounded-lg border border-neutral-300 px-3 py-2"
              value={testMonth.slice(0, 7)}
              onChange={(e) => setTestMonth(`${e.target.value}-01`)}
            />
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
                  setError("Enter a client ID for the test run.");
                  return;
                }
                setBusy(true);
                const res = await fetch("/api/ijp-billing/test/attestation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    clientId: testClientId.trim(),
                    serviceMonth: testMonth,
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
            folders only.
          </p>
        </section>
      ) : null}
    </div>
  );
}
