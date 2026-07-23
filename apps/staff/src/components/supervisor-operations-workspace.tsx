import type { CoachingSlaRow, CoachingThinLogRow, EsCapacityRow } from "@/lib/operations-data";
import { SOFT_ACTIVE_CASELOAD_GUIDANCE } from "@/lib/analytics/definitions";
import { MIN_CONTACTS_PER_MONTH } from "@wayfinder/supabase/caseload-triage";
import { formatPortalDateTime } from "@wayfinder/branding";
import Link from "next/link";

type Props = {
  capacity: EsCapacityRow[];
  coaching: { sla: CoachingSlaRow[]; thinLogs: CoachingThinLogRow[] };
  showCoaching: boolean;
};

export function SupervisorOperationsWorkspace({ capacity, coaching, showCoaching }: Props) {
  return (
    <div className="mt-8 max-w-5xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Capacity View</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Active caseload and billable minutes (last 4 weeks) per Employment Specialist. Soft
          guidance is {SOFT_ACTIVE_CASELOAD_GUIDANCE} active clients — overages are allowed; use
          judgment with supervisors/HR.
        </p>
        {capacity.length === 0 ? (
          <p className="mt-4 text-sm text-brand-black/60">No Employment Specialist data in scope.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="py-2 pr-4 font-semibold">Employment Specialist</th>
                  <th className="py-2 pr-4 font-semibold">Caseload</th>
                  <th className="py-2 font-semibold">Billable (4 wk)</th>
                </tr>
              </thead>
              <tbody>
                {capacity.map((row) => (
                  <tr key={row.esUserId} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">{row.esName}</td>
                    <td
                      className={`py-2 pr-4 ${
                        row.caseloadCount > SOFT_ACTIVE_CASELOAD_GUIDANCE
                          ? "font-semibold text-amber-800"
                          : ""
                      }`}
                    >
                      {row.caseloadCount}
                      {row.caseloadCount > SOFT_ACTIVE_CASELOAD_GUIDANCE ? (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          above soft guidance
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {Math.floor(row.billableMinutesLast4Weeks / 60)}h{" "}
                      {row.billableMinutesLast4Weeks % 60}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCoaching ? (
        <>
          <section className="rounded-xl border border-red-200 bg-red-50/50 p-5">
            <h2 className="text-base font-semibold text-brand-black">Coaching Queue — Message SLA</h2>
            <p className="mt-1 text-sm text-brand-black/65">Overdue client replies (48 business hours).</p>
            {coaching.sla.length === 0 ? (
              <p className="mt-4 text-sm text-brand-black/60">No overdue message threads.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {coaching.sla.map((row) => (
                  <li key={row.threadId} className="rounded-lg border border-red-100 bg-white px-3 py-2">
                    <span className="font-medium">{row.esName}</span> — {row.clientLabel} · client
                    waiting since {formatPortalDateTime(row.lastClientMessageAt)}{" "}
                    <Link href="/dashboard/messages" className="text-brand-green hover:underline">
                      Messages →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
            <h2 className="text-base font-semibold text-brand-black">Coaching Queue — Contact Volume</h2>
            <p className="mt-1 text-sm text-brand-black/65">
              Clients with fewer than {MIN_CONTACTS_PER_MONTH} contacts logged this month.
            </p>
            {coaching.thinLogs.length === 0 ? (
              <p className="mt-4 text-sm text-brand-black/60">All clients meet the monthly contact target.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {coaching.thinLogs.map((row) => (
                  <li key={`${row.esName}-${row.clientId}`} className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                    <span className="font-medium">{row.esName}</span> — {row.clientLabel} ·{" "}
                    {row.contactsThisMonth} contact{row.contactsThisMonth === 1 ? "" : "s"} this month{" "}
                    <Link
                      href={`/dashboard/clients/${row.clientId}`}
                      className="text-brand-green hover:underline"
                    >
                      Open client →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
