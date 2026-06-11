"use client";

import { clientDisplayName } from "@wayfinder/branding";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type ClientOption = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
};

type AuditMessage = {
  id: string;
  body: string;
  sender_role: string;
  sender_name: string | null;
  created_at: string;
  thread_id: string;
  client_id: string | null;
  client_label: string | null;
};

type PurgeRun = {
  id: string;
  purged_before: string;
  message_count: number;
  trigger_kind: string;
  created_at: string;
  triggered_by_name: string | null;
};

type Props = {
  clients: ClientOption[];
  isSuperAdmin: boolean;
};

function defaultPurgeBefore(): string {
  const d = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function senderRoleLabel(role: string): string {
  if (role === "es") return "Employment Specialist";
  if (role === "supervisor") return "Supervisor";
  if (role === "client") return "Client";
  return role;
}

export function AdminMessageAuditPanel({ clients, isSuperAdmin }: Props) {
  const [filterClient, setFilterClient] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [messages, setMessages] = useState<AuditMessage[]>([]);
  const [purgeRuns, setPurgeRuns] = useState<PurgeRun[]>([]);
  const [purgeBefore, setPurgeBefore] = useState(defaultPurgeBefore);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterClient) params.set("clientId", filterClient);
    if (filterFrom) params.set("from", new Date(`${filterFrom}T00:00:00`).toISOString());
    if (filterTo) params.set("to", new Date(`${filterTo}T23:59:59.999`).toISOString());
    return params;
  }, [filterClient, filterFrom, filterTo]);

  const loadMessages = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/messages?${queryParams().toString()}`);
    const data = (await res.json()) as { messages?: AuditMessage[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setMessages(data.messages ?? []);
  }, [queryParams]);

  const loadPurgeRuns = useCallback(async () => {
    if (!isSuperAdmin) {
      setPurgeRuns([]);
      return;
    }
    const res = await fetch("/api/admin/messages?purgeRuns=1");
    const data = (await res.json()) as { purgeRuns?: PurgeRun[]; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setPurgeRuns(data.purgeRuns ?? []);
  }, [isSuperAdmin]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMessages(), loadPurgeRuns()]);
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadPurgeRuns]);

  useEffect(() => {
    void reload();
    // Load once when the audit tab opens; use Apply filters to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPurge() {
    const beforeIso = new Date(`${purgeBefore}T23:59:59.999`).toISOString();
    const confirmed = confirm(
      `Permanently delete all messages sent before ${purgeBefore}? This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setPurgeResult(null);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before: beforeIso, triggerKind: "manual" }),
      });
      const data = (await res.json()) as { purged?: number; before?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setPurgeResult(`Removed ${data.purged ?? 0} message(s) sent before ${purgeBefore}.`);
      await reload();
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  const exportHref = `/api/admin/messages?${queryParams().toString()}&format=csv`;

  const clientLabel = (msg: AuditMessage) => {
    if (msg.client_label?.trim()) return msg.client_label;
    if (msg.client_id) {
      const c = clients.find((row) => row.id === msg.client_id);
      if (c) return clientDisplayName(c);
    }
    return "—";
  };

  if (loading) {
    return <p className="mt-6 text-sm text-brand-black/60">Loading message audit…</p>;
  }

  return (
    <section className="mt-6 max-w-6xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Message audit</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Search and export client ↔ staff message history. Super admins can purge messages older
          than a chosen date for retention compliance.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {clientDisplayName(c)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-brand-black/80">
          From
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-brand-black/80">
          To
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Apply filters
        </button>
        <a
          href={exportHref}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
        >
          Export CSV
        </a>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Sender</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                  No messages match these filters.
                </td>
              </tr>
            ) : (
              messages.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatPortalDateTime(row.created_at)}
                  </td>
                  <td className="px-3 py-2">{clientLabel(row)}</td>
                  <td className="px-3 py-2">{row.sender_name ?? "—"}</td>
                  <td className="px-3 py-2">{senderRoleLabel(row.sender_role)}</td>
                  <td className="max-w-md px-3 py-2 whitespace-pre-wrap break-words">
                    {row.body}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-brand-black/60">
        Showing up to 5,000 messages per search. Narrow filters or export CSV for larger reviews.
      </p>

      {isSuperAdmin ? (
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div>
            <h3 className="text-base font-semibold text-brand-black">Retention purge</h3>
            <p className="mt-1 text-sm text-brand-black/70">
              Super admin only. Run this manually when needed — there is no automatic schedule.
              Deletes all messages sent before the selected date and records the run below.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-brand-black/80">
              Delete messages before
              <input
                type="date"
                value={purgeBefore}
                onChange={(e) => setPurgeBefore(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy || !purgeBefore}
              onClick={() => void runPurge()}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Purge messages
            </button>
          </div>
          {purgeResult ? (
            <p className="text-sm text-brand-green">{purgeResult}</p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Run at</th>
                  <th className="px-3 py-2">Purged before</th>
                  <th className="px-3 py-2">Messages removed</th>
                  <th className="px-3 py-2">Triggered by</th>
                  <th className="px-3 py-2">Kind</th>
                </tr>
              </thead>
              <tbody>
                {purgeRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-brand-black/60">
                      No purge runs yet.
                    </td>
                  </tr>
                ) : (
                  purgeRuns.map((run) => (
                    <tr key={run.id} className="border-t border-neutral-100">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatPortalDateTime(run.created_at)}
                      </td>
                      <td className="px-3 py-2">{formatPortalDateTime(run.purged_before)}</td>
                      <td className="px-3 py-2">{run.message_count}</td>
                      <td className="px-3 py-2">{run.triggered_by_name ?? "—"}</td>
                      <td className="px-3 py-2 capitalize">{run.trigger_kind}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-brand-black/60">
          Message retention purge is available to super admins only.
        </p>
      )}
    </section>
  );
}
