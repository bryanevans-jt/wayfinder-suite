"use client";

import { useCallback, useEffect, useState } from "react";

type ReturningRow = {
  id: string;
  full_name: string | null;
  archived_at: string | null;
  outcomeLabel: string | null;
};

type Props = {
  onCreated: () => void;
};

export function ReferralReturningClientPanel({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturningRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/returning-clients?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as { clients?: ReturningRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, query, runSearch]);

  async function beginNewService() {
    if (!selectedId) {
      setError("Select a previous enrollment.");
      return;
    }
    const auth = authNumber.trim();
    const override = overrideReason.trim();
    if (!auth && !override) {
      setError("Enter the new authorization number or an override reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: "GA",
          fromPriorClientId: selectedId,
          authorizationNumber: auth,
          overrideReason: override,
        }),
      });
      const data = (await res.json()) as { error?: string; clientId?: string };
      if (!res.ok) throw new Error(data.error || "Could not start new service");
      setOpen(false);
      setQuery("");
      setResults([]);
      setSelectedId("");
      setAuthNumber("");
      setOverrideReason("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start new service");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-brand-black">
        <p className="font-medium text-brand-black">
          Returning client with a new authorization but no counselor referral?
        </p>
        <p className="mt-1 text-brand-black/70">
          Search a previous Complete, Dismissed, or Closed enrollment and add them to the queue with
          the new authorization number.
        </p>
        <button
          type="button"
          className="mt-2 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90"
          onClick={() => setOpen(true)}
        >
          Begin New Service (returning client)
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-green/40 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-brand-black">Begin New Service — returning client</p>
          <p className="mt-1 text-sm text-brand-black/65">
            No new referral form required. Demographics and counselor carry over from the prior
            enrollment.
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-brand-black/60 hover:text-brand-black"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="font-medium">Search prior enrollment</span>
        <input
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
          placeholder="Client name (2+ characters)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </label>

      {searching ? (
        <p className="mt-2 text-xs text-brand-black/55">Searching…</p>
      ) : results.length > 0 ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-neutral-200 p-2">
          {results.map((r) => {
            const selected = selectedId === r.id;
            const outcome = r.outcomeLabel ? ` · ${r.outcomeLabel}` : "";
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50 ${
                    selected ? "bg-brand-green/10 font-medium ring-1 ring-brand-green/40" : ""
                  }`}
                  onClick={() => setSelectedId(r.id)}
                >
                  {r.full_name || r.id}
                  {outcome}
                </button>
              </li>
            );
          })}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="mt-2 text-xs text-brand-black/55">No archived enrollments found.</p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">New authorization #</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Override reason</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            placeholder="If no authorization # yet"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void beginNewService()}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
        >
          Add to Referral Queue
        </button>
      </div>
    </div>
  );
}
