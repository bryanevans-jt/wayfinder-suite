"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { intakeStatusLabel, referralStageLabel } from "@wayfinder/supabase/referral-labels";
import { ManualReferralModal } from "@/components/manual-referral-modal";

type ReferralRow = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  intake_status: string;
  referral_state: string | null;
  referred_at: string | null;
  counselor_id: string | null;
  counselorName: string | null;
  serviceName: string | null;
  stageName: string | null;
  authorization_number: string | null;
  hasEsAssignment: boolean;
  possibleDuplicates: Array<{ id: string; full_name: string | null }>;
};

type TimeFilter = "all" | "48h" | "7d" | "30d" | "90d" | "ytd";

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: "all", label: "All Time" },
  { value: "48h", label: "Last 48 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "ytd", label: "Year To Date" },
];

function stageForRow(c: ReferralRow): string {
  return referralStageLabel({
    intakeStatus: c.intake_status,
    stageTitle: c.stageName,
  });
}

function referredMs(c: ReferralRow): number {
  return c.referred_at ? new Date(c.referred_at).getTime() : 0;
}

function timeCutoff(filter: TimeFilter): number | null {
  if (filter === "all") return null;
  const now = Date.now();
  if (filter === "48h") return now - 48 * 60 * 60 * 1000;
  if (filter === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  if (filter === "90d") return now - 90 * 24 * 60 * 60 * 1000;
  // Year to date
  return new Date(new Date().getFullYear(), 0, 1).getTime();
}

function CounselorFilter({
  counselors,
  value,
  onChange,
}: {
  counselors: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedName = counselors.find((c) => c.id === value)?.name ?? "";

  useEffect(() => {
    if (!open) setQuery(selectedName);
  }, [open, selectedName]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return counselors;
    return counselors.filter((c) => c.name.toLowerCase().includes(q));
  }, [counselors, query]);

  return (
    <div ref={rootRef} className="relative min-w-[14rem] flex-1">
      <label className="block text-xs font-medium text-brand-black/70">Counselor</label>
      <input
        type="search"
        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        placeholder="Search counselors…"
        value={open ? query : selectedName || query}
        onFocus={() => {
          setOpen(true);
          setQuery(selectedName);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange("");
        }}
        autoComplete="off"
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
            >
              All Counselors
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-brand-black/50">No matches</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                    c.id === value ? "bg-brand-green/10 font-medium text-brand-green" : ""
                  }`}
                  onClick={() => {
                    onChange(c.id);
                    setQuery(c.name);
                    setOpen(false);
                  }}
                >
                  {c.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function ReferralQueueWorkspace() {
  const [clients, setClients] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeActive, setIncludeActive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authById, setAuthById] = useState<Record<string, string>>({});
  const [overrideById, setOverrideById] = useState<Record<string, string>>({});

  const [clientQuery, setClientQuery] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = includeActive ? "?includeActive=1" : "";
      const res = await fetch(`/api/referrals${qs}`);
      const data = (await res.json()) as { clients?: ReferralRow[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [includeActive]);

  useEffect(() => {
    void load();
  }, [load]);

  const counselorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      if (c.counselor_id && c.counselorName) {
        map.set(c.counselor_id, c.counselorName);
      } else if (c.counselorName) {
        map.set(`name:${c.counselorName}`, c.counselorName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [clients]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) {
      if (c.serviceName) set.add(c.serviceName);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [clients]);

  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) set.add(stageForRow(c));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [clients]);

  const filteredClients = useMemo(() => {
    const cutoff = timeCutoff(timeFilter);
    const q = clientQuery.trim().toLowerCase();
    const copy = clients.filter((c) => {
      if (q) {
        const name = (c.full_name ?? "").toLowerCase();
        const email = (c.contact_email ?? "").toLowerCase();
        const auth = (c.authorization_number ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !auth.includes(q)) return false;
      }
      if (counselorId) {
        if (counselorId.startsWith("name:")) {
          if (c.counselorName !== counselorId.slice(5)) return false;
        } else if (c.counselor_id !== counselorId) {
          return false;
        }
      }
      if (stateFilter && (c.referral_state || "") !== stateFilter) return false;
      if (serviceFilter && (c.serviceName || "") !== serviceFilter) return false;
      if (stageFilter && stageForRow(c) !== stageFilter) return false;
      if (cutoff != null) {
        const t = referredMs(c);
        if (!t || t < cutoff) return false;
      }
      return true;
    });
    copy.sort((a, b) => referredMs(a) - referredMs(b));
    return copy;
  }, [clients, clientQuery, counselorId, stateFilter, serviceFilter, stageFilter, timeFilter]);

  const hasFilters =
    Boolean(clientQuery.trim() || counselorId || stateFilter || serviceFilter || stageFilter) ||
    timeFilter !== "all";

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
    filteredClients.length > 0
      ? `/api/exports/referrals/pdf?ids=${filteredClients.map((c) => c.id).join(",")}`
      : null;

  function clearFilters() {
    setClientQuery("");
    setCounselorId("");
    setStateFilter("");
    setServiceFilter("");
    setStageFilter("");
    setTimeFilter("all");
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeActive}
            onChange={(e) => setIncludeActive(e.target.checked)}
          />
          Include Active Referrals
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand-green px-3 py-1.5 font-semibold text-white hover:bg-brand-green/90"
          >
            Create Referral
          </button>
        </div>
      </div>

      <ManualReferralModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void load();
        }}
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-brand-black">Filters</p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-brand-green hover:underline"
            >
              Clear Filters
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="min-w-[14rem] flex-1 text-xs font-medium text-brand-black/70">
            Client
            <input
              type="search"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Search name, email, or auth #…"
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <CounselorFilter
            counselors={counselorOptions}
            value={counselorId}
            onChange={setCounselorId}
          />
          <label className="min-w-[8rem] text-xs font-medium text-brand-black/70">
            State
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">All States</option>
              <option value="GA">GA</option>
              <option value="TN">TN</option>
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-xs font-medium text-brand-black/70">
            Service
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="">All Services</option>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem] flex-1 text-xs font-medium text-brand-black/70">
            Stage
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {stageOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem] text-xs font-medium text-brand-black/70">
            Time
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-brand-black/55">
          Showing oldest referrals first
          {!loading ? ` · ${filteredClients.length} of ${clients.length}` : ""}
          {hasFilters ? " (filtered)" : ""}
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-black/60">Loading referrals…</p>
      ) : filteredClients.length === 0 ? (
        <p className="text-sm text-brand-black/60">
          {clients.length === 0
            ? "No referrals in the queue."
            : "No referrals match the current filters."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filteredClients.map((c) => (
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
