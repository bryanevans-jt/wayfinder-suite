"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PTO_REASONS,
  ptoReasonLabel,
  type PtoReason,
  type StaffPtoRequestRow,
} from "@wayfinder/supabase/staff-pto-shared";

type Filter = "active" | "pending" | "approved" | "denied" | "past" | "all";

type RequestRow = StaffPtoRequestRow & {
  requester_name: string;
  decided_by_name: string | null;
};

type Balance = {
  unlimited: boolean;
  annualDays: number | null;
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
  period: { start: string; endInclusive: string };
};

type Settings = {
  period_start_date: string;
  annual_pto_days: number | null;
};

export function StaffPtoPanel() {
  const [filter, setFilter] = useState<Filter>("active");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<PtoReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [amendDraft, setAmendDraft] = useState<
    Record<string, { start: string; end: string; days: string; note: string }>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, setRes] = await Promise.all([
        fetch(`/api/staff-pto/requests?filter=${filter}`),
        fetch("/api/staff-pto/settings"),
      ]);
      const reqData = (await reqRes.json()) as { requests?: RequestRow[]; error?: string };
      const setData = (await setRes.json()) as {
        settings?: Settings;
        balance?: Balance;
        error?: string;
      };
      if (!reqRes.ok) throw new Error(reqData.error ?? "Could not load PTO requests.");
      if (!setRes.ok) throw new Error(setData.error ?? "Could not load PTO settings.");
      setRequests(reqData.requests ?? []);
      setSettings(setData.settings ?? null);
      setBalance(setData.balance ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load PTO.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/staff-pto/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate || startDate,
          reason,
          details,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        overlapWarning?: string | null;
        exceedWarning?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not submit request.");
      const warnings = [data.overlapWarning, data.exceedWarning].filter(Boolean).join(" ");
      setMessage(warnings || "PTO request submitted.");
      setStartDate("");
      setEndDate("");
      setReason("");
      setDetails("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchRequest(
    id: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/staff-pto/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      exceedWarning?: string | null;
      overlapWarning?: string | null;
    };
    if (!res.ok) {
      setError(data.error ?? "Update failed.");
      return;
    }
    const warnings = [data.exceedWarning, data.overlapWarning].filter(Boolean).join(" ");
    setMessage(warnings || successMessage);
    await refresh();
  }

  return (
    <section className="mt-10 max-w-4xl rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">PTO requests (admin preview)</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
            Visible to admins and super admins only while we review. Please request PTO at least 14
            days in advance when possible; sick and emergency may be sooner. HR/admin make the final
            decision. Days charged default to business days (Mon–Fri); holidays can be adjusted
            without changing dates.
          </p>
        </div>
        {balance ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
            {balance.unlimited ? (
              <p className="font-medium text-brand-black">PTO bank: unlimited</p>
            ) : (
              <>
                <p className="font-medium text-brand-black">
                  Remaining: {balance.remainingDays} / {balance.annualDays} days
                </p>
                <p className="text-xs text-brand-black/60">
                  Used {balance.usedDays}
                  {balance.pendingDays > 0 ? ` · ${balance.pendingDays} pending` : ""} · period{" "}
                  {balance.period.start} – {balance.period.endInclusive}
                </p>
                {(balance.remainingDays ?? 0) < 0 ? (
                  <p className="text-xs text-amber-800">Over annual allotment (allowed with warning).</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <form onSubmit={submitRequest} className="mt-5 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Start date</span>
          <input
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate) setEndDate(e.target.value);
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">End date</span>
          <input
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Reason</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value as PtoReason | "")}
          >
            <option value="">Select…</option>
            {PTO_REASONS.map((r) => (
              <option key={r} value={r}>
                {ptoReasonLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">
            Details{reason === "other" ? " (required)" : " (optional)"}
          </span>
          <textarea
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            required={reason === "other"}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit PTO request"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-brand-black">Filter:</span>
        {(
          [
            ["active", "Active"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["denied", "Denied"],
            ["past", "Past"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === value
                ? "bg-brand-green text-white"
                : "border border-neutral-300 bg-white text-brand-black"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-4 text-sm text-brand-black/60">Loading…</p> : null}
      {message ? <p className="mt-3 text-sm text-brand-green">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-4 space-y-3">
        {requests.length === 0 && !loading ? (
          <li className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-brand-black/60">
            No requests in this filter.
          </li>
        ) : null}
        {requests.map((row) => {
          const draft = amendDraft[row.id] ?? {
            start: row.start_date,
            end: row.end_date,
            days: String(row.days_charged),
            note: "",
          };
          return (
            <li key={row.id} className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-black">
                    {row.requester_name}{" "}
                    <span className="font-normal text-brand-black/55">· {ptoReasonLabel(row.reason)}</span>
                  </p>
                  <p className="text-brand-black/75">
                    {row.start_date}
                    {row.end_date !== row.start_date ? ` → ${row.end_date}` : ""} · {row.days_charged}{" "}
                    day{row.days_charged === 1 ? "" : "s"} charged
                    {row.days_charged_manual ? " (adjusted)" : ""}
                  </p>
                  {row.details ? (
                    <p className="mt-1 text-brand-black/65">{row.details}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    row.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : row.status === "denied"
                        ? "bg-red-100 text-red-800"
                        : row.status === "cancelled"
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {row.status}
                </span>
              </div>
              {row.decision_notes ? (
                <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-brand-black/75">
                  <span className="font-medium">Explanation:</span> {row.decision_notes}
                  {row.decided_by_name ? (
                    <span className="text-brand-black/50"> — {row.decided_by_name}</span>
                  ) : null}
                </p>
              ) : null}

              {row.status === "pending" ? (
                <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                  <label className="block text-xs font-medium text-brand-black/70">
                    Decision explanation
                    <input
                      className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                      value={decisionNotes[row.id] ?? ""}
                      onChange={(e) =>
                        setDecisionNotes((m) => ({ ...m, [row.id]: e.target.value }))
                      }
                      placeholder="Optional on approve; required on deny"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() =>
                        void patchRequest(
                          row.id,
                          {
                            action: "approve",
                            decision_notes: decisionNotes[row.id] ?? "",
                          },
                          "Approved."
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() =>
                        void patchRequest(
                          row.id,
                          {
                            action: "deny",
                            decision_notes: decisionNotes[row.id] ?? "",
                          },
                          "Denied."
                        )
                      }
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
                      onClick={() =>
                        void patchRequest(row.id, { action: "cancel" }, "Cancelled.")
                      }
                    >
                      Cancel (if yours)
                    </button>
                  </div>
                </div>
              ) : null}

              {row.status === "approved" || row.status === "pending" ? (
                <details className="mt-3 border-t border-neutral-100 pt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-black/70">
                    Amend dates / days charged
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs">
                      Start
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                        value={draft.start}
                        onChange={(e) =>
                          setAmendDraft((m) => ({
                            ...m,
                            [row.id]: { ...draft, start: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs">
                      End
                      <input
                        type="date"
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                        value={draft.end}
                        onChange={(e) =>
                          setAmendDraft((m) => ({
                            ...m,
                            [row.id]: { ...draft, end: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs">
                      Days charged
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                        value={draft.days}
                        onChange={(e) =>
                          setAmendDraft((m) => ({
                            ...m,
                            [row.id]: { ...draft, days: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs sm:col-span-3">
                      Amendment note (required)
                      <input
                        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                        value={draft.note}
                        onChange={(e) =>
                          setAmendDraft((m) => ({
                            ...m,
                            [row.id]: { ...draft, note: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-3">
                      <button
                        type="button"
                        className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() =>
                          void patchRequest(
                            row.id,
                            {
                              action: "amend",
                              start_date: draft.start,
                              end_date: draft.end,
                              days_charged: Number(draft.days),
                              note: draft.note,
                            },
                            "Amended."
                          )
                        }
                      >
                        Save amendment
                      </button>
                      {row.status === "approved" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800"
                          onClick={() =>
                            void patchRequest(
                              row.id,
                              { action: "void", note: draft.note || "Voided by admin" },
                              "Voided."
                            )
                          }
                        >
                          Void approved
                        </button>
                      ) : null}
                    </div>
                  </div>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>

      {settings ? (
        <p className="mt-4 text-xs text-brand-black/55">
          Org period start: {settings.period_start_date}. Change annual days and period start under
          Super Admin / Admin portal settings.
        </p>
      ) : null}
    </section>
  );
}
