"use client";

import { formatBillableHours } from "@wayfinder/supabase/client-billable";
import {
  canViewClientProfiles,
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import type { EsTimeEntryRow, SupervisedEsOption, TimesheetClientOption } from "@/lib/es-time-client";
import {
  shiftMonthKey,
  summarizeTimeEntries,
  summarizeTimeEntriesByClientService,
} from "@/lib/es-time-client";

type Props = {
  role: string;
  esUserId: string;
  esName: string;
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
  entries: EsTimeEntryRow[];
  readOnly?: boolean;
  supervisedEsOptions?: SupervisedEsOption[];
  caseloadClients?: TimesheetClientOption[];
  initialClientFilter?: string;
  canPickEs?: boolean;
  /** Route used for month / ES / client query updates (default Billable Hours). */
  basePath?: string;
};

function formatEntryCreatedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatServiceDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function monthInputValue(monthKey: string): string {
  return `${monthKey}-01`;
}

function monthKeyFromInput(value: string): string {
  return value.slice(0, 7);
}

export function TimesheetWorkspace({
  role,
  esUserId,
  esName,
  monthKey,
  monthStart,
  monthEnd,
  monthLabel,
  entries,
  supervisedEsOptions = [],
  caseloadClients = [],
  initialClientFilter = "",
  canPickEs = false,
  basePath = "/dashboard/billable-hours",
}: Props) {
  const router = useRouter();
  const [error] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState(initialClientFilter);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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
  const byClientService = summarizeTimeEntriesByClientService(visibleEntries);

  const exportParams = new URLSearchParams({
    month: monthKey,
    es: esUserId,
  });
  if (clientFilter) {
    exportParams.set("client", clientFilter);
  }
  const csvHref = `/api/exports/time?${exportParams.toString()}`;
  const pdfHref = `/api/exports/time/pdf?${exportParams.toString()}`;
  const canDownloadPdf = byClientService.some((c) => Boolean(c.clientId));

  function pushTimesheetQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    params.delete("week");
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}#monthly-timesheet`);
  }

  function changeMonth(delta: number) {
    pushTimesheetQuery({ month: shiftMonthKey(monthKey, delta) });
  }

  function onMonthPickerChange(nextMonthKey: string) {
    if (!nextMonthKey) return;
    pushTimesheetQuery({ month: nextMonthKey });
  }

  function onEsChange(nextEsId: string) {
    pushTimesheetQuery({ es: nextEsId });
  }

  function onClientFilterChange(nextClientId: string) {
    setClientFilter(nextClientId);
    setExpandedKey(null);
    pushTimesheetQuery({ client: nextClientId || null });
  }

  function toggleExpand(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="mt-8 max-w-5xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        {canPickEs ? (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm font-medium text-brand-black">
                Team member
                <select
                  value={esUserId}
                  onChange={(e) => onEsChange(e.target.value)}
                  className="mt-1 block min-w-[220px] rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  disabled={supervisedEsOptions.length === 0}
                >
                  {supervisedEsOptions.length === 0 ? (
                    <option value="">No team members available</option>
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
                {isSupervisorRole(role) && !isAdminTierRole(role)
                  ? "No Employment Specialists are linked to you yet. Ask an admin to add Supervisor ↔ ES links on the Connections tab, then refresh this page."
                  : "No billable-hours team members are available yet. Active ES, Transition Specialist, and Supervisor profiles appear here, along with admins who have client assignments."}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-black">
              {isFieldSpecialistRole(role) ? "My Monthly Timesheet" : `${esName}'s Monthly Timesheet`}
            </h2>
            <p className="text-sm text-brand-black/70">
              Month: {monthLabel} ({monthStart} – {monthEnd}, Eastern)
            </p>
            <p className="mt-1 text-xs text-brand-black/55">
              Pay is based on billable hours. No week submit or supervisor approval is required.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-brand-black/70">Month</span>
              <input
                type="month"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-brand-black"
                value={monthInputValue(monthKey)}
                onChange={(e) => onMonthPickerChange(monthKeyFromInput(e.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              Previous month
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium"
            >
              Next month
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Billable hours"
            value={`${formatBillableHours(summary.billableMinutes)} hrs`}
          />
          <Stat label="Entries" value={String(visibleEntries.length)} />
          <Stat
            label="Clients served"
            value={String(
              new Set(
                byClientService
                  .filter((c) => c.clientId)
                  .map((c) => c.clientId as string)
              ).size
            )}
          />
        </div>
        <p className="mt-2 text-xs text-brand-black/55">
          Billable hours count logged service time for this month (Eastern), whether or not the
          client was marked present. Case File Review and note-only contact are excluded from
          billable totals but still appear in the expanded entry list as non-billable.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-base font-semibold text-brand-black">Clients &amp; services</h3>
        <p className="mt-1 text-xs text-brand-black/55">
          One row per client and service. Click the entry count to expand contact logs. Unchecking
          &quot;Client was present&quot; does not remove hours from billable totals. PDFs include
          the Joshua Tree logo; multiple clients download as a ZIP for the selected month.
        </p>

        {byClientService.length === 0 ? (
          <p className="mt-4 text-sm text-brand-black/70">
            {isFieldSpecialistRole(role) || isSupervisorRole(role) ? (
              <>
                No time entries this month. Log contact, applications, meetings, or stage updates
                from a{" "}
                <Link href="/dashboard/clients" className="text-brand-green underline">
                  client profile
                </Link>
                , or add manual time there.
              </>
            ) : (
              "No time entries this month for this team member."
            )}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-brand-black/55">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Billable hrs</th>
                  <th className="px-3 py-2">Entries</th>
                  <th className="px-3 py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {byClientService.map((group) => {
                  const expanded = expandedKey === group.key;
                  return (
                    <Fragment key={group.key}>
                      <tr className="border-t border-neutral-100">
                        <td className="px-3 py-2">
                          {group.clientId &&
                          (isFieldSpecialistRole(role) ||
                            isSupervisorRole(role) ||
                            canViewClientProfiles(role)) ? (
                            <Link
                              href={`/dashboard/clients/${group.clientId}`}
                              className="font-medium text-brand-green hover:underline"
                            >
                              {group.clientName}
                            </Link>
                          ) : (
                            <span className="font-medium text-brand-black">{group.clientName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-brand-black/80">{group.serviceName}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatBillableHours(group.billableMinutes)} hrs
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(group.key)}
                            className="font-semibold text-brand-green underline"
                            aria-expanded={expanded}
                          >
                            {group.entryCount}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {canDownloadPdf && group.clientId ? (
                            <a
                              href={`${pdfHref}&client=${encodeURIComponent(group.clientId)}`}
                              className="text-xs font-semibold text-brand-green underline"
                            >
                              PDF
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-neutral-50 bg-neutral-50/60">
                          <td colSpan={5} className="px-3 py-3">
                            <ul className="space-y-3">
                              {group.entries.map((entry) => (
                                <li
                                  key={entry.id}
                                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-sm font-medium text-brand-black">
                                      {formatServiceDate(entry.service_date)}
                                      <span className="ml-2 font-normal text-brand-black/60">
                                        Logged {formatEntryCreatedAt(entry.created_at)}
                                      </span>
                                    </p>
                                    <p className="text-xs text-brand-black/60">
                                      {entry.counts_toward_client_billable ? (
                                        <span className="tabular-nums">
                                          {entry.client_billable_hours} billable hrs
                                        </span>
                                      ) : (
                                        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-amber-800">
                                          Non-billable
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-sm text-brand-black/80">
                                    <span className="font-medium">Contact log:</span>{" "}
                                    {entry.activity_name || "—"}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-brand-black/70">
                                    {entry.narrative?.trim() || "No notes"}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
