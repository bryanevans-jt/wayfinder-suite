"use client";

import { minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import { minutesToClockLabel } from "@wayfinder/supabase/staff-time-clock-shared";
import Link from "next/link";
import type { MyBillableHoursSummary } from "@/lib/es-time-data";

type Props = {
  summary: MyBillableHoursSummary;
  timesheetHref: string;
  showTeamTimesheetLink?: boolean;
  teamTimesheetHref?: string;
};

function formatLocalDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function SummaryCard({
  title,
  minutes,
  detail,
}: {
  title: string;
  minutes: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">{title}</p>
      <p className="mt-0.5 text-lg font-semibold text-brand-black">
        {minutesToClockLabel(minutes)}
      </p>
      <p className="text-xs text-brand-black/55">
        {minutesToDecimalHours(minutes)} hrs · {detail}
      </p>
    </div>
  );
}

export function MyBillableHoursWorkspace({
  summary,
  timesheetHref,
  showTeamTimesheetLink = false,
  teamTimesheetHref,
}: Props) {
  return (
    <div className="mt-6 max-w-4xl space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-black">
              Billable hours{" "}
              <span className="font-normal text-brand-black/55">(America/New_York)</span>
            </h2>
            <p className="mt-1 text-sm text-brand-black/65">
              Totals from client service time logged on your timesheet (contacts, applications,
              meetings, and related activity). Pay weeks run Sunday through Saturday.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={timesheetHref}
              className="rounded-lg border border-brand-green bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
            >
              Open weekly timesheet
            </Link>
            {showTeamTimesheetLink && teamTimesheetHref ? (
              <Link
                href={teamTimesheetHref}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50"
              >
                Team timesheets
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="This week"
            minutes={summary.thisWeekMinutes}
            detail={`Sun ${formatLocalDateShort(summary.thisWeekStart)} – Sat ${formatLocalDateShort(summary.thisWeekEnd)}`}
          />
          <SummaryCard
            title="Last week"
            minutes={summary.lastWeekMinutes}
            detail={`Sun ${formatLocalDateShort(summary.lastWeekStart)} – Sat ${formatLocalDateShort(summary.lastWeekEnd)}`}
          />
          <SummaryCard
            title={`${summary.monthLabel} (month to date)`}
            minutes={summary.monthMinutes}
            detail={`${formatLocalDateShort(summary.monthStart)} – ${formatLocalDateShort(summary.monthEnd)}`}
          />
        </div>
      </section>

      <section className="rounded-xl border border-brand-green/20 bg-brand-green/5 px-4 py-3 text-sm text-brand-black/85">
        <p>
          Time is captured when you log work from a client profile. If a total looks low, open the
          weekly timesheet for line-by-line detail or add missing service time from{" "}
          <Link href="/dashboard/clients" className="font-medium text-brand-green underline">
            Clients
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
