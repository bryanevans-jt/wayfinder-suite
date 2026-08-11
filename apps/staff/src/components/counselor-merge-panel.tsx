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
  preselectSourceId?: string | null;
  onMerged: () => Promise<void>;
};

function counselorLabel(c: MergeableCounselor): string {
  const email = c.email || c.contact_email;
  return `${c.full_name}${email ? ` · ${email}` : ""} · ${c.client_count} client${c.client_count === 1 ? "" : "s"}`;
}

function CounselorSearchSelect({
  label,
  value,
  onChange,
  counselors,
  excludeId,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  counselors: MergeableCounselor[];
  excludeId?: string;
  disabled?: boolean;
}) {
  const selected = counselors.find((c) => c.id === value);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return counselors.filter((c) => {
      if (c.id === excludeId) return false;
      if (!q) return true;
      const email = `${c.email ?? ""} ${c.contact_email ?? ""}`.toLowerCase();
      return c.full_name.toLowerCase().includes(q) || email.includes(q);
    });
  }, [counselors, excludeId, query]);

  return (
    <label className="text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email…"
        disabled={disabled}
      />
      <select
        className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select…</option>
        {selected && !filtered.some((c) => c.id === selected.id) ? (
          <option value={selected.id}>{counselorLabel(selected)}</option>
        ) : null}
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {counselorLabel(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CounselorMergePanel({
  counselors,
  busy,
  preselectSourceId,
  onMerged,
}: Props) {
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

  useEffect(() => {
    if (preselectSourceId && counselors.some((c) => c.id === preselectSourceId)) {
      setSourceId(preselectSourceId);
    }
  }, [preselectSourceId, counselors]);

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
    <section id="combine-counselors" className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Combine counselors</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Use this for records already in the list. Search and pick the one to keep, then the
          duplicate to fold into it. You do not need a notification.
        </p>
      </div>

      {pairs.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">
            Possible matches ({pairs.length})
          </p>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
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
                    const keep =
                      pair.left.client_count >= pair.right.client_count ? pair.left : pair.right;
                    const extra = keep.id === pair.left.id ? pair.right : pair.left;
                    setKeeperId(keep.id);
                    setSourceId(extra.id);
                  }}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-brand-black/60">
          No automatic matches. Search the two dropdowns below and combine any pair.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <CounselorSearchSelect
          label="Keep this counselor"
          value={keeperId}
          onChange={setKeeperId}
          counselors={counselors}
          excludeId={sourceId}
          disabled={busy || saving}
        />
        <CounselorSearchSelect
          label="Remove this duplicate"
          value={sourceId}
          onChange={setSourceId}
          counselors={counselors}
          excludeId={keeperId}
          disabled={busy || saving}
        />
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
