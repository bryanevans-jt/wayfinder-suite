"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type ClientEsOption = {
  id: string;
  name: string;
  role?: "es" | "supervisor";
};

type Props = {
  clientId: string;
  initialEsUserId: string | null;
  esUsers: ClientEsOption[];
  canWrite: boolean;
};

export function ClientEsAssignmentPanel({
  clientId,
  initialEsUserId,
  esUsers,
  canWrite,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [esUserId, setEsUserId] = useState(initialEsUserId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return esUsers;
    return esUsers.filter((e) => e.name.toLowerCase().includes(q));
  }, [esUsers, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/hospitality/client-es", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          esUserId: esUserId || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const currentLabel =
    esUsers.find((e) => e.id === (initialEsUserId ?? ""))?.name ??
    (initialEsUserId ? "Assigned" : "Unassigned");

  if (!canWrite) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-brand-black">Employment Specialist</h3>
        <p className="mt-2 text-sm text-brand-black">{currentLabel}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-brand-black">Employment Specialist</h3>
        <p className="mt-1 text-sm text-brand-black/65">
          Assign or change the Employment Specialist for this client.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Search</span>
        <input
          type="search"
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Assigned to</span>
        <select
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          value={esUserId}
          onChange={(e) => setEsUserId(e.target.value)}
          disabled={busy}
        >
          <option value="">Unassigned</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.role === "supervisor" ? " (Supervisor)" : ""}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-brand-green">Employment Specialist saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save Employment Specialist"}
      </button>
    </form>
  );
}
