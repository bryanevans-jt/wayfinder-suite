"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Packet = {
  id: string;
  service_month: string;
  status: string;
  provider_invoice_number: string | null;
  total_hours: number;
  total_amount_cents: number;
  drive_file_name: string | null;
  pre_ets_authorizations: {
    auth_number: string | null;
    service_code: string;
    pre_ets_schools: { name: string } | { name: string }[] | null;
  } | null;
};

type PacketEvent = {
  id: string;
  event_kind: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

function schoolName(
  auth: Packet["pre_ets_authorizations"]
): string | undefined {
  const school = auth?.pre_ets_schools;
  if (!school) return undefined;
  if (Array.isArray(school)) return school[0]?.name;
  return school.name;
}

export function PreEtsInvoicePanel() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [authId, setAuthId] = useState("");
  const [authorizations, setAuthorizations] = useState<
    { id: string; auth_number: string | null; auth_type: string }[]
  >([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<PacketEvent[]>([]);
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

  async function loadEvents(packetId: string) {
    if (expandedId === packetId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(packetId);
    const res = await fetch(`/api/pre-ets/invoice-packets/${packetId}/events`);
    const data = (await res.json()) as { events?: PacketEvent[] };
    if (res.ok) setEvents(data.events ?? []);
  }

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
    setMessage(null);
    const res = await fetch(`/api/pre-ets/invoice-packets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setMessage("Could not update packet status.");
      return;
    }
    if (status === "ready") {
      const archiveRes = await fetch(`/api/pre-ets/invoice-packets/${id}/archive`, {
        method: "POST",
      });
      if (archiveRes.ok) {
        setMessage("Packet marked ready and archived to Google Drive.");
      } else {
        setMessage("Packet marked ready. Drive archive skipped or failed — download PDF manually.");
      }
    }
    void load();
    if (expandedId === id) void loadEvents(id);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Group invoice packets</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Build draft packets from completed sessions with billable attendance. Download the PDF
          cover sheet and participant list, then mark ready to archive to Drive.
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
                <Fragment key={p.id}>
                  <tr className="border-t border-neutral-100">
                    <td className="px-3 py-2">{p.service_month?.slice(0, 7)}</td>
                    <td className="px-3 py-2">{schoolName(p.pre_ets_authorizations)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.pre_ets_authorizations?.auth_number}
                    </td>
                    <td className="px-3 py-2">{p.total_hours}</td>
                    <td className="px-3 py-2">${(p.total_amount_cents / 100).toFixed(2)}</td>
                    <td className="px-3 py-2 capitalize">{p.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/pre-ets/invoice-packets/${p.id}/pdf`}
                          className="text-xs text-brand-green hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download PDF
                        </a>
                        <button
                          type="button"
                          className="text-xs text-brand-black/60 hover:underline"
                          onClick={() => void loadEvents(p.id)}
                        >
                          {expandedId === p.id ? "Hide log" : "Audit log"}
                        </button>
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
                      {p.drive_file_name ? (
                        <p className="mt-1 text-xs text-brand-black/50">Drive: {p.drive_file_name}</p>
                      ) : null}
                    </td>
                  </tr>
                  {expandedId === p.id ? (
                    <tr className="border-t border-neutral-50 bg-neutral-50/50">
                      <td colSpan={7} className="px-3 py-3">
                        <ul className="space-y-1 text-xs text-brand-black/70">
                          {events.length === 0 ? (
                            <li>No audit events yet.</li>
                          ) : (
                            events.map((e) => (
                              <li key={e.id}>
                                {new Date(e.created_at).toLocaleString()} · {e.event_kind}
                                {e.from_status && e.to_status
                                  ? ` (${e.from_status} → ${e.to_status})`
                                  : ""}
                              </li>
                            ))
                          )}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
