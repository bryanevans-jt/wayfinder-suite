"use client";

import { displayServiceTimes, minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { friendlyClientError } from "@wayfinder/supabase/error-log";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { EsTimeEntryRow, EsWeekSubmissionRow, SupervisedEsOption, TimesheetClientOption } from "@/lib/es-time-data";
import { shiftWeekStart, summarizeTimeEntries } from "@/lib/es-time-data";
import {
  approveEsWeek,
  returnEsWeek,
  submitEsWeek,
} from "@/app/dashboard/timesheet/actions";

type Props = {
  role: string;
  esUserId: string;
  esName: string;
  weekStart: string;
  weekEnd: string;
  entries: EsTimeEntryRow[];
  weekSubmission: EsWeekSubmissionRow | null;
  pendingApprovals: EsWeekSubmissionRow[];
  readOnly?: boolean;
  supervisedEsOptions?: SupervisedEsOption[];
  caseloadClients?: TimesheetClientOption[];
  initialClientFilter?: string;
  canPickEs?: boolean;
};

function formatWeekLabel(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt.format(new Date(start + "T12:00:00"))} – ${fmt.format(new Date(end + "T12:00:00"))}`;
}

export function TimesheetWorkspace({
  role,
  esUserId,
  esName,
  weekStart,
  weekEnd,
  entries,
  weekSubmission,
  pendingApprovals,
  readOnly = false,
  supervisedEsOptions = [],
  caseloadClients = [],
  initialClientFilter = "",
  canPickEs = false,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [clientFilter, setClientFilter] = useState(initialClientFilter);
  const [pending, startTransition] = useTransition();

  const visibleEntries = useMemo(() => {
    if (!clientFilter) {
      return entries;
    }
    return entries.filter((e) => e.client_id === clientFilter);
  }, [entries, clientFilter]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of caseloadClients) {
      map.set(c.id, c.name);
    }
    for (const e of entries) {
      if (e.client_id && e.client_name && !map.has(e.client_id)) {
        map.set(e.client_id, e.client_name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [caseloadClients, entries]);

  const summary = summarizeTimeEntries(visibleEntries);
  const canSubmit =
    isEsRole(role) &&
    !readOnly &&
    entries.some((e) => e.status === "draft" || e.status === "rejected") &&
    (!weekSubmission || weekSubmission.status === "open" || weekSubmission.status === "returned");

  const weekStatus = weekSubmission?.status ?? "open";
  const exportParams = new URLSearchParams({
    week: weekStart,
    es: esUserId,
  });
  if (clientFilter) {
    exportParams.set("client", clientFilter);
  }
  const csvHref = `/api/exports/time?${exportParams.toString()}`;
  const pdfHref = `/api/exports/time/pdf?${exportParams.toString()}`;
  const canDownloadPdf = weekStatus === "approved";

  function pushTimesheetQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/dashboard/timesheet?${params.toString()}`);
  }

  function changeWeek(delta: number) {
    pushTimesheetQuery({ week: shiftWeekStart(weekStart, delta) });
  }

  function onEsChange(nextEsId: string) {
    pushTimesheetQuery({ es: nextEsId });
  }

  function onClientFilterChange(nextClientId: string) {
    setClientFilter(nextClientId);
    pushTimesheetQuery({ client: nextClientId || null });
  }

  function onSubmitWeek() {
    setError(null);
    startTransition(async () => {
      try {
        await submitEsWeek(weekStart);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  function onApprove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await approveEsWeek(id);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  function onReturn(id: string) {
    setError(null);
    const notes = returnNotes[id]?.trim() ?? "";
    startTransition(async () => {
      try {
        await returnEsWeek(id, notes);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="mt-8 max-w-5xl space-y-8">
      {(isSupervisorRole(role) || isAdminTierRole(role)) && pendingApprovals.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-brand-black">Pending approvals</h2>
          <ul className="mt-3 space-y-3">
            {pendingApprovals.map((w) => (
              <li
                key={w.id}
                className="rounded-lg border border-amber-100 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-black">{w.es_name}</p>
                    <p className="text-sm text-brand-black/70">
                      {formatWeekLabel(w.week_start, w.week_end)} ·{" "}
                      {minutesToDecimalHours(w.total_minutes)} hrs
                    </p>
                  </div>
                  {!readOnly ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(w.id)}
                        disabled={pending}
                        className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Approve week
                      </button>
                    </div>
                  ) : null}
                </div>
                {!readOnly ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm">
                      Return notes
                      <input
                        type="text"
                        value={returnNotes[w.id] ?? ""}
                        onChange={(e) =>
                          setReturnNotes((prev) => ({ ...prev, [w.id]: e.target.value }))
                        }
                        placeholder="What should the ES fix?"
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onReturn(w.id)}
                      disabled={pending}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60"
                    >
                      Return for correction
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        {canPickEs ? (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm font-medium text-brand-black">
                Employment Specialist
                <select
                  value={esUserId}
                  onChange={(e) => onEsChange(e.target.value)}
                  className="mt-1 block min-w-[220px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  disabled={supervisedEsOptions.length === 0}
                >
                  {supervisedEsOptions.length === 0 ? (
                    <option value="">No Employment Specialists in your scope</option>
                  ) : (
                    supervisedEsOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block text-sm font-medium text-brand-black">
                Client
                <select
                  value={clientFilter}
                  onChange={(e) => onClientFilterChange(e.target.value)}
                  className="mt-1 block min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  disabled={supervisedEsOptions.length === 0}
                >
                  <option value="">All clients</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {supervisedEsOptions.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                No Employment Specialists are linked to you yet. Ask an admin to add Supervisor ↔ ES
                links on the Connections tab, then refresh this page.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">
              {isEsRole(role) ? "My weekly timesheet" : `${esName}'s weekly timesheet`}
            </h2>
            <p className="text-sm text-brand-black/70">
              Week (Sun–Sat): {formatWeekLabel(weekStart, weekEnd)}
            </p>
            <p className="mt-1 text-xs text-brand-black/55">
              Status: <span className="font-medium capitalize">{weekStatus.replace("_", " ")}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => changeWeek(-1)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              Previous week
            </button>
            <button
              type="button"
              onClick={() => changeWeek(1)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              Next week
            </button>
            <a
              href={csvHref}
              className="rounded-lg border border-brand-gold bg-brand-gold px-3 py-2 text-sm font-semibold text-white"
            >
              Download CSV
            </a>
            {canDownloadPdf ? (
              <a
                href={pdfHref}
                className="rounded-lg border border-brand-green bg-brand-green px-3 py-2 text-sm font-semibold text-white"
              >
                Download PDFs
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Stat label="Total hours" value={minutesToDecimalHours(summary.totalMinutes)} />
          <Stat label="Entries" value={String(visibleEntries.length)} />
          <Stat
            label="Clients served"
            value={String(summary.byClient.filter((c) => c.name !== "Non-client time").length)}
          />
        </div>

        {summary.byClient.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-brand-black">By client</h3>
            <ul className="mt-2 space-y-1 text-sm text-brand-black/80">
              {summary.byClient.map((c) => (
                <li key={c.name} className="flex flex-wrap items-center gap-2">
                  <span>
                    {c.name}: {minutesToDecimalHours(c.minutes)} hrs ({c.count} entries)
                  </span>
                  {canDownloadPdf && c.clientId ? (
                    <a
                      href={`${pdfHref}&client=${encodeURIComponent(c.clientId)}`}
                      className="text-xs font-semibold text-brand-green underline"
                    >
                      PDF
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {canDownloadPdf ? (
              <p className="mt-2 text-xs text-brand-black/55">
                One PDF per client with the Joshua Tree logo. Multiple clients download as a ZIP.
              </p>
            ) : null}
          </div>
        ) : null}

        {canSubmit ? (
          <button
            type="button"
            onClick={onSubmitWeek}
            disabled={pending}
            className="mt-5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit week for approval"}
          </button>
        ) : null}

        {weekSubmission?.supervisor_notes ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Supervisor notes: {weekSubmission.supervisor_notes}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-base font-semibold text-brand-black">Line items</h3>
        {visibleEntries.length === 0 ? (
          <p className="mt-2 text-sm text-brand-black/70">
            No time entries this week. Log contact, applications, meetings, or stage updates from a{" "}
            <Link href="/dashboard/clients" className="text-brand-green underline">
              client profile
            </Link>
            , or add manual time there.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-brand-black/55">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Min</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Narrative</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e) => {
                  const times = displayServiceTimes(e);
                  return (
                  <tr key={e.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 whitespace-nowrap">{e.service_date}</td>
                    <td className="px-3 py-2">{e.client_name ?? "—"}</td>
                    <td className="px-3 py-2">{e.activity_name}</td>
                    <td className="px-3 py-2">{e.duration_minutes}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{times.start}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{times.end}</td>
                    <td className="px-3 py-2 capitalize">{e.status}</td>
                    <td className="max-w-xs px-3 py-2 text-brand-black/75">
                      {e.narrative ?? "—"}
                      {e.flags?.late_entry ? (
                        <span className="ml-1 text-xs text-amber-700">(late)</span>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-black/50">{label}</p>
      <p className="mt-1 text-xl font-semibold text-brand-black">{value}</p>
    </div>
  );
}
