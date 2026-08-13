"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import { CHECK_IN_OUTCOMES, checkInOutcomeLabel, type CheckInOutcome } from "@/lib/hospitality-check-ins";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PartnerRow = {
  id: string;
  name: string;
  status: string;
  city: string | null;
  state: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contacted_this_month: boolean;
  last_contacted_at: string | null;
  last_outcome_label: string | null;
};

type Filter = "needs" | "done" | "all";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  canWrite?: boolean;
};

export function HospitalityPartnerCheckInsWorkspace({ canWrite = true }: Props) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [monthLabelText, setMonthLabelText] = useState("");
  const [contacted, setContacted] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("needs");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<CheckInOutcome>("reached");
  const [notes, setNotes] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/hospitality/partner-check-ins");
    const data = (await res.json()) as {
      partners?: PartnerRow[];
      monthLabel?: string;
      contacted?: number;
      remaining?: number;
      total?: number;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    setPartners(data.partners ?? []);
    setMonthLabelText(data.monthLabel ?? "");
    setContacted(data.contacted ?? 0);
    setRemaining(data.remaining ?? 0);
    setTotal(data.total ?? 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err) => {
        if (!cancelled) setError(friendlyClientError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return partners.filter((p) => {
      if (filter === "needs" && p.contacted_this_month) return false;
      if (filter === "done" && !p.contacted_this_month) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.contact_phone ?? "").includes(q) ||
        (p.contact_email ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [partners, filter, query]);

  const {
    pageSize,
    setPageSize,
    page,
    setPage,
    totalPages,
    pageItems,
    totalCount,
  } = useClientListPagination(filtered);

  async function logContact(employerId: string) {
    setSavingId(employerId);
    setError(null);
    try {
      const res = await fetch("/api/hospitality/partner-check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerId, outcome, notes: notes.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      setNotes("");
      await load();
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-black/55">This month</p>
          <p className="mt-1 text-lg font-semibold">{monthLabelText || "—"}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-black/55">Contacted</p>
          <p className="mt-1 text-lg font-semibold text-brand-green">
            {contacted} / {total}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-amber-900/70">Still need a call</p>
          <p className="mt-1 text-lg font-semibold text-amber-950">{remaining}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["needs", "Needs contact"],
              ["done", "Contacted"],
              ["all", "All partners"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                filter === id
                  ? "bg-brand-green text-white"
                  : "border border-neutral-300 text-brand-black hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, or city"
          className="min-w-[12rem] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <label className="text-sm">
            <span className="font-medium text-brand-black/70">Log outcome</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CheckInOutcome)}
              className="ml-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {CHECK_IN_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {checkInOutcomeLabel(o)}
                </option>
              ))}
            </select>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note for the next log"
            className="min-w-[12rem] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-brand-black/60">Loading partners…</p>
      ) : (
        <>
          <ClientListPaginationControls
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">This month</th>
                  <th className="px-3 py-2">Last contact</th>
                  {canWrite ? <th className="px-3 py-2">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="px-3 py-8 text-center text-brand-black/60">
                      {filter === "needs"
                        ? "Every community partner has a contact this month."
                        : "No partners match this filter."}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((p) => (
                    <tr key={p.id} className="border-t border-neutral-100">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          href={`/dashboard/community-partners/${p.id}`}
                          className="text-brand-green hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className="ml-2 text-xs capitalize text-brand-black/50">{p.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        {p.contact_phone ? (
                          <a href={`tel:${p.contact_phone}`} className="text-brand-green hover:underline">
                            {p.contact_phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {p.contacted_this_month ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Contacted
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Needs contact
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {p.last_contacted_at
                          ? `${formatWhen(p.last_contacted_at)}${p.last_outcome_label ? ` · ${p.last_outcome_label}` : ""}`
                          : "—"}
                      </td>
                      {canWrite ? (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => void logContact(p.id)}
                            disabled={savingId === p.id}
                            className="rounded-lg border border-brand-green px-2.5 py-1 text-xs font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
                          >
                            {savingId === p.id ? "Saving…" : "Log contact"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
