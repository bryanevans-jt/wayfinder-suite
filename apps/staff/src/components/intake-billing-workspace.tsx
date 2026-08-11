"use client";

import { useCallback, useEffect, useState } from "react";

type Billing = {
  id: string;
  status: string;
  scheduled_at: string | null;
  ready_at: string | null;
  ready_reason: string | null;
  billed_at: string | null;
  paid_at: string | null;
  client: {
    id: string;
    full_name: string | null;
    contact_email: string | null;
    authorization_number: string | null;
    referral_state: string | null;
  } | null;
};

const FILTERS = [
  ["ready_to_bill", "Ready to bill"],
  ["billed", "Billed"],
  ["paid", "Paid"],
  ["scheduled", "Scheduled"],
  ["all", "All"],
] as const;

function reasonLabel(reason: string | null): string {
  if (reason === "contact_log") return "First contact log";
  if (reason === "tse_phase") return "Moved to Phase 2";
  if (reason === "scheduled_time") return "Intake time passed";
  if (reason === "manual") return "Marked ready";
  return "—";
}

export function IntakeBillingWorkspace() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("ready_to_bill");
  const [rows, setRows] = useState<Billing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake-billing?status=${filter}`);
      const data = (await res.json()) as { billings?: Billing[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.billings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "billed" | "paid" | "ready") {
    const res = await fetch("/api/intake-billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingId: id, action }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not update");
      return;
    }
    await load();
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              filter === id
                ? "bg-brand-green text-white"
                : "border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-brand-black/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-brand-black/60">No intake billings in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-brand-black/70">
              <tr>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Auth #</th>
                <th className="px-3 py-2">Ready</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-3 py-3">
                    <p className="font-medium">
                      {row.client?.full_name || row.client?.contact_email || row.client?.id}
                    </p>
                    <p className="text-xs text-brand-black/55">
                      {row.client?.referral_state || "—"}
                      {row.scheduled_at
                        ? ` · Scheduled ${new Date(row.scheduled_at).toLocaleString()}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">{row.client?.authorization_number || "—"}</td>
                  <td className="px-3 py-3">
                    {row.ready_at ? new Date(row.ready_at).toLocaleString() : "—"}
                    <p className="text-xs text-brand-black/55">{reasonLabel(row.ready_reason)}</p>
                  </td>
                  <td className="px-3 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-3">
                    {row.status === "scheduled" ? (
                      <button
                        type="button"
                        onClick={() => void act(row.id, "ready")}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                      >
                        Mark ready
                      </button>
                    ) : null}
                    {row.status === "ready_to_bill" ? (
                      <button
                        type="button"
                        onClick={() => void act(row.id, "billed")}
                        className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Mark billed
                      </button>
                    ) : null}
                    {row.status === "billed" ? (
                      <button
                        type="button"
                        onClick={() => void act(row.id, "paid")}
                        className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Payment received
                      </button>
                    ) : null}
                    {row.status === "paid" ? (
                      <span className="text-xs font-medium uppercase tracking-wide text-brand-black/45">
                        Paid
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
