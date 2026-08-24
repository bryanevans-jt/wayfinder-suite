"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PTO_FORM_REASONS,
  ptoReasonLabel,
  ptoStatusLabel,
  type PtoFormReason,
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

type Capabilities = {
  canApprove: boolean;
  canSupervisorAdvance: boolean;
  canManageSettings: boolean;
  canViewAll: boolean;
  canViewDesignatedEs: boolean;
};

function statusBadgeClass(status: string): string {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "denied") return "bg-red-100 text-red-800";
  if (status === "cancelled") return "bg-neutral-100 text-neutral-600";
  if (status === "pending_supervisor") return "bg-sky-100 text-sky-900";
  return "bg-amber-100 text-amber-900";
}

export function StaffPtoPanel() {
  const [filter, setFilter] = useState<Filter>("active");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [caps, setCaps] = useState<Capabilities>({
    canApprove: false,
    canSupervisorAdvance: false,
    canManageSettings: false,
    canViewAll: false,
    canViewDesignatedEs: false,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<PtoFormReason | "">("");
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
      const reqData = (await reqRes.json()) as {
        requests?: RequestRow[];
        capabilities?: Capabilities;
        error?: string;
      };
      const setData = (await setRes.json()) as {
        balance?: Balance;
        capabilities?: Capabilities;
        error?: string;
      };
      if (!reqRes.ok) throw new Error(reqData.error ?? "Could not load PTO requests.");
      if (!setRes.ok) throw new Error(setData.error ?? "Could not load PTO settings.");
      setRequests(reqData.requests ?? []);
      setBalance(setData.balance ?? null);
      setCaps({
        canApprove: false,
        canSupervisorAdvance: false,
        canManageSettings: false,
        canViewAll: false,
        canViewDesignatedEs: false,
        ...(setData.capabilities ?? {}),
        ...(reqData.capabilities ?? {}),
      });
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
        message?: string;
        overlapWarning?: string | null;
        exceedWarning?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not submit request.");
      const warnings = [data.overlapWarning, data.exceedWarning].filter(Boolean).join(" ");
      setMessage(warnings || data.message || "PTO request submitted.");
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
      message?: string;
      exceedWarning?: string | null;
      overlapWarning?: string | null;
    };
    if (!res.ok) {
      setError(data.error ?? "Update failed.");
      return;
    }
    const warnings = [data.exceedWarning, data.overlapWarning].filter(Boolean).join(" ");
    setMessage(warnings || data.message || successMessage);
    await refresh();
  }

  return (
    <section className="mt-10 max-w-4xl rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">PTO Requests</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
            Please request PTO at least 14 days in advance when possible; sick and emergency may be
            sooner. Employment Specialists and Instructors go to their supervisor first for coverage
            review; HR/admin make the final approval. Supervisors and admins still go straight to
            HR.
          </p>
        </div>
        {balance ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
            {balance.unlimited ? (
              <p className="font-medium text-brand-black">PTO Bank: Unlimited</p>
            ) : (
              <>
                <p className="font-medium text-brand-black">
                  Remaining: {balance.remainingDays} / {balance.annualDays} Days
                </p>
                <p className="text-xs text-brand-black/60">
                  Used {balance.usedDays}
                  {balance.pendingDays > 0 ? ` · ${balance.pendingDays} pending` : ""} · Period{" "}
                  {balance.period.start} – {balance.period.endInclusive}
                </p>
                {(balance.remainingDays ?? 0) < 0 ? (
                  <p className="mt-1 text-xs text-amber-800">Balance is negative — talk with HR.</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <form onSubmit={(e) => void submitRequest(e)} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Start date</span>
          <input
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">End date</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Reason</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value as PtoFormReason | "")}
          >
            <option value="">Select…</option>
            {PTO_FORM_REASONS.map((r) => (
              <option key={r} value={r}>
                {ptoReasonLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Details</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={reason === "other" ? "Required for Other" : "Optional"}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit PTO Request"}
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
          const showSupervisorActions =
            row.status === "pending_supervisor" &&
            (caps.canApprove || caps.canSupervisorAdvance);
          const showHrActions = row.status === "pending" && caps.canApprove;
          const showCancel =
            row.status === "pending" || row.status === "pending_supervisor";

          return (
            <li key={row.id} className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-black">
                    {row.requester_name}{" "}
                    <span className="font-normal text-brand-black/55">
                      · {ptoReasonLabel(row.reason)}
                    </span>
                  </p>
                  <p className="text-brand-black/75">
                    {row.start_date}
                    {row.end_date !== row.start_date ? ` → ${row.end_date}` : ""} ·{" "}
                    {row.days_charged} day{row.days_charged === 1 ? "" : "s"} charged
                    {row.days_charged_manual ? " (adjusted)" : ""}
                  </p>
                  {row.details ? (
                    <p className="mt-1 text-brand-black/65">{row.details}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(row.status)}`}
                >
                  {ptoStatusLabel(row.status)}
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

              {showSupervisorActions || showHrActions || showCancel ? (
                <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                  {showSupervisorActions || showHrActions ? (
                    <label className="block text-xs font-medium text-brand-black/70">
                      Decision Explanation
                      <input
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                        value={decisionNotes[row.id] ?? ""}
                        onChange={(e) =>
                          setDecisionNotes((m) => ({ ...m, [row.id]: e.target.value }))
                        }
                        placeholder={
                          showSupervisorActions
                            ? "Optional on send to HR; required on deny"
                            : "Optional on approve; required on deny"
                        }
                      />
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {showSupervisorActions ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() =>
                            void patchRequest(
                              row.id,
                              {
                                action: "supervisor_approve",
                                decision_notes: decisionNotes[row.id] ?? "",
                              },
                              "Sent to HR."
                            )
                          }
                        >
                          OK — send to HR
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() =>
                            void patchRequest(
                              row.id,
                              {
                                action: "supervisor_deny",
                                decision_notes: decisionNotes[row.id] ?? "",
                              },
                              "Denied."
                            )
                          }
                        >
                          Deny
                        </button>
                      </>
                    ) : null}
                    {showHrActions ? (
                      <>
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
                      </>
                    ) : null}
                    {showCancel ? (
                      <button
                        type="button"
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
                        onClick={() =>
                          void patchRequest(row.id, { action: "cancel" }, "Cancelled.")
                        }
                      >
                        Cancel (If Yours)
                      </button>
                    ) : null}
                  </div>
                  {showSupervisorActions ? (
                    <p className="text-xs text-brand-black/55">
                      Confirm coverage and that this won&apos;t conflict with scheduled meetings or
                      tasks before sending to HR. The request is not approved until HR/admin
                      decides.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {caps.canApprove &&
              (row.status === "approved" ||
                row.status === "pending" ||
                row.status === "pending_supervisor") ? (
                <details className="mt-3 border-t border-neutral-100 pt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-black/70">
                    Amend Dates / Days Charged
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
                      Days Charged
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
                      Amendment Note (Required)
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
                        Save Amendment
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
                          Void Approved
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
    </section>
  );
}
