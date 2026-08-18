"use client";

import { useCallback, useEffect, useState } from "react";

type Packet = {
  id: string;
  service_month: string;
  status: string;
  provider_invoice_number: string | null;
  total_hours: number;
  total_amount_cents: number;
  pre_ets_authorizations: {
    auth_number: string | null;
    service_code: string;
    pre_ets_schools: { name: string } | null;
  } | null;
};

export function PreEtsInvoicePanel() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [authId, setAuthId] = useState("");
  const [authorizations, setAuthorizations] = useState<
    { id: string; auth_number: string | null; auth_type: string }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/invoice-packets");
    const data = (await res.json()) as { packets?: Packet[] };
    if (res.ok) setPackets(data.packets ?? []);

    const authRes = await fetch("/api/pre-ets/authorizations");
    const authData = (await authRes.json()) as {
      authorizations?: { id: string; auth_number: string | null; auth_type: string }[];
    };
    if (authRes.ok) {
      setAuthorizations((authData.authorizations ?? []).filter((a) => a.auth_type === "group"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generatePacket() {
    if (!authId) return;
    setMessage(null);
    const res = await fetch("/api/pre-ets/invoice-packets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationId: authId }),
    });
    const data = (await res.json()) as { error?: string; billableUnits?: number };
    setMessage(
      res.ok
        ? `Draft packet created with ${data.billableUnits ?? 0} billable unit(s).`
        : data.error ?? "Could not create packet"
    );
    void load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/pre-ets/invoice-packets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Group invoice packets</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Build draft packets from completed sessions with billable attendance. Mark submitted after
          GVRA portal upload and paid when received.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <select
          className="rounded-lg border border-neutral-300 px-2 py-1.5"
          value={authId}
          onChange={(e) => setAuthId(e.target.value)}
        >
          <option value="">Group authorization…</option>
          {authorizations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.auth_number ?? a.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white"
          onClick={() => void generatePacket()}
        >
          Generate draft packet
        </button>
      </div>

      {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-brand-black/55">
                  No invoice packets yet.
                </td>
              </tr>
            ) : (
              packets.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{p.service_month?.slice(0, 7)}</td>
                  <td className="px-3 py-2">{p.pre_ets_authorizations?.pre_ets_schools?.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.pre_ets_authorizations?.auth_number}
                  </td>
                  <td className="px-3 py-2">{p.total_hours}</td>
                  <td className="px-3 py-2">${(p.total_amount_cents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 capitalize">{p.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.status === "draft" ? (
                        <button
                          type="button"
                          className="text-xs text-brand-green hover:underline"
                          onClick={() => void updateStatus(p.id, "ready")}
                        >
                          Mark ready
                        </button>
                      ) : null}
                      {p.status === "ready" ? (
                        <button
                          type="button"
                          className="text-xs text-brand-green hover:underline"
                          onClick={() => void updateStatus(p.id, "submitted")}
                        >
                          Mark submitted
                        </button>
                      ) : null}
                      {p.status === "submitted" ? (
                        <button
                          type="button"
                          className="text-xs text-brand-green hover:underline"
                          onClick={() => void updateStatus(p.id, "paid")}
                        >
                          Mark paid
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
