"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { intakeStatusLabel, referralStageLabel } from "@wayfinder/supabase/referral-labels";

type ReferralRow = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  intake_status: string;
  referral_state: string | null;
  referred_at: string | null;
  counselorName: string | null;
  serviceName: string | null;
  stageName: string | null;
  authorization_number: string | null;
  hasEsAssignment: boolean;
  possibleDuplicates: Array<{ id: string; full_name: string | null }>;
};

type SortKey = "counselor" | "state" | "service" | "stage" | "referred";

function stageForRow(c: ReferralRow): string {
  return referralStageLabel({
    intakeStatus: c.intake_status,
    stageTitle: c.stageName,
  });
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function ReferralQueueWorkspace() {
  const [clients, setClients] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeAssigned, setIncludeAssigned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authById, setAuthById] = useState<Record<string, string>>({});
  const [overrideById, setOverrideById] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("referred");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = includeAssigned ? "?includeAssigned=1" : "";
      const res = await fetch(`/api/referrals${qs}`);
      const data = (await res.json()) as { clients?: ReferralRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [includeAssigned]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedClients = useMemo(() => {
    const copy = [...clients];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "counselor") {
        cmp = compareText(a.counselorName || "", b.counselorName || "");
      } else if (sortKey === "state") {
        cmp = compareText(a.referral_state || "", b.referral_state || "");
      } else if (sortKey === "service") {
        cmp = compareText(a.serviceName || "", b.serviceName || "");
      } else if (sortKey === "stage") {
        cmp = compareText(stageForRow(a), stageForRow(b));
      } else {
        const at = a.referred_at ? new Date(a.referred_at).getTime() : 0;
        const bt = b.referred_at ? new Date(b.referred_at).getTime() : 0;
        cmp = at - bt;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [clients, sortKey, sortDir]);

  async function runAction(
    clientId: string,
    action: "pending_authorization" | "activate" | "discard"
  ) {
    setBusyId(clientId);
    setError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          action,
          authorizationNumber: authById[clientId] ?? "",
          overrideReason: overrideById[clientId] ?? "",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Action failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const listExportHref =
    sortedClients.length > 0
      ? `/api/exports/referrals/pdf?ids=${sortedClients.map((c) => c.id).join(",")}`
      : null;

  function setSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(next);
      setSortDir("asc");
    }
  }

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "counselor", label: "Counselor" },
    { key: "state", label: "State" },
    { key: "service", label: "Service" },
    { key: "stage", label: "Stage" },
    { key: "referred", label: "Referred Date" },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeAssigned}
            onChange={(e) => setIncludeAssigned(e.target.checked)}
          />
          Include ES-Assigned Active Clients
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-brand-green hover:bg-neutral-50"
        >
          Refresh
        </button>
        {listExportHref ? (
          <a
            href={listExportHref}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-brand-green hover:bg-neutral-50"
          >
            Export List PDF
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-brand-black/70">Sort By</span>
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSort(opt.key)}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              sortKey === opt.key
                ? "bg-brand-green text-white"
                : "border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {opt.label}
            {sortKey === opt.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-black/60">Loading referrals…</p>
      ) : sortedClients.length === 0 ? (
        <p className="text-sm text-brand-black/60">No referrals in the queue.</p>
      ) : (
        <ul className="space-y-4">
          {sortedClients.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/dashboard/referrals/${c.id}`}
                    className="text-lg font-semibold text-brand-green hover:underline"
                  >
                    {c.full_name || c.contact_email || c.id}
                  </Link>
                  <p className="mt-1 text-sm text-brand-black/70">
                    {stageForRow(c)}
                    {c.referral_state ? ` · ${c.referral_state}` : ""}
                    {c.serviceName ? ` · ${c.serviceName}` : ""}
                    {c.counselorName ? ` · Counselor: ${c.counselorName}` : ""}
                  </p>
                  <p className="text-xs text-brand-black/50">
                    {intakeStatusLabel(c.intake_status)}
                    {c.referred_at
                      ? ` · Referred ${new Date(c.referred_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.hasEsAssignment ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-brand-black/70">
                      ES Assigned
                    </span>
                  ) : null}
                  <a
                    href={`/api/exports/referrals/pdf?clientId=${encodeURIComponent(c.id)}`}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-brand-green hover:bg-neutral-50"
                  >
                    Export PDF
                  </a>
                </div>
              </div>

              {c.possibleDuplicates.length > 0 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Possible Duplicate Of{" "}
                  {c.possibleDuplicates.map((d) => d.full_name || d.id).join(", ")}
                </p>
              ) : null}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium">Authorization #</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    value={authById[c.id] ?? c.authorization_number ?? ""}
                    onChange={(e) =>
                      setAuthById((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Activate Override Reason</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
                    placeholder="Required if no authorization #"
                    value={overrideById[c.id] ?? ""}
                    onChange={(e) =>
                      setOverrideById((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void runAction(c.id, "pending_authorization")}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                >
                  Pending Authorization
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void runAction(c.id, "activate")}
                  className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50"
                >
                  Activate First Stage
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => {
                    if (confirm("Discard this referral client?")) {
                      void runAction(c.id, "discard");
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
