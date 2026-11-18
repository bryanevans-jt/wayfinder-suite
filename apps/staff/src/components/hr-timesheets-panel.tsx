"use client";

import Link from "next/link";

/** HR / Admin timesheet tab — billable review lives on Billable Hours. */
export function HrTimesheetsPanel() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Weekly Timesheet</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Review billable service time by team member and week. Pay is based on billable hours — there
          is no week submit/approve step.
        </p>
        <Link
          href="/dashboard/billable-hours#monthly-timesheet"
          className="mt-4 inline-flex rounded-lg border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
        >
          Open Weekly Timesheet
        </Link>
        <p className="mt-4 text-sm text-brand-black/70">
          Paid time off requests are under{" "}
          <Link href="/dashboard/pto" className="font-medium text-brand-green underline">
            PTO
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
