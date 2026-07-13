import type {
  ComplianceReportRow,
  ComplianceTimesheetRow,
} from "@/lib/operations-data";
import { formatPortalDateTime } from "@wayfinder/branding";
import Link from "next/link";

type Props = {
  reports: ComplianceReportRow[];
  timesheets: ComplianceTimesheetRow[];
};

export function ComplianceCalendarWorkspace({ reports, timesheets }: Props) {
  return (
    <div className="mt-8 max-w-5xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Official Reports</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-brand-black/65">No open report alerts in your scope.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-brand-black">
                    {r.clientName} · {r.alertType === "overdue" ? "Overdue" : "Missing"} SE Monthly
                  </p>
                  <p className="text-brand-black/60">
                    {r.esName} · {r.reportingMonth}
                    {r.dueAt ? ` · due ${formatPortalDateTime(r.dueAt)}` : null}
                  </p>
                </div>
                <Link href="/dashboard/reporting" className="text-brand-green hover:underline">
                  Reporting →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Timesheets pending approval</h2>
        {timesheets.length === 0 ? (
          <p className="mt-3 text-sm text-brand-black/65">No submitted timesheets awaiting action.</p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {timesheets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-brand-black">
                    {t.esName} · week of {t.weekStart}
                  </p>
                  <p className="text-brand-black/60">
                    {t.status} · {Math.round(t.totalMinutes / 60)}h {t.totalMinutes % 60}m
                  </p>
                </div>
                <Link
                  href={`/dashboard/timesheet?es=${encodeURIComponent(t.esUserId)}&week=${encodeURIComponent(t.weekStart)}`}
                  className="text-brand-green hover:underline"
                >
                  Timesheet →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
