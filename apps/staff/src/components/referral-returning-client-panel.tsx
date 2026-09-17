"use client";

import { useCallback, useEffect, useState } from "react";

type ReturningRow = {
  id: string;
  full_name: string | null;
  archived_at: string | null;
  outcomeLabel: string | null;
};

type Props = {
  onOpenBeginNewService: (priorClientId: string) => void;
};

export function ReferralReturningClientPanel({ onOpenBeginNewService }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturningRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState("");
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

  if (!open) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm text-brand-black">
        <p className="font-medium text-brand-black">
          Returning client with a new service but no counselor referral?
        </p>
        <p className="mt-1 text-brand-black/70">
          Search a previous Complete, Dismissed, or Closed enrollment, review their information, pick
          the new service, and add them to the queue for authorization and ES/TS assignment.
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
          <p className="font-semibold text-brand-black">Find prior enrollment</p>
          <p className="mt-1 text-sm text-brand-black/65">
            Select a closed enrollment to open the Begin New Service form.
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

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return;
            onOpenBeginNewService(selectedId);
            setOpen(false);
            setQuery("");
            setResults([]);
            setSelectedId("");
          }}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
        >
          Continue to Begin New Service
        </button>
      </div>
    </div>
  );
}
