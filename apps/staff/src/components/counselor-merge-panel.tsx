"use client";

import { findCounselorDuplicatePairs } from "@wayfinder/supabase/counselor-name-match";
import { useEffect, useMemo, useState } from "react";

export type MergeableCounselor = {
  id: string;
  full_name: string;
  email: string | null;
  contact_email?: string | null;
  client_count: number;
};

type Props = {
  counselors: MergeableCounselor[];
  busy: boolean;
  onMerged: () => Promise<void>;
};

export function CounselorMergePanel({ counselors, busy, onMerged }: Props) {
  const [keeperId, setKeeperId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keep = params.get("keep") ?? "";
    const source = params.get("source") ?? "";
    if (keep && counselors.some((c) => c.id === keep)) setKeeperId(keep);
    if (source && counselors.some((c) => c.id === source)) setSourceId(source);
  }, [counselors]);

  const pairs = useMemo(() => findCounselorDuplicatePairs(counselors), [counselors]);

  const keeper = counselors.find((c) => c.id === keeperId);
  const source = counselors.find((c) => c.id === sourceId);

  async function combine() {
    if (!keeperId || !sourceId || keeperId === sourceId) {
      setError("Pick two different counselors to combine.");
      return;
    }
    const keeperName = keeper?.full_name ?? "the keeper";
    const sourceName = source?.full_name ?? "the other record";
    if (
      !confirm(
        `Combine “${sourceName}” into “${keeperName}”? Clients and offices move to ${keeperName}. The extra counselor record is removed.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/counselors/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keeperId, sourceId }),
      });
      const data = (await res.json()) as { error?: string; movedClients?: number };
      if (!res.ok) throw new Error(data.error || "Could not combine counselors");
      setSourceId("");
      await onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not combine counselors");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Combine counselors</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Referrals sometimes create a second record when a name is spelled differently. Keep one
          counselor and fold the extra record into it.
        </p>
      </div>

      {pairs.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">
            Possible matches
          </p>
          <ul className="mt-2 space-y-2">
            {pairs.map((pair) => (
              <li
                key={`${pair.left.id}:${pair.right.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{pair.left.full_name}</span>
                  <span className="text-brand-black/50"> · {pair.left.client_count} clients</span>
                  <span className="mx-2 text-brand-black/40">↔</span>
                  <span className="font-medium">{pair.right.full_name}</span>
                  <span className="text-brand-black/50"> · {pair.right.client_count} clients</span>
                  <span className="ml-2 text-xs uppercase text-amber-800">
                    {pair.kind === "exact" ? "same name" : "similar"}
                  </span>
                </span>
                <button
                  type="button"
                  className="font-medium text-brand-green hover:underline"
                  onClick={() => {
                    setKeeperId(pair.left.id);
                    setSourceId(pair.right.id);
                  }}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-brand-black/60">No similar counselor names right now.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Keep this counselor</span>
          <select
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            value={keeperId}
            onChange={(e) => setKeeperId(e.target.value)}
            disabled={busy || saving}
          >
            <option value="">Select…</option>
            {counselors.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === sourceId}>
                {c.full_name}
                {c.email || c.contact_email ? ` · ${c.email || c.contact_email}` : ""}
                {` · ${c.client_count} clients`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Combine this record into them</span>
          <select
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            disabled={busy || saving}
          >
            <option value="">Select…</option>
            {counselors.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === keeperId}>
                {c.full_name}
                {c.email || c.contact_email ? ` · ${c.email || c.contact_email}` : ""}
                {` · ${c.client_count} clients`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || saving || !keeperId || !sourceId || keeperId === sourceId}
        onClick={() => void combine()}
        className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Combining…" : "Combine counselors"}
      </button>
    </section>
  );
}
