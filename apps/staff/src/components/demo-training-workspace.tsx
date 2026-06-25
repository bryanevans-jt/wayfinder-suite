"use client";

import { clientDisplayName } from "@wayfinder/branding";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type DemoRow = {
  id: string;
  contact_email: string | null;
  clientUserId: string | null;
  esUserId: string | null;
  esName: string | null;
  clientName: string | null;
};

type Option = { id: string; label: string };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response from ${res.url || "server"} (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid response from ${res.url || "server"} (${res.status})`);
  }
}

export function DemoTrainingWorkspace() {
  const [demoClients, setDemoClients] = useState<DemoRow[]>([]);
  const [esUsers, setEsUsers] = useState<Option[]>([]);
  const [offices, setOffices] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [counselors, setCounselors] = useState<Option[]>([]);
  const [name, setName] = useState("Training Client");
  const [esUserId, setEsUserId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [demoRes, configRes] = await Promise.all([
      fetch("/api/portal/demo-clients"),
      fetch("/api/portal/config?tier=super_admin"),
    ]);

    const demoData = await readJson<{ demoClients?: DemoRow[]; error?: string }>(demoRes);
    if (!demoRes.ok) {
      throw new Error(demoData.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setDemoClients(demoData.demoClients ?? []);

    const configData = await readJson<{
      bootstrap?: {
        esUsers?: { id: string; display_name?: string; email?: string }[];
        offices?: { id: string; name: string }[];
        services?: { id: string; name: string }[];
        counselors?: { id: string; full_name: string }[];
      };
      error?: string;
    }>(configRes);

    if (!configRes.ok) {
      throw new Error(configData.error ?? USER_FACING_SYSTEM_ERROR);
    }

    const bootstrap = configData.bootstrap;
    setEsUsers(
      (bootstrap?.esUsers ?? []).map((u) => ({
        id: u.id,
        label: u.display_name?.trim() || u.email || u.id,
      }))
    );
    setOffices((bootstrap?.offices ?? []).map((o) => ({ id: o.id, label: o.name })));
    setServices((bootstrap?.services ?? []).map((s) => ({ id: s.id, label: s.name })));
    setCounselors(
      (bootstrap?.counselors ?? []).map((c) => ({ id: c.id, label: c.full_name }))
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        setError(friendlyClientError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function createDemo() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/demo-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, esUserId, officeId, serviceId, counselorId }),
      });
      const data = (await res.json()) as { demoClients?: DemoRow[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setDemoClients(data.demoClients ?? []);
      setMessage("Demo client created. Activity on demo clients is excluded from analytics.");
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearMetrics() {
    if (
      !window.confirm(
        "Clear all contact logs, applications, meetings, time entries, and report alerts for demo clients? Demo client records stay — only training activity is removed."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/demo-clients/clear-metrics", { method: "POST" });
      const data = (await res.json()) as { clearedClients?: number; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setMessage(
        `Cleared training activity for ${data.clearedClients ?? 0} demo client(s). Analytics and alerts will ignore demo data.`
      );
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setBusy(false);
    }
  }

  async function openAsClient(clientId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/demo-clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      window.location.href = data.redirectUrl ?? "/dashboard";
    } catch (e) {
      setError(friendlyClientError(e));
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-black/60">Loading demo training tools…</p>;
  }

  return (
    <section className="mt-8 max-w-3xl space-y-6 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Demo Training Clients</h2>
        <p className="mt-1 text-sm text-brand-black/75">
          Create sample clients assigned to Employment Specialists for training. Demo clients are
          excluded from analytics, compliance alerts, and organization metrics. Only super admins
          can create them.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm text-brand-black">
          {message}
        </p>
      ) : null}

      <div className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <p className="text-sm font-semibold text-brand-black">Create demo client</p>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Employment Specialist</span>
          <select
            value={esUserId}
            onChange={(e) => setEsUserId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">Select…</option>
            {esUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Office</span>
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="">Select…</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Service</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="">Select…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Counselor</span>
            <select
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="">Select…</option>
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !esUserId || !officeId || !serviceId || !counselorId}
          onClick={() => void createDemo()}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create demo client
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void clearMetrics()}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50 disabled:opacity-50"
        >
          Clear training metrics
        </button>
      </div>

      {demoClients.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {demoClients.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-brand-black">
                  {clientDisplayName({
                    full_name: row.clientName,
                    contact_email: row.contact_email,
                    id: row.id,
                  })}
                </p>
                <p className="text-brand-black/65">
                  Employment Specialist: {row.esName ?? "—"}
                  {row.contact_email ? ` · ${row.contact_email}` : null}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !row.clientUserId}
                onClick={() => void openAsClient(row.id)}
                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Open client app
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-black/60">No demo clients yet.</p>
      )}
    </section>
  );
}
